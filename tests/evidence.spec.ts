import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import raw from '../src/data/evidence.json' with { type: 'json' };

for (const route of ['/evidencias', ...raw.studies.map((study) => `/evidencias/${study.id}`)]) {
  test(`evidência acessível sem JavaScript e com SEO: ${route}`, async ({
    page,
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: page.viewportSize(),
    });
    const rendered = await context.newPage();
    await rendered.goto(route);
    await expect(rendered.locator('h1')).toHaveCount(1);
    await expect(rendered.locator('main')).toContainText('Aconteceu durante');
    await expect(rendered.locator('main')).toContainText(raw.revision);
    for (const href of await rendered
      .locator('main a[href^="#"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''))) {
      await expect(rendered.locator(href)).toHaveCount(1);
    }
    const study = raw.studies.find((study) => route.endsWith(`/${study.id}`));
    if (study) {
      await expect(rendered.locator('#fontes a[href^="https://"]')).toHaveCount(
        study.sources.length,
      );
      await expect(rendered.locator('#limites')).toContainText(study.finding);
      if (study.assessment.classification === 'causal-estimate') {
        await expect(rendered.locator('#metodo')).toContainText('Tendências paralelas');
        await expect(rendered.locator('#metodo')).toContainText('não reproduziu');
      }
      if (study.policies[0].applicability === 'historical-program') {
        await expect(rendered.locator('#vinculos')).toContainText('não avalia a lei de 2023');
      }
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
    if (route.endsWith('2009-2013'))
      await rendered.screenshot({ path: testInfo.outputPath('evidencia.png'), fullPage: true });
    await context.close();
  });
}

test('indicador, estudo histórico, política e catálogo navegam sem JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/indicador/inseguranca-alimentar');
  await page
    .locator('#evidencias a[href="/evidencias/bolsa-familia-inseguranca-2009-2013"]')
    .click();
  await expect(page.locator('#vinculos')).toContainText('Programa histórico');
  await page.locator('#vinculos a[href="/politicas/bolsa-familia-2023"]').click();
  await expect(page.locator('#evidencias')).toContainText('não avalia a lei de 2023');
  await expect(page.locator('#evidencias li')).toHaveCount(3);
  await page.goto('/indicador/desemprego');
  await expect(page.locator('#evidencias')).toContainText('Nenhum estudo relacionado');
  const catalog = await context.request.get('/evidencias/catalogo.json');
  expect(catalog.ok()).toBe(true);
  expect(await catalog.json()).toEqual(raw);
  expect(await (await context.request.get('/robots.txt')).text()).not.toContain(
    'Disallow: /evidencias',
  );
  await context.close();
});

test('busca filtra estudos sem misturar políticas ou indicadores', async ({ page }) => {
  await page.goto('/busca?q=insegurança&tipo=estudos');
  await expect(page.locator('[data-search-results] .result__type')).toHaveText(['Estudo']);
  await page.locator('[data-search-results] a').click();
  await expect(page.locator('#metodo')).toContainText('Estimativa causal condicionada');
});
