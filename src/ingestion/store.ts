import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assert, type Candidate, normalizationVersion, series, type Window } from './catalog.ts';

export const digest = (data: string | Uint8Array) =>
  createHash('sha256').update(data).digest('hex');
export const encode = (data: unknown) => `${JSON.stringify(data, null, 2)}\n`;

export type Artifact = {
  request: string;
  url: string;
  retrieved_at: string;
  sha256: string;
  bytes: number;
  status: number;
  content_type: string | null;
  etag: string | null;
  last_modified: string | null;
};

export type Observation = Candidate & {
  id: string;
  unit: '%';
  geography: 'BR';
  source: string;
  dataset: string;
  published_at: null;
  publication_note: string;
  retrieved_at: string;
  accepted_at: string;
  methodology_version: string;
  normalization_version: string;
  vintage: string;
  release_status: 'unknown';
  revision_status: 'unknown' | 'revised';
  supersedes: string | null;
  revision_note: string | null;
  raw_artifact: string;
};

export type Batch = {
  id: string;
  run: string;
  accepted_at: string;
  window: Window;
  fingerprint: string;
  observation_ids: string[];
};
export type State = {
  schema_version: 1;
  normalization_version: string;
  observations: Observation[];
  selected: Record<string, string>;
  batches: Batch[];
  last_success: {
    run: string;
    at: string;
    batch: string;
    changed: number;
    // Snapshots anteriores à inclusão deste campo continuam legíveis.
    window?: Window;
  } | null;
};

export const emptyState = (): State => ({
  schema_version: 1,
  normalization_version: normalizationVersion,
  observations: [],
  selected: {},
  batches: [],
  last_success: null,
});

