import { execFileSync, spawnSync } from 'node:child_process';
import { renameSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { requests, series } from '../../../src/ingestion/catalog.ts';
import { normalizeBcb, normalizeIbge } from '../../../src/ingestion/normalize.ts';
import { ingest } from '../../../src/ingestion/pipeline.ts';
import { digest, expose, persist, readState } from '../../../src/ingestion/store.ts';

const window = { from: '2025-01', to: '2025-12' };
const evidence = new URL('../../../docs/data-sources/evidence/', import.meta.url);
async function fixture(name: string) {
  return JSON.parse(await readFile(new URL(`${name}.json`, evidence), 'utf8'));
}

async function payloads() {
  const metadata = await fixture('metadata');
  const ibge = async (name: string) => {
    const data = await fixture(name);
    for (const variable of data) {
      const entries = variable.resultados[0].series[0].serie;
      variable.resultados[0].series[0].serie = Object.fromEntries(
        Object.entries(entries).filter(([key]) => key.startsWith('2025')),
      );
    }
    return data;
  };
  return new Map<string, unknown>([
    [
      'tr4-metadata',
      { ...metadata.ibge.find((item: { table: string }) => item.table === '4099'), id: '4099' },
    ],
    [
      'cv1-metadata',
      { ...metadata.ibge.find((item: { table: string }) => item.table === '1737'), id: '1737' },
    ],
    ['tr4', await ibge('ibge-tr4')],
    ['cv1', await ibge('ibge-cv1')],
    [
      'vf1',
      (await fixture('bcb-29265')).filter((item: { data: string }) => item.data.endsWith('/2025')),
    ],
  ]);
}

function fetcher(data: Map<string, unknown>, requestWindow = window) {
  const urls = requests(requestWindow);
  return vi.fn<typeof fetch>(async (input) => {
    const request = urls.find((item) => item.url === String(input));
    if (!request) throw new Error(`URL inesperada: ${String(input)}`);
    return new Response(JSON.stringify(data.get(request.id)), {
      headers: { 'content-type': 'application/json' },
    });
  });
}

let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'margem-ingestion-test-'));
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('PoC completa com amostras oficiais preservadas', () => {
  it('reexecuta offline os bytes da coleta real, conferindo hashes e 587 observações', async () => {
    const location = new URL('../../../docs/systems/evidence/ingestion/', import.meta.url);
    const verification = JSON.parse(await readFile(new URL('verification.json', location), 'utf8'));
    const observed = verification.runs[2] as {
      artifacts: {
        request: string;
        url: string;
        sha256: string;
        preserved_file: string;
        content_type: string;
      }[];
    };
    const bodies = new Map<string, { bytes: Buffer; type: string }>();
    for (const artifact of observed.artifacts) {
      const bytes = await readFile(new URL(artifact.preserved_file, location));
      expect(digest(bytes)).toBe(artifact.sha256);
      bodies.set(artifact.url, { bytes, type: artifact.content_type });
    }
    const replay: typeof fetch = async (input) => {
      const body = bodies.get(String(input));
      if (!body) throw new Error('URL fora da captura oficial');
      return new Response(new Uint8Array(body.bytes), { headers: { 'content-type': body.type } });
    };
    const historical = { from: '2012-01', to: '2026-10' };
    expect((await ingest({ root, window: historical, fetcher: replay })).changed).toBe(587);
    const { state } = await readState(root);
    const counts = expose(state).coverage.map((item) => [item.series, item.periods]);
    expect(counts).toEqual([
      ['tr4', 58],
      ['cv1-monthly', 177],
      ['cv1-12m', 177],
      ['vf1', 175],
    ]);
    expect((await ingest({ root, window: historical, fetcher: replay })).changed).toBe(0);
  });

  it('coleta, preserva bytes e proveniência, aceita 40 observações e expõe sem consultar fontes', async () => {
    const data = await payloads();
    const result = await ingest({ root, window, fetcher: fetcher(data) });
    expect(result).toMatchObject({ observations: 40, changed: 40 });
    const { snapshot, state } = await readState(root);
    expect(snapshot).toBe(result.snapshot);
    expect(state.batches).toHaveLength(1);
    const exported = expose(state);
    expect(exported.catalog).toHaveLength(4);
    const quarter = exported.observations.find((item) => item.series === 'tr4');
    expect(quarter).toMatchObject({
      reference_period: { start: '2025-01-01', end: '2025-03-31', label: '2025T1' },
      unit: '%',
      geography: 'BR',
      published_at: null,
      revision_status: 'unknown',
    });
    expect(exported.catalog.find((item) => item.id === 'vf1')?.temporal_basis).toBe(
      'trailing_3_month_average',
    );
    for (const observation of exported.observations) {
      const raw = await readFile(join(root, 'raw', observation.raw_artifact));
      expect(digest(raw)).toBe(observation.raw_artifact);
      expect(observation.retrieved_at <= observation.accepted_at).toBe(true);
      const source = JSON.parse(raw.toString());
      const located = observation.source_record_locator
        .split('/')
        .slice(1)
        .reduce((value, key) => value[key], source);
      expect(located).toBeDefined();
    }
    const report = JSON.parse(await readFile(join(root, 'runs', `${result.run}.json`), 'utf8'));
    expect(report.artifacts).toHaveLength(5);
    expect(await readFile(join(root, 'raw', report.artifacts[2].sha256), 'utf8')).toBe(
      JSON.stringify(data.get('tr4')),
    );
    const cli = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--experimental-strip-types',
          'src/ingestion/cli.ts',
          'read',
          '--store',
          root,
          '--series',
          'vf1',
        ],
        { encoding: 'utf8' },
      ),
    );
    expect(cli.observations).toHaveLength(12);
    expect(cli.snapshot).toBe(result.snapshot);
  });

  it('repetição sem mudança reutiliza observações, lote e accepted_at, inclusive decimal equivalente', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    const before = (await readState(root)).state;
    const vf1 = data.get('vf1') as { valor: string }[];
    vf1[0].valor += '0';
    const repeated = await ingest({ root, window, fetcher: fetcher(data) });
    const after = (await readState(root)).state;
    expect(repeated.changed).toBe(0);
    expect(repeated.batch).toBe(first.batch);
    expect(after.observations).toEqual(before.observations);
    expect(after.batches).toEqual(before.batches);
    expect(after.last_success?.run).toBe(repeated.run);
  });

  it('registra a nova janela sem duplicar o lote quando a fonte ainda retorna os mesmos períodos', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    const before = (await readState(root)).state;
    const extended = { from: window.from, to: '2026-03' };
    const repeated = await ingest({ root, window: extended, fetcher: fetcher(data, extended) });
    const after = (await readState(root)).state;
    expect(repeated.changed).toBe(0);
    expect(repeated.batch).toBe(first.batch);
    expect(after.observations).toEqual(before.observations);
    expect(after.batches).toEqual(before.batches);
    expect(after.last_success).toMatchObject({ run: repeated.run, window: extended });
    for (const command of ['read', 'status']) {
      const exported = JSON.parse(
        execFileSync(process.execPath, ['src/ingestion/cli.ts', command, '--store', root], {
          encoding: 'utf8',
        }),
      );
      expect(exported.last_success.window).toEqual(extended);
    }
    expect((await readState(root, first.snapshot)).state.last_success?.window).toEqual(window);
    await expect(
      ingest({ root, window, fetcher: async () => new Response('negado', { status: 403 }) }),
    ).rejects.toThrow('HTTP 403');
    expect((await readState(root)).state.last_success).toEqual(after.last_success);
  });

  it('lê snapshots antigos sem janela em last_success e inclui o campo na próxima coleta', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    const legacy = (await readState(root)).state;
    delete legacy.last_success?.window;
    const snapshot = await persist(root, legacy);
    const restored = await readState(root, snapshot);
    expect(expose(restored.state).last_success).not.toHaveProperty('window');
    const repeated = await ingest({ root, window, fetcher: fetcher(data) });
    expect(repeated).toMatchObject({ changed: 0, batch: first.batch });
    expect((await readState(root)).state.last_success?.window).toEqual(window);
  });

  it('detecta revisão histórica e retorno de valor sem perder versões ou snapshots', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    const vf1 = data.get('vf1') as { valor: string }[];
    const original = vf1[0].valor;
    vf1[0].valor = '99.01';
    expect((await ingest({ root, window, fetcher: fetcher(data) })).changed).toBe(1);
    vf1[0].valor = original;
    expect((await ingest({ root, window, fetcher: fetcher(data) })).changed).toBe(1);
    const { state } = await readState(root);
    const history = expose(state, 'vf1', true).observations.filter(
      (item) => item.reference_period.start === '2025-01-01',
    );
    expect(history).toHaveLength(3);
    expect(history[1]).toMatchObject({
      supersedes: history[0].id,
      revision_status: 'revised',
      value: '99.01',
    });
    expect(history[2].supersedes).toBe(history[1].id);
    expect(expose((await readState(root, first.snapshot)).state).observations).toHaveLength(40);
    expect(state.observations).toHaveLength(42);
  });

  it('falha de um recorte rejeita todo o lote e preserva último sucesso; mantém HTML original', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    const changed = data.get('tr4') as {
      resultados: { series: { serie: Record<string, string> }[] }[];
    }[];
    changed[0].resultados[0].series[0].serie['202501'] = '99.9';
    const normal = fetcher(data);
    const html = '<html>bloqueado</html>';
    const blocked: typeof fetch = async (input, init) =>
      String(input).includes('bcdata.sgs')
        ? new Response(html, { headers: { 'content-type': 'text/html' } })
        : normal(input, init);
    await expect(ingest({ root, window, fetcher: blocked })).rejects.toThrow('Content-Type');
    expect((await readState(root)).snapshot).toBe(first.snapshot);
    expect(await readFile(join(root, 'raw', digest(html)), 'utf8')).toBe(html);
    const status = JSON.parse(
      execFileSync(process.execPath, ['src/ingestion/cli.ts', 'status', '--store', root], {
        encoding: 'utf8',
      }),
    );
    expect(status.last_success.run).toBe(first.run);
    expect(status.latest_attempt.state).toBe('failed');
    expect(status.freshness).toBe('unknown');
  });

  it('rejeita omissão de período aceito em vez de manter silenciosamente o número anterior', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    (data.get('vf1') as unknown[]).shift();
    await expect(ingest({ root, window, fetcher: fetcher(data) })).rejects.toThrow('Lacuna');
    expect((await readState(root)).snapshot).toBe(first.snapshot);
  });

  it('impede dois escritores concorrentes e libera o lock depois da falha', async () => {
    let entered!: () => void;
    let resume!: () => void;
    const started = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      resume = resolve;
    });
    const first = ingest({
      root,
      window,
      fetcher: async () => {
        entered();
        await blocked;
        throw new Error('falha controlada');
      },
    });
    await started;
    await expect(ingest({ root, window, fetcher: fetcher(await payloads()) })).rejects.toThrow(
      'lock',
    );
    resume();
    await expect(first).rejects.toThrow('falha controlada');
    expect((await ingest({ root, window, fetcher: fetcher(await payloads()) })).changed).toBe(40);
  });

  it('detecta corrupção do snapshot antes de servir dados', async () => {
    const result = await ingest({ root, window, fetcher: fetcher(await payloads()) });
    await writeFile(join(root, 'snapshots', `${result.snapshot}.json`), '{}');
    await expect(readState(root)).rejects.toThrow('Checksum');
    await expect(readState(root, '../escape')).rejects.toThrow('Snapshot inválido');
  });

  it('falha ao gravar snapshot mantém a aceitação anterior recuperável', async () => {
    const data = await payloads();
    const first = await ingest({ root, window, fetcher: fetcher(data) });
    await expect(
      ingest({
        root,
        window,
        fetcher: fetcher(data),
        log: (event) => {
          if (event.event === 'validated') {
            renameSync(join(root, 'snapshots'), join(root, 'snapshots-before-fault'));
            writeFileSync(join(root, 'snapshots'), 'falha de armazenamento simulada');
          }
        },
      }),
    ).rejects.toThrow();
    await rm(join(root, 'snapshots'));
    await rename(join(root, 'snapshots-before-fault'), join(root, 'snapshots'));
    expect((await readState(root)).snapshot).toBe(first.snapshot);
    expect((await readState(root)).state.observations).toHaveLength(40);
  });

  it('primeira coleta rejeita lacunas internas e divergência entre medidas do IPCA', async () => {
    const data = await payloads();
    (data.get('vf1') as unknown[]).splice(3, 1);
    await expect(ingest({ root, window, fetcher: fetcher(data) })).rejects.toThrow('Lacuna');
    expect((await readState(root)).snapshot).toBeNull();
    const cv1 = (await payloads()).get('cv1') as {
      resultados: { series: { serie: Record<string, string> }[] }[];
    }[];
    data.set('vf1', (await payloads()).get('vf1'));
    delete cv1[1].resultados[0].series[0].serie['202512'];
    data.set('cv1', cv1);
    await expect(ingest({ root, window, fetcher: fetcher(data) })).rejects.toThrow(
      'cobertura divergente',
    );
  });
});

