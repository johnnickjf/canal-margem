import { execFile } from 'node:child_process';
import { cp, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import { site } from '../src/config/site';
import type { SearchItem } from '../src/lib/search';

const run = promisify(execFile);
const fixtures = [
  { id: 'qa-published-episode', collection: 'videos', format: 'longo', draft: false },
  { id: 'qa-draft-episode', collection: 'videos', format: 'longo', draft: true },
  { id: 'qa-published-cut', collection: 'videos', format: 'corte', draft: false },
  { id: 'qa-draft-cut', collection: 'videos', format: 'corte', draft: true },
  { id: 'qa-published-article', collection: 'analises', draft: false },
  { id: 'qa-draft-article', collection: 'analises', draft: true },
] as const;

test('build exclui rascunhos de páginas, busca e sitemap e mantém o RSS consistente', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const root = process.cwd();
  const sandbox = await mkdtemp(path.join(tmpdir(), 'canal-margem-content-'));
  try {
    for (const entry of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
      await cp(path.join(root, entry), path.join(sandbox, entry), { recursive: true });
    }
    await symlink(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), 'dir');
    for (const fixture of fixtures) {
      const video = fixture.collection === 'videos';
      const frontmatter = [
        '---',
        `title: "${fixture.id} [ação & edição]"`,
        `dek: "Descrição de ${fixture.id} com ação & contexto."`,
        'tema: trabalho',
        'cover: estacao-lotada',
        `draft: ${fixture.draft}`,
        // Um rascunho recente e destacado também não deve substituir a última edição.
        'featured: true',
        `publishedAt: ${fixture.draft ? '2099-01-01' : video ? '2026-10-04' : '2026-10-05'}`,
        ...(video
          ? [
              'episode: 900',
              `format: ${fixture.format}`,
              'duration: "01:02"',
              ...(fixture.format === 'corte' ? ['parent: qa-published-episode'] : []),
            ]
          : ['author: "Redação de teste"']),
        '---',
        `Conteúdo de teste: ${fixture.id}.`,
      ].join('\n');
      await writeFile(
        path.join(sandbox, 'src/content', fixture.collection, `${fixture.id}.md`),
        frontmatter,
      );
    }
    const { stdout, stderr } = await run(
      process.execPath,
      [path.join(root, 'node_modules/astro/bin/astro.mjs'), 'build'],
      {
        cwd: sandbox,
        env: { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' },
        timeout: 90_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
    await testInfo.attach('isolated-build.log', {
      body: stdout + stderr,
      contentType: 'text/plain',
    });
    const dist = path.join(sandbox, 'dist');
    const files = await readdir(dist, { recursive: true });
    const artifacts = await Promise.all(
      files
        .filter((file) => /\.html$|\.xml$|^busca\.json$/.test(file))
        .map(async (file) => ({ file, text: await readFile(path.join(dist, file), 'utf8') })),
    );
    const index = JSON.parse(await readFile(path.join(dist, 'busca.json'), 'utf8')) as SearchItem[];
    const sitemap = artifacts
      .filter(({ file }) => /^sitemap.*\.xml$/.test(file))
      .map(({ text }) => text)
      .join('\n');

    for (const fixture of fixtures) {
      const url = `/${fixture.collection}/${fixture.id}`;
      const file = `${fixture.collection}/${fixture.id}/index.html`;
      if (fixture.draft) {
        expect(files).not.toContain(file);
        for (const artifact of artifacts) {
          expect(artifact.text.includes(fixture.id), `${artifact.file} vazou ${fixture.id}`).toBe(
            false,
          );
        }
      } else {
        expect(files).toContain(file);
        expect(index.find((item) => item.url === url)?.title).toBe(`${fixture.id} ação & edição`);
        expect(sitemap).toContain(`${site.url}${url}`);
        const text = await page.evaluate(
          (source) =>
            new DOMParser().parseFromString(source, 'text/html').querySelector('main')?.textContent,
          await readFile(path.join(dist, file), 'utf8'),
        );
        expect(text).toContain(fixture.id);
        if (fixture.collection === 'analises' || fixture.format === 'longo') {
          expect(text).toContain(`Conteúdo de teste: ${fixture.id}`);
        }
      }
    }

    const xml = await readFile(path.join(dist, 'rss.xml'), 'utf8');
    const feed = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'application/xml');
      const channel = doc.querySelector('channel');
      return {
        error: doc.querySelector('parsererror')?.textContent,
        title: channel?.querySelector('title')?.textContent,
        description: channel?.querySelector('description')?.textContent,
        language: channel?.querySelector('language')?.textContent,
        items: [...doc.querySelectorAll('item')].map((item) => ({
          title: item.querySelector('title')?.textContent ?? '',
          description: item.querySelector('description')?.textContent ?? '',
          link: item.querySelector('link')?.textContent ?? '',
          date: item.querySelector('pubDate')?.textContent ?? '',
        })),
      };
    }, xml);
    expect(feed.error).toBeUndefined();
    expect(feed.title).toBe(`${site.name} — ${site.signature.join(' / ')}`);
    expect(feed.description).toBe(site.description);
    expect(feed.language).toBe('pt-br');
    const expected = index.filter((item) => item.type === 'Episódio' || item.type === 'Análise');
    expect(feed.items.map((item) => item.link).sort()).toEqual(
      expected.map((item) => new URL(`${item.url.replace(/\/$/, '')}/`, site.url).href).sort(),
    );
    expect(new Set(feed.items.map((item) => item.link)).size).toBe(feed.items.length);
    const dates = feed.items.map((item) => Date.parse(item.date));
    expect(dates.every(Number.isFinite)).toBe(true);
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    for (const item of feed.items) {
      const url = new URL(item.link);
      const entry = expected.find((candidate) => candidate.url === url.pathname.replace(/\/$/, ''));
      expect(entry).toBeDefined();
      if (!entry) throw new Error(`RSS sem publicação correspondente: ${item.link}`);
      const title =
        entry.type === 'Episódio'
          ? `${entry.meta.match(/^M \/ \d+/)?.[0]} — ${entry.title}`
          : entry.title;
      expect(item.title).toBe(title);
      const html = await readFile(path.join(dist, url.pathname.slice(1), 'index.html'), 'utf8');
      const metadata = await page.evaluate((source) => {
        const doc = new DOMParser().parseFromString(source, 'text/html');
        return {
          description: doc.querySelector('meta[name="description"]')?.getAttribute('content'),
          date: doc
            .querySelector('meta[property="article:published_time"]')
            ?.getAttribute('content'),
          canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        };
      }, html);
      expect(item.description).toBe(metadata.description);
      expect(item.link).toBe(metadata.canonical);
      expect(Date.parse(item.date)).toBe(Date.parse(metadata.date ?? ''));
    }
    const published = feed.items.find((item) => item.link.endsWith('/qa-published-article/'));
    expect(published?.title).toBe('qa-published-article ação & edição');
    expect(Date.parse(published?.date ?? '')).toBe(Date.parse('2026-10-05T00:00:00Z'));
    expect(xml).not.toContain('qa-published-cut');
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
});