function missing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export async function immutable(path: string, bytes: string | Uint8Array) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx');
  try {
    try {
      await handle.writeFile(bytes);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      // O link disponibiliza apenas bytes completos, sem substituir um artefato existente.
      await link(temporary, path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(path);
      assert(
        digest(existing) === digest(typeof bytes === 'string' ? Buffer.from(bytes) : bytes),
        'Conflito em artefato imutável',
      );
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function atomic(path: string, bytes: string) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, path);
}

export async function readState(
  root: string,
  snapshot?: string,
): Promise<{ snapshot: string | null; state: State }> {
  let id = snapshot;
  if (!id) {
    try {
      id = (await readFile(join(root, 'current'), 'utf8')).trim();
    } catch (error) {
      if (missing(error)) return { snapshot: null, state: emptyState() };
      throw error;
    }
  }
  assert(/^[a-f0-9]{64}$/.test(id), 'Snapshot inválido');
  const bytes = await readFile(join(root, 'snapshots', `${id}.json`));
  assert(digest(bytes) === id, 'Checksum do snapshot divergente');
  const state = JSON.parse(bytes.toString()) as State;
  assert(
    state.schema_version === 1 && state.normalization_version === normalizationVersion,
    'Versão do armazenamento incompatível',
  );
  return { snapshot: id, state };
}

export async function prepareStore(root: string) {
  await mkdir(root, { recursive: true });
  try {
    await mkdir(join(root, 'writer.lock'));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error(
        'Ingestão em andamento ou lock órfão; confira o processo antes de remover writer.lock',
      );
    throw error;
  }
  try {
    await writeFile(
      join(root, 'writer.lock', 'owner.json'),
      encode({ pid: process.pid, created_at: new Date().toISOString() }),
    );
    for (const folder of ['raw', 'runs', 'snapshots'])
      await mkdir(join(root, folder), { recursive: true });
  } catch (error) {
    await rm(join(root, 'writer.lock'), { recursive: true });
    throw error;
  }
  return () => rm(join(root, 'writer.lock'), { recursive: true });
}

export function accept(
  state: State,
  candidates: Candidate[],
  artifacts: Artifact[],
  run: string,
  window: Window,
  acceptedAt: string,
) {
  assert(
    state.normalization_version === normalizationVersion,
    'Correção de normalização exige migração explícita',
  );
  const sorted = [...candidates].sort(
    (a, b) =>
      a.series.localeCompare(b.series) ||
      a.reference_period.start.localeCompare(b.reference_period.start),
  );
  const fingerprint = digest(
    JSON.stringify(sorted.map(({ source_record_locator: _locator, ...value }) => value)),
  );
  const byId = new Map(state.observations.map((observation) => [observation.id, observation]));
  const observationIds: string[] = [];
  const additions: Observation[] = [];
  const keys = new Set<string>();
  for (const candidate of sorted) {
    const key = `${candidate.series}:${candidate.reference_period.start}:${candidate.reference_period.end}`;
    assert(!keys.has(key), 'Observação duplicada');
    keys.add(key);
    const previous = byId.get(state.selected[key]);
    if (
      previous &&
      previous.value === candidate.value &&
      previous.value_status === candidate.value_status &&
      previous.value_note === candidate.value_note
    ) {
      observationIds.push(previous.id);
      continue;
    }
    const definition = series.find((item) => item.id === candidate.series);
    assert(definition, 'Série desconhecida');
    const artifact = artifacts.find(
      (item) => item.request === (candidate.series.startsWith('cv1') ? 'cv1' : candidate.series),
    );
    assert(artifact, 'Raw ausente');
    const observation: Observation = {
      ...candidate,
      id: digest(`${run}:${key}:${normalizationVersion}`),
      unit: '%',
      geography: 'BR',
      source: definition.source,
      dataset: definition.dataset,
      published_at: null,
      publication_note:
        'Endpoint sem edição/data de publicação por observação; snapshot observado, sem ordem oficial de vintages.',
      retrieved_at: artifact.retrieved_at,
      accepted_at: acceptedAt,
      methodology_version: definition.methodology,
      normalization_version: normalizationVersion,
      vintage: run,
      release_status: 'unknown',
      revision_status: previous ? 'revised' : 'unknown',
      supersedes: previous?.id ?? null,
      revision_note: previous
        ? 'Mudança detectada em consulta corrente; não identifica a divulgação original da revisão.'
        : null,
      raw_artifact: artifact.sha256,
    };
    additions.push(observation);
    observationIds.push(observation.id);
    state.selected[key] = observation.id;
  }
  // Uma omissão da fonte não apaga o histórico nem serve silenciosamente um valor antigo.
  for (const observation of byId.values()) {
    if (
      state.selected[
        `${observation.series}:${observation.reference_period.start}:${observation.reference_period.end}`
      ] !== observation.id
    )
      continue;
    if (
      observation.reference_period.start >= `${window.from}-01` &&
      observation.reference_period.end.slice(0, 7) <= window.to
    ) {
      assert(
        keys.has(
          `${observation.series}:${observation.reference_period.start}:${observation.reference_period.end}`,
        ),
        'Fonte omitiu período previamente aceito; lote rejeitado',
      );
    }
  }
  state.observations.push(...additions);
  const existing = state.batches.find(
    (batch) =>
      batch.fingerprint === fingerprint &&
      JSON.stringify(batch.observation_ids) === JSON.stringify(observationIds),
  );
  const batch = existing ?? {
    id: run,
    run,
    accepted_at: acceptedAt,
    window,
    fingerprint,
    observation_ids: observationIds,
  };
  if (!existing) state.batches.push(batch);
  state.last_success = {
    run,
    at: acceptedAt,
    batch: batch.id,
    changed: additions.length,
    window: { ...window },
  };
  return { batch, changed: additions.length };
}

export async function persist(root: string, state: State) {
  const bytes = encode(state);
  const snapshot = digest(bytes);
  await immutable(join(root, 'snapshots', `${snapshot}.json`), bytes);
  await atomic(join(root, 'current'), `${snapshot}\n`);
  return snapshot;
}

export function expose(state: State, id?: string, history = false) {
  assert(id === undefined || series.some((item) => item.id === id), 'Série desconhecida');
  const selected = new Set(Object.values(state.selected));
  const observationsById = new Map(state.observations.map((item) => [item.id, item]));
  return {
    schema_version: 1,
    scope: 'local-ingestion-poc',
    publication: null,
    catalog: series
      .filter((item) => !id || item.id === id)
      .map((item) => ({
        ...item,
        unit: '%',
        geography: 'BR',
        methodology_version: item.methodology,
      })),
    last_success: state.last_success,
    coverage: series
      .filter((item) => !id || item.id === id)
      .map((definition) => {
        const periods = state.observations
          .filter((item) => item.series === definition.id && selected.has(item.id))
          .map((item) => item.reference_period)
          .sort((a, b) => a.start.localeCompare(b.start));
        return {
          series: definition.id,
          first_period: periods[0] ?? null,
          last_period: periods.at(-1) ?? null,
          periods: periods.length,
          accepted_windows: state.batches
            .filter((batch) =>
              batch.observation_ids.some(
                (observationId) => observationsById.get(observationId)?.series === definition.id,
              ),
            )
            .map((batch) => batch.window),
        };
      }),
    observations: state.observations
      .filter((item) => (!id || item.series === id) && (history || selected.has(item.id)))
      .sort(
        (a, b) =>
          a.series.localeCompare(b.series) ||
          a.reference_period.start.localeCompare(b.reference_period.start) ||
          a.accepted_at.localeCompare(b.accepted_at),
      ),
  };
}
