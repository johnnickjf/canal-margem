import { mkdtemp, open, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ingest } from '../../../src/ingestion/pipeline.ts';
import { digest, immutable, readState } from '../../../src/ingestion/store.ts';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return { ...actual, open: vi.fn(actual.open) };
});

const actualFs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
let root: string;
beforeEach(async () => {
  vi.mocked(open).mockImplementation(actualFs.open);
  root = await mkdtemp(join(tmpdir(), 'margem-store-test-'));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});

describe('artefatos imutáveis', () => {
  it.each(['writeFile', 'sync'] as const)(
    'a coleta se recupera de falha em %s sem deixar raw definitivo incompleto',
    async (operation) => {
      let interrupted = false;
      vi.mocked(open).mockImplementation(async (path, flags, mode) => {
        const handle = await actualFs.open(path, flags, mode);
        if (!interrupted && String(path).startsWith(`${join(root, 'raw')}/`)) {
          interrupted = true;
          const write = handle.writeFile.bind(handle);
          vi.spyOn(handle, operation).mockImplementationOnce(async () => {
            if (operation === 'writeFile') await write('partial');
            throw Object.assign(new Error('Falha de disco simulada'), { code: 'ENOSPC' });
          });
        }
        return handle;
      });
      const location = new URL('../../../docs/systems/evidence/ingestion/', import.meta.url);
      const verification = JSON.parse(
        await readFile(new URL('verification.json', location), 'utf8'),
      );
      const artifacts = verification.runs[2].artifacts as {
        url: string;
        preserved_file: string;
      }[];
      const replay: typeof fetch = async (input) => {
        const artifact = artifacts.find((item) => item.url === String(input));
        if (!artifact) throw new Error('URL fora da captura oficial');
        return new Response(
          new Uint8Array(await readFile(new URL(artifact.preserved_file, location))),
          {
            headers: { 'content-type': 'application/json' },
          },
        );
      };
      const options = { root, window: { from: '2012-01', to: '2026-10' }, fetcher: replay };
      await expect(ingest(options)).rejects.toThrow('Falha de disco simulada');
      expect(interrupted).toBe(true);
      expect(await readdir(join(root, 'raw'))).toEqual([]);
      expect((await readState(root)).snapshot).toBeNull();
      expect((await ingest(options)).changed).toBe(587);
      for (const artifact of await readdir(join(root, 'raw'))) {
        expect(digest(await readFile(join(root, 'raw', artifact)))).toBe(artifact);
      }
    },
  );

  it('reutiliza bytes iguais e rejeita bytes divergentes sem substituir o artefato', async () => {
    const path = join(root, 'artifact');
    await immutable(path, 'original');
    await immutable(path, Buffer.from('original'));
    await expect(immutable(path, 'different')).rejects.toThrow('Conflito em artefato imutável');
    expect(await readFile(path, 'utf8')).toBe('original');
    expect(await readdir(root)).toEqual(['artifact']);
  });

  it('duas gravações concorrentes deixam apenas um artefato completo, sem sobrescrita', async () => {
    const path = join(root, 'artifact');
    const results = await Promise.allSettled([
      immutable(path, 'first complete body'),
      immutable(path, 'second complete body'),
    ]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')).toHaveLength(1);
    expect(['first complete body', 'second complete body']).toContain(await readFile(path, 'utf8'));
    expect(await readdir(root)).toEqual(['artifact']);
  });
});
