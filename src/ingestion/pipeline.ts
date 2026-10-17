import { randomUUID } from 'node:crypto';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { assert, requests, series, type Window } from './catalog.ts';
import { normalizeBcb, normalizeIbge, validateCoverage } from './normalize.ts';
import {
  type Artifact,
  accept,
  atomic,
  digest,
  encode,
  immutable,
  persist,
  prepareStore,
  readState,
} from './store.ts';

export type Options = {
  root: string;
  window: Window;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: (event: Record<string, unknown>) => void;
};

export async function ingest(options: Options) {
  const queries = requests(options.window);
  const { root } = options;
  const attempts = options.attempts ?? 3;
  const timeoutMs = options.timeoutMs ?? 20_000;
  assert(
    Number.isInteger(attempts) && attempts >= 1 && attempts <= 5,
    'Tentativas devem estar entre 1 e 5',
  );
  assert(Number.isFinite(timeoutMs) && timeoutMs > 0, 'Timeout inválido');
  const release = await prepareStore(root);
  const run = `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`;
  const artifacts: Artifact[] = [];
  const startedAt = new Date().toISOString();
  const event = async (data: Record<string, unknown>) => {
    const record = { run, at: new Date().toISOString(), ...data };
    await appendFile(join(root, 'runs', `${run}.jsonl`), `${JSON.stringify(record)}\n`);
    options.log?.(record);
  };
  try {
    await atomic(
      join(root, 'runs', `${run}.json`),
      encode({
        run,
        state: 'running',
        pid: process.pid,
        started_at: startedAt,
        window: options.window,
      }),
    );
    await event({ event: 'started', window: options.window });
    const { state } = await readState(root);
    const payloads = new Map<string, unknown>();
    for (const query of queries) {
      for (let attempt = 1; attempt <= attempts; attempt++) {
        let retry = false;
        try {
          await event({ event: 'fetch', request: query.id, url: query.url, attempt });
          const response = await (options.fetcher ?? fetch)(query.url, {
            signal: AbortSignal.timeout(timeoutMs),
            redirect: 'error',
            headers: { Accept: 'application/json' },
          });
          // Preserva inclusive HTML de bloqueio/erro antes de interpretar o conteúdo.
          const bytes = Buffer.from(await response.arrayBuffer());
          const sha256 = digest(bytes);
          await immutable(join(root, 'raw', sha256), bytes);
          const artifact: Artifact = {
            request: query.id,
            url: query.url,
            retrieved_at: new Date().toISOString(),
            sha256,
            bytes: bytes.length,
            status: response.status,
            content_type: response.headers.get('content-type'),
            etag: response.headers.get('etag'),
            last_modified: response.headers.get('last-modified'),
          };
          artifacts.push(artifact);
          await event({ event: 'raw_saved', attempt, ...artifact });
          retry = response.status === 429 || response.status >= 500;
          if (!response.ok) throw new Error(`HTTP ${response.status}: ${query.id}`);
          assert(
            artifact.content_type?.toLowerCase().includes('json'),
            `Content-Type não JSON: ${query.id}`,
          );
          payloads.set(query.id, JSON.parse(bytes.toString('utf8')));
          break;
        } catch (error) {
          // Falhas de transporte/timeout permitem retry; erros de schema/JSON não.
          retry ||=
            error instanceof TypeError ||
            (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name));
          await event({
            event: 'attempt_failed',
            request: query.id,
            attempt,
            error: String(error),
            retry: retry && attempt < attempts,
          });
          if (!retry || attempt === attempts) throw error;
          await (options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))))(
            Math.min(1000 * 2 ** (attempt - 1), 8000),
          );
        }
      }
    }
    const candidates = [
      ...normalizeIbge(
        payloads.get('tr4'),
        payloads.get('tr4-metadata'),
        [series[0]],
        options.window,
      ),
      ...normalizeIbge(
        payloads.get('cv1'),
        payloads.get('cv1-metadata'),
        [series[1], series[2]],
        options.window,
      ),
      ...normalizeBcb(payloads.get('vf1'), series[3], options.window),
    ];
    validateCoverage(candidates, series, options.window);
    const successfulArtifacts = artifacts.filter((item) => item.status >= 200 && item.status < 300);
    const result = accept(
      state,
      candidates,
      successfulArtifacts,
      run,
      options.window,
      new Date().toISOString(),
    );
    await event({
      event: 'validated',
      observations: candidates.length,
      changed: result.changed,
      batch: result.batch.id,
    });
    // O recibo e os dados são confirmados juntos pelo ponteiro. Falha posterior no log
    // não desfaz a aceitação; read/status recupera last_success do snapshot.
    const snapshot = await persist(root, state);
    await event({ event: 'accepted', snapshot, batch: result.batch.id, changed: result.changed });
    await atomic(
      join(root, 'runs', `${run}.json`),
      encode({
        run,
        state: 'succeeded',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        window: options.window,
        artifacts,
        snapshot,
        ...result,
      }),
    );
    return {
      run,
      snapshot,
      observations: candidates.length,
      batch: result.batch.id,
      changed: result.changed,
    };
  } catch (error) {
    await event({ event: 'failed', error: String(error) });
    await atomic(
      join(root, 'runs', `${run}.json`),
      encode({
        run,
        state: 'failed',
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        window: options.window,
        artifacts,
        error: String(error),
      }),
    );
    throw error;
  } finally {
    await release();
  }
}
