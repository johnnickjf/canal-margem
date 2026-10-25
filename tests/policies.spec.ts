import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import raw from '../src/data/policies.json' with { type: 'json' };

for (const route of ['/politicas', ...raw.policies.map((policy) => `/politicas/${policy.id}`)]) {
  test(`políticas têm conteúdo, fontes e SEO: ${route}`, async ({ page, browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: page.viewportSize(),
    });
    const rendered = await context.newPage();
    await rendered.goto(route);
    await expect(rendered.locator('h1')).toHaveCount(1);
    await expect(rendered.locator('main')).toContainText('causal');
    await expect(rendered.locator('main')).toContainText(raw.revision);
    for (const href of await rendered
      .locator('main a[href^="#"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))) {
      await expect(rendered.locator(href)).toHaveCount(1);
    }
    if (route !== '/politicas') {
      await expect(rendered.locator('#legislacao a[href^="https://"]')).not.toHaveCount(0);
      await expect(rendered.locator('#vigencias')).toContainText('fim em aberto');
      await expect(rendered.locator('#indicadores')).toContainText('Sem dados publicados');
      await expect(rendered.locator('.history-line')).toHaveCount(0);
    }
    await expect(rendered.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://margem.com.br${route}/`,
    );
    await expect(rendered.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(rendered.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://margem.com.br${route}/`,
    );
    await expect(rendered.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    const schema = JSON.parse(
      await rendered.locator('script[type="application/ld+json"]').innerText(),
    );
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement[1].item).toBe(`https://margem.com.br${route}/`);
    expect(await readFile('dist/sitemap-0.xml', 'utf8')).toContain(`https://margem.com.br${route}`);
    expect(await rendered.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto(route);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await context.close();
  });
}

test('indicador, política, fontes e catálogo navegam sem JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/indicador/desemprego');
  await page.locator('#politicas a[href="/politicas/reforma-trabalhista-2017"]').click();
  await expect(page.locator('#legislacao')).toContainText('2017-07-13');
  await expect(page.locator('#legislacao')).toContainText('2017-07-14');
  await expect(page.locator('#vigencias')).toContainText('2017-11-11');
  await page.locator('#governos a').click();
  await expect(page.locator('#temer-efetivo')).toBeInViewport();
  const catalog = await context.request.get('/politicas/catalogo.json');
  expect(catalog.ok()).toBe(true);
  expect(await catalog.json()).toEqual(raw);
  const robots = await context.request.get('/robots.txt');
  expect(await robots.text()).not.toContain('Disallow: /politicas');
  await context.close();
});

test('busca encontra políticas com filtro e abre a legislação', async ({ page }) => {
  await page.goto('/busca?q=reforma&tipo=politicas');
  const results = page.locator('[data-search-results]');
  await expect(results.locator('.result__type')).toHaveText(['Política', 'Política']);
  await results.locator('a[href="/politicas/reforma-previdenciaria-2019"]').click();
  await expect(page.locator('#vigencias')).toContainText('2020-03-01');
  await expect(page.locator('#legislacao')).toContainText('Art');
});
