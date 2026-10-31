import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPublication } from '../../scripts/build-publication.mjs';

const publication = 'a'.repeat(64);
const tempRoots: string[] = [];
async function outputRoot() {
  const path = await mkdtemp(join(tmpdir(), 'margem-publication-test-'));
  tempRoots.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
function requestFor(...editions: object[]) {
  let index = 0;
  return vi.fn<typeof fetch>(async () => Response.json(editions[index++] ?? editions.at(-1)));
}
function writeSite(id: string) {
  return async (site: string) => {
    await mkdir(join(site, 'auditoria'), { recursive: true });
    await writeFile(
      join(site, 'auditoria', 'index.html'),
      `<aside data-publication="${id}"></aside>`,
    );
  };
}
const edition = { generation: 6, publication };

describe('build isolado de publicação', () => {
  it('marca o artefato pronto somente quando HTML e geração permanecem coerentes', async () => {
    const root = await outputRoot();
    const request = requestFor(edition, edition);
    const result = await buildPublication({
      api: 'http://localhost:8080',
      outputRoot: root,
      request,
      build: writeSite(publication),
    });
    expect(result.generation).toBe(6);
    expect(JSON.parse(await readFile(join(result.directory, 'ready.json'), 'utf8'))).toEqual(
      edition,
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('não libera o artefato se a geração mudar, mesmo com a mesma publicação', async () => {
    const root = await outputRoot();
    await expect(
      buildPublication({
        api: 'http://localhost:8080',
        outputRoot: root,
        request: requestFor(edition, { ...edition, generation: 7 }),
        build: writeSite(publication),
      }),
    ).rejects.toThrow('mudou durante o build');
    const [directory] = await readdir(root);
    await expect(readFile(join(root, directory, 'ready.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('rejeita HTML de outra edição sem marcar o artefato como pronto', async () => {
    const root = await outputRoot();
    await expect(
      buildPublication({
        api: 'http://localhost:8080',
        outputRoot: root,
        request: requestFor(edition),
        build: writeSite('b'.repeat(64)),
      }),
    ).rejects.toThrow('HTML gerado');
    const [directory] = await readdir(root);
    await expect(readFile(join(root, directory, 'ready.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('rejeita outra publicação em uma página diferente da auditoria', async () => {
    const root = await outputRoot();
    const build = async (site: string) => {
      await writeSite(publication)(site);
      await writeFile(
        join(site, 'index.html'),
        `<aside data-publication="${'b'.repeat(64)}"></aside>`,
      );
    };
    await expect(
      buildPublication({
        api: 'http://localhost:8080',
        outputRoot: root,
        request: requestFor(edition),
        build,
      }),
    ).rejects.toThrow('contém outra publicação');
    const [directory] = await readdir(root);
    await expect(readFile(join(root, directory, 'ready.json'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
  it('recusa API ausente ou com falha antes de gerar artefato', async () => {
    const root = await outputRoot();
    const build = vi.fn(writeSite(publication));
    await expect(
      buildPublication({ api: 'https://user:secret@example.com', outputRoot: root, build }),
    ).rejects.toThrow('sem credenciais');
    await expect(
      buildPublication({
        api: 'http://localhost:8080',
        outputRoot: root,
        request: vi.fn(async () => new Response('', { status: 503 })),
        build,
      }),
    ).rejects.toThrow('HTTP 503');
    expect(build).not.toHaveBeenCalled();
    expect(await readdir(root)).toEqual([]);
  });
  it('não libera artefatos após falha do build ou da verificação final da API', async () => {
    const root = await outputRoot();
    await expect(
      buildPublication({
        api: 'http://localhost:8080',
        outputRoot: root,
        request: requestFor(edition),
        build: async () => {
          throw new Error('build interrompido');
        },
      }),
    ).rejects.toThrow('build interrompido');
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json(edition))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(
      buildPublication({
        api: 'http://localhost:8080',
        outputRoot: root,
        request,
        build: writeSite(publication),
      }),
    ).rejects.toThrow('HTTP 503');
    for (const directory of await readdir(root)) {
      await expect(readFile(join(root, directory, 'ready.json'))).rejects.toMatchObject({
        code: 'ENOENT',
      });
    }
  });
});
