import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { assert } from './catalog.ts';
import { ingest } from './pipeline.ts';
import { encode, expose, readState } from './store.ts';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      store: { type: 'string', default: '.data/ingestion' },
      from: { type: 'string' },
      to: { type: 'string' },
      series: { type: 'string' },
      snapshot: { type: 'string' },
      history: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(
      'ingestion <fetch|read|status> [--store DIRETÓRIO]\nfetch --from YYYY-MM --to YYYY-MM\nread [--series tr4|cv1-monthly|cv1-12m|vf1] [--history] [--snapshot HASH]\n',
    );
  } else {
    assert(positionals.length === 1, 'Informe fetch, read ou status; consulte --help');
    const command = positionals[0];
    const root = resolve(values.store);
    if (command === 'fetch') {
      assert(values.from && values.to, 'fetch exige --from e --to explícitos');
      assert(!values.series && !values.snapshot && !values.history, 'Opção incompatível com fetch');
      const result = await ingest({
        root,
        window: { from: values.from, to: values.to },
        log: (event) => process.stderr.write(`${JSON.stringify(event)}\n`),
      });
      process.stdout.write(encode(result));
    } else if (command === 'read' || command === 'status') {
      assert(!values.from && !values.to, 'from/to pertencem a fetch');
      assert(
        command !== 'status' || (!values.series && !values.snapshot && !values.history),
        'Opção incompatível com status',
      );
      const { snapshot, state } = await readState(root, values.snapshot);
      if (command === 'read') {
        assert(snapshot, 'Sem dados aceitos; execute fetch');
        process.stdout.write(encode({ snapshot, ...expose(state, values.series, values.history) }));
      } else {
        let latestAttempt: unknown = null;
        try {
          const files = (await readdir(join(root, 'runs')))
            .filter((file) => file.endsWith('.json'))
            .sort();
          if (files.length)
            latestAttempt = JSON.parse(
              await readFile(join(root, 'runs', files.at(-1) as string), 'utf8'),
            );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
        process.stdout.write(
          encode({
            snapshot,
            last_success: state.last_success,
            latest_attempt: latestAttempt,
            freshness: 'unknown',
            freshness_note:
              'Coleta bem-sucedida não comprova atualização segundo o calendário da fonte.',
          }),
        );
      }
    } else {
      throw new Error(`Comando desconhecido: ${command}`);
    }
  }
} catch (error) {
  process.stderr.write(`${encode({ error: String(error) })}`);
  process.exitCode = 1;
}