describe('falhas de transporte e limites', () => {
  it.each([429, 503])(
    'repete HTTP %s com limite e preserva a resposta da tentativa',
    async (status) => {
      const normal = fetcher(await payloads());
      let count = 0;
      const unstable: typeof fetch = async (input, init) =>
        ++count === 1 ? new Response('ocupado', { status }) : normal(input, init);
      const sleep = vi.fn(async () => {});
      const result = await ingest({ root, window, fetcher: unstable, sleep });
      expect(result.changed).toBe(40);
      expect(sleep).toHaveBeenCalledExactlyOnceWith(1000);
      expect(await readFile(join(root, 'raw', digest('ocupado')), 'utf8')).toBe('ocupado');
    },
  );

  it('timeout e falha de conexão esgotam tentativas sem aceitar dados', async () => {
    const failing = vi.fn<typeof fetch>(async () => {
      throw new DOMException('timeout', 'TimeoutError');
    });
    await expect(
      ingest({ root, window, fetcher: failing, attempts: 2, sleep: async () => {} }),
    ).rejects.toThrow('timeout');
    expect(failing).toHaveBeenCalledTimes(2);
    expect((await readState(root)).snapshot).toBeNull();
    const network = vi.fn<typeof fetch>(async () => {
      throw new TypeError('network');
    });
    await expect(ingest({ root, window, fetcher: network, attempts: 1 })).rejects.toThrow(
      'network',
    );
    expect(network).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Response('negado', { status: 403 }),
    new Response('{invalid', { headers: { 'content-type': 'application/json' } }),
  ])('não repete erro permanente ou JSON inválido', async (response) => {
    const failing = vi.fn<typeof fetch>(async () => response.clone());
    await expect(ingest({ root, window, fetcher: failing })).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it('CLI rejeita comandos, séries e opções inválidas e informa ausência de dados', () => {
    for (const args of [
      [],
      ['unknown'],
      ['fetch'],
      ['fetch', '--from', '2025-01', '--to', '2025-12', '--history'],
      ['read'],
      ['status', '--history'],
      ['read', '--unknown'],
    ]) {
      const result = spawnSync(
        process.execPath,
        ['src/ingestion/cli.ts', ...args, '--store', root],
        { encoding: 'utf8' },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('error');
    }
    expect(() => expose({} as never, 'unknown')).toThrow('Série desconhecida');
  });
});

describe('contratos de fonte e interpretação temporal', () => {
  it('mantém ausências SIDRA e zero absoluto, permite deflação e rejeita símbolos desconhecidos', async () => {
    const data = await payloads();
    const cv1 = data.get('cv1') as {
      resultados: { series: { serie: Record<string, string> }[] }[];
    }[];
    const entries = cv1[0].resultados[0].series[0].serie;
    Object.assign(entries, {
      '202501': '...',
      '202502': '..',
      '202503': 'X',
      '202504': '-',
      '202505': '-0.20',
    });
    const result = normalizeIbge(cv1, data.get('cv1-metadata'), [series[1], series[2]], window);
    expect(result.slice(0, 5).map((item) => [item.value, item.value_status])).toEqual([
      [null, 'missing'],
      [null, 'not_applicable'],
      [null, 'suppressed'],
      ['0', 'observed'],
      ['-0.2', 'observed'],
    ]);
    for (const invalid of ['NaN', 'constructor', '__proto__']) {
      entries['202501'] = invalid;
      expect(() =>
        normalizeIbge(cv1, data.get('cv1-metadata'), [series[1], series[2]], window),
      ).toThrow('Decimal');
    }
  });

  it('ausência explícita substitui valor atual mantendo histórico', async () => {
    const data = await payloads();
    await ingest({ root, window, fetcher: fetcher(data) });
    const tr4 = data.get('tr4') as {
      resultados: { series: { serie: Record<string, string> }[] }[];
    }[];
    tr4[0].resultados[0].series[0].serie['202501'] = '...';
    expect((await ingest({ root, window, fetcher: fetcher(data) })).changed).toBe(1);
    expect(expose((await readState(root)).state, 'tr4').observations[0]).toMatchObject({
      value: null,
      value_status: 'missing',
    });
  });

  it.each([
    'id',
    'unit',
    'geo',
    'classification',
    'quarter',
    'empty',
    'metadata',
    'frequency',
    'variable-count',
  ])('rejeita alteração de contrato IBGE: %s', async (kind) => {
    const data = await payloads();
    const tr4 = data.get('tr4') as {
      id: string;
      unidade: string;
      resultados: {
        classificacoes: unknown[];
        series: { localidade: { id: string }; serie: Record<string, string> }[];
      }[];
    }[];
    const meta = data.get('tr4-metadata') as {
      variaveis: { unidade: string }[];
      periodicidade: { frequencia: string };
    };
    if (kind === 'id') tr4[0].id = '4118';
    if (kind === 'unit') tr4[0].unidade = 'Reais';
    if (kind === 'geo') tr4[0].resultados[0].series[0].localidade.id = '35';
    if (kind === 'classification') tr4[0].resultados[0].classificacoes = [{}];
    if (kind === 'quarter') tr4[0].resultados[0].series[0].serie['202505'] = '8';
    if (kind === 'empty') tr4[0].resultados[0].series[0].serie = {};
    if (kind === 'metadata') meta.variaveis[0].unidade = 'Reais';
    if (kind === 'frequency') meta.periodicidade.frequencia = 'mensal';
    if (kind === 'variable-count') tr4.push(tr4[0]);
    expect(() => normalizeIbge(tr4, meta, [series[0]], window)).toThrow();
  });

  it.each(
    [
      [{ data: '02/01/2025', valor: '10' }],
      [{ data: '01/01/2025', valor: '101' }],
      [{ data: '01/01/2025', valor: '-' }],
      [{ data: '01/01/2025', valor: '10,1' }],
      [
        { data: '01/01/2025', valor: '10' },
        { data: '01/01/2025', valor: '10' },
      ],
      [
        { data: '01/02/2025', valor: '10' },
        { data: '01/01/2025', valor: '10' },
      ],
      [],
    ].map((rows) => ({ rows })),
  )('rejeita datas, duplicatas e valores BCB inválidos ($rows)', ({ rows }) => {
    expect(() => normalizeBcb(rows, series[3], window)).toThrow();
  });

  it('ano bissexto e janela parcial mantêm trimestre inteiro, mês e média móvel distintos', () => {
    const result = normalizeBcb([{ data: '01/02/2024', valor: '25.10' }], series[3], {
      from: '2024-01',
      to: '2024-03',
    });
    expect(result[0].reference_period).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
      label: '2024-02',
    });
    const urls = requests({ from: '2025-02', to: '2025-08' });
    expect(urls[2].url).toContain('/periodos/202502/');
    expect(urls[4].url).toContain('dataFinal=31/08/2025');
    for (const invalid of [
      { from: '2011-01', to: '2025-12' },
      { from: '2025-13', to: '2025-12' },
      { from: '2025-12', to: '2025-01' },
      { from: '2025-01', to: '2099-01' },
      { from: '2025-02', to: '2025-03' },
    ]) {
      expect(() => requests(invalid)).toThrow();
    }
  });
});
