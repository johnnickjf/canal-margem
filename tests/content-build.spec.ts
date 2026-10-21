import { execFile, spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import AxeBuilder from '@axe-core/playwright';
import { expect, type Route, test } from '@playwright/test';
import { site } from '../src/config/site';
import type { SearchItem } from '../src/lib/search';

const run = promisify(execFile);
// Astro's content loader uses the linked dependencies; isolate build executions.
test.describe.configure({ mode: 'serial' });
async function copySite(root: string, sandbox: string) {
  for (const entry of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
    await cp(path.join(root, entry), path.join(sandbox, entry), { recursive: true });
  }
  const catalog = 'backend/internal/publications';
  await mkdir(path.join(sandbox, catalog), { recursive: true });
  await cp(
    path.join(root, catalog, 'indicators.json'),
    path.join(sandbox, catalog, 'indicators.json'),
  );
  await symlink(path.join(root, 'node_modules'), path.join(sandbox, 'node_modules'), 'dir');
}

test('build da plataforma fixa publicação no HTML, preserva decimais e explicita lacunas', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  const root = process.cwd();
  const sandbox = await mkdtemp(path.join(tmpdir(), 'canal-margem-platform-'));
  const fixture = spawn(process.execPath, ['tests/fixtures/platform-api.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    const origin = await new Promise<string>((resolve, reject) => {
      fixture.stdout.once('data', (data) => resolve(String(data).trim()));
      fixture.once('error', reject);
      fixture.once('exit', () => reject(new Error('Fixture encerrou antes de iniciar')));
    });
    await copySite(root, sandbox);
    await run(process.execPath, [path.join(root, 'node_modules/astro/bin/astro.mjs'), 'build'], {
      cwd: sandbox,
      env: { ...process.env, MARGEM_API_URL: origin, ASTRO_TELEMETRY_DISABLED: '1' },
      timeout: 90_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const dist = path.join(sandbox, 'dist');
    const files = await readdir(dist, { recursive: true });
    const sitemap = await readFile(path.join(dist, 'sitemap-0.xml'), 'utf8');
    for (const route of [
      '',
      'tema/trabalho-e-renda',
      'tema/custo-de-vida',
      'tema/vida-financeira',
      'tema/qualidade-de-vida',
      'tema/economia-e-estado',
      'indicador/desemprego',
      'indicador/inflacao',
      'indicador/cesta-basica',
      'comparar',
      'entenda/como-ler-os-dados',
      'entenda',
      'entenda/inflacao',
      'entenda/divida-publica',
    ]) {
      const html = await readFile(path.join(dist, route, 'index.html'), 'utf8');
      if (route === 'entenda' || ['entenda/inflacao', 'entenda/divida-publica'].includes(route)) {
        expect(html).not.toContain('data-publication=');
        expect(html).toContain('Margem / Entenda');
      } else {
        expect(html).toContain(`data-publication="${'a'.repeat(64)}"`);
      }
      expect(sitemap).toContain(`https://margem.com.br/${route}`);
      const content = await page.evaluate((html) => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return {
          values: [...doc.querySelectorAll('.platform-value')].map(
            (element) => element.textContent,
          ),
          links: [...doc.querySelectorAll('a[href]')].map(
            (element) => element.getAttribute('href') ?? '',
          ),
          text: doc.querySelector('main')?.textContent,
          inputs: [...doc.querySelectorAll('.platform-inputs')].map((element) => ({
            text: element.textContent,
            observations: element.querySelectorAll('a[href*="/observations/"]').length,
          })),
        };
      }, html);
      if (route === '') {
        expect(content.text).toContain('O que você quer entender?');
        for (const theme of [
          'trabalho-e-renda',
          'custo-de-vida',
          'vida-financeira',
          'qualidade-de-vida',
          'economia-e-estado',
        ]) {
          expect(content.links).toContain(`/tema/${theme}`);
        }
      }
      for (const link of content.links) {
        if (link.includes('/api/v1/'))
          expect(new URL(link).searchParams.get('publication')).toBe('a'.repeat(64));
        if (link.startsWith('/') && !link.startsWith('//') && !link.includes('#')) {
          expect(files, `link local quebrado: ${link}`).toContain(
            path.extname(link)
              ? link.slice(1)
              : `${link.slice(1) ? `${link.slice(1)}/` : ''}index.html`,
          );
        }
      }
      if (route.startsWith('tema/')) {
        await page.setContent(html);
        await expect(page.getByRole('navigation', { name: 'Nesta página' })).toBeVisible();
        await expect(page.locator('#resumo')).toContainText('último período');
        await expect(page.locator('#entenda')).toContainText('não identifica sua causa');
        await expect(page.locator('#comparar a')).toHaveAttribute('href', '/comparar');
        if (route === 'tema/trabalho-e-renda') {
          const changes = page.locator('#mudancas');
          await expect(changes.locator('article')).toHaveCount(2);
          await expect(changes).toContainText('0,000000000000000001');
          await expect(changes).toContainText('Comparado ao período de 2024-01-01 a 2024-03-31');
          await expect(changes).not.toContainText('Índice de base 100');
          await changes.getByText('Conferir origem e método', { exact: true }).first().click();
          await expect(changes).toContainText('relative-change/2');
          await expect(changes.locator('a[href*="/api/v1/"]').first()).toHaveAttribute(
            'href',
            /publication=aaaaaaaa/,
          );
        } else {
          await expect(page.locator('#mudancas')).toContainText('não significa estabilidade');
        }
        if (route === 'tema/custo-de-vida') {
          const inflation = page.locator('#indicadores article').filter({
            has: page.getByRole('heading', { name: 'Inflação ao consumidor', exact: true }),
          });
          await inflation.getByText('Ver dados por recorte (1)', { exact: true }).click();
          await expect(inflation).toContainText('Input revisado');
          await expect(inflation.locator('.platform-value')).toHaveCount(0);
          const basket = page.locator('#indicadores article').filter({
            has: page.getByRole('heading', { name: 'Custo da cesta básica', exact: true }),
          });
          await basket.getByText('Ver dados por recorte (2)', { exact: true }).click();
          await expect(basket).toContainText('São Paulo');
          await expect(basket).toContainText('Recife');
          await expect(basket.locator('.platform-value')).toHaveCount(2);
          await expect(basket.locator('.platform-value').first()).toHaveText(
            '800,123456789012 R$/cesta',
          );
        }
      }
      if (route === 'indicador/desemprego') {
        expect(content.values[0]).toContain('0,000000000000000001');
        expect(content.text).toContain('Variação percentual');
        expect(content.text).toContain('Diferença absoluta');
        expect(content.text).toContain('Índice de base 100');
        expect(content.text).toContain('Comparado ao período de 2024-01-01 a 2024-03-31');
        expect(content.text).toContain('Base do índice (= 100): 2024-01-01/2024-03-31');
        expect(content.text).toContain('Fontes e observações usadas no cálculo');
        expect(content.inputs).toHaveLength(3);
        for (const input of content.inputs) {
          expect(input.observations).toBe(2);
          expect(input.text).toContain('Fonte: IBGE');
          expect(input.text).toContain('Dataset: fixture');
          expect(input.text).toContain('Coleta: 2026-10-18T12:00:00Z');
          expect(input.text).toContain('2024-01-01');
        }
        expect(content.links).toContain('https://www.ibge.gov.br/dados-desemprego');
        expect(
          content.links.some((link) => link.includes(`/observations/${'e'.repeat(64)}?`)),
        ).toBe(true);
      }
      if (route === 'indicador/inflacao') {
        expect(content.values).toHaveLength(0);
        expect(content.text).toContain('Input revisado');
      }
    }
    // Serve the actual generated HTML and assets through a browser with JavaScript disabled.
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 393, height: 851 },
    ]) {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport });
      const serveArtifact = async (route: Route) => {
        const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
        const file = path.join(dist, pathname, path.extname(pathname) ? '' : 'index.html');
        const contentType = file.endsWith('.css')
          ? 'text/css'
          : /\.m?js$/.test(file)
            ? 'text/javascript'
            : file.endsWith('.woff2')
              ? 'font/woff2'
              : file.endsWith('.svg')
                ? 'image/svg+xml'
                : 'text/html';
        await route.fulfill({ body: await readFile(file), contentType });
      };
      await context.route('http://indicator.test/**', serveArtifact);
      const accessibleContext = await browser.newContext({ javaScriptEnabled: true, viewport });
      await accessibleContext.route('http://indicator.test/**', serveArtifact);
      const accessiblePage = await accessibleContext.newPage();
      const rendered = await context.newPage();
      for (const slug of ['desemprego', 'inflacao', 'cesta-basica', 'rendimento-real']) {
        await rendered.goto(`http://indicator.test/indicador/${slug}/`);
        await expect(rendered.locator('h1')).toHaveCount(1);
        const navigation = rendered.getByRole('navigation', { name: 'Nesta página' });
        for (const id of ['aconteceu', 'significa', 'dados', 'relacionados']) {
          await navigation.locator(`a[href="#${id}"]`).click();
          await expect(rendered.locator(`#${id}`)).toBeInViewport();
        }
        const explanation = rendered.locator('#indicator-explanation-content');
        await expect(explanation).toBeVisible();
        await expect(explanation.locator('a[href^="/entenda/"]').first()).toBeVisible();
        if (slug === 'rendimento-real') {
          await expect(explanation).toContainText('Sem fonte de dados publicada');
        } else {
          await expect(explanation.locator('a[href="https://www.ibge.gov.br/"]')).toHaveText(
            'IBGE',
          );
        }
        if (slug === 'desemprego') {
          await expect(rendered.locator('.trend[data-direction="down"]')).toHaveCount(2);
          await expect(rendered.locator('main')).toContainText('current - previous');
          const history = rendered.locator('.indicator-history').first();
          await expect(history.locator('circle')).toHaveCount(2);
          await expect(history.locator('polyline')).toHaveCount(0);
          await history.locator('summary').focus();
          await rendered.keyboard.press('Enter');
          await expect(history.locator('tbody tr')).toHaveCount(3);
          await expect(history.locator('table')).toContainText('Sem observação na edição');
          await expect(history.locator('table')).toContainText('0,000000000000000002');
          await expect(history.locator('a[href*="/observations/"]').first()).toHaveAttribute(
            'href',
            /publication=aaaaaaaa/,
          );
          await history.scrollIntoViewIfNeeded();
          await testInfo.attach(`indicator-history-${viewport.width}.png`, {
            body: await rendered.screenshot({
              path: testInfo.outputPath(`indicator-history-${viewport.width}.png`),
            }),
            contentType: 'image/png',
          });
        }
        if (slug === 'inflacao') {
          await expect(rendered.locator('#aconteceu')).toContainText('Input revisado');
          await expect(rendered.locator('.platform-value')).toHaveCount(0);
          await expect(rendered.locator('.indicator-history circle')).toHaveCount(1);
        }
        if (slug === 'cesta-basica') {
          await expect(rendered.locator('.indicator-detail')).toHaveCount(2);
          await expect(rendered.locator('#aconteceu')).toContainText('São Paulo');
          await expect(rendered.locator('#aconteceu')).toContainText('Recife');
          await expect(rendered.locator('.indicator-history circle')).toHaveCount(2);
        }
        if (slug === 'rendimento-real') {
          await expect(rendered.locator('#dados')).toContainText('Sem cobertura nesta edição');
          await expect(rendered.locator('.indicator-history')).toHaveCount(0);
        }
        const layout = await rendered.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          viewport: innerWidth,
          overflowing: [...document.querySelectorAll('main *')]
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width > 0 && (rect.right > innerWidth + 1 || rect.left < -1);
            })
            .slice(0, 8)
            .map((element) => ({
              tag: element.tagName,
              class: element.className,
              text: element.textContent?.slice(0, 100),
              dimensions: [element, element.parentElement, element.parentElement?.parentElement]
                .filter(Boolean)
                .map((node) => {
                  const element = node as Element;
                  const style = getComputedStyle(element);
                  return {
                    tag: element.tagName,
                    class: element.className,
                    width: element.getBoundingClientRect().width,
                    columns: style.gridTemplateColumns,
                    overflowWrap: style.overflowWrap,
                    minWidth: style.minWidth,
                  };
                }),
            })),
        }));
        expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
        await accessiblePage.goto(rendered.url());
        await accessiblePage
          .getByRole('link', { name: 'Entenda este indicador', exact: true })
          .click();
        const drawer = accessiblePage.getByRole('dialog', { name: /^Entenda:/ });
        await expect(drawer).toBeVisible();
        expect((await new AxeBuilder({ page: accessiblePage }).analyze()).violations).toEqual([]);
        await accessiblePage.keyboard.press('Escape');
        for (const summary of await accessiblePage.locator('.history-table summary').all())
          await summary.click();
        expect((await new AxeBuilder({ page: accessiblePage }).analyze()).violations).toEqual([]);
      }
      await accessibleContext.close();
      await context.close();
    }
  } finally {
    fixture.kill();
    await rm(sandbox, { recursive: true, force: true });
  }
});
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
    await copySite(root, sandbox);
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
        env: { ...process.env, MARGEM_API_URL: '', ASTRO_TELEMETRY_DISABLED: '1' },
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
