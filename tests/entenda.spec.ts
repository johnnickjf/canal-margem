import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const slugs = [
  'inflacao',
  'renda-real',
  'renda-nominal',
  'pib',
  'pib-per-capita',
  'divida-publica',
  'deficit',
  'juros',
  'selic',
  'informalidade',
  'desigualdade',
];

test.describe('Entenda sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('índice liga os 11 conceitos, temas e indicadores sem perder o guia existente', async ({
    page,
  }) => {
    await page.goto('/');
    const mobileMenu = page.getByText('Explorar dados', { exact: true });
    if (await mobileMenu.isVisible()) await mobileMenu.click();
    await page
      .getByRole('navigation', { name: 'Dados e indicadores' })
      .getByRole('link', { name: 'Entenda os dados' })
      .click();
    await expect(page.locator('h1')).toHaveText('Entenda a economia');
    await expect(page.locator('.platform-card')).toHaveCount(11);
    for (const slug of slugs)
      await expect(page.locator(`main a[href="/entenda/${slug}"]`)).toBeVisible();
    await page
      .getByRole('link', { name: 'Como ler os dados e suas limitações', exact: true })
      .click();
    await expect(page.locator('h1')).toHaveText('Como ler os dados');
    await page.goto('/tema/custo-de-vida');
    await page.locator('#entenda').getByRole('link', { name: 'Inflação', exact: true }).click();
    await page
      .locator('#indicadores')
      .getByRole('link', { name: 'Inflação ao consumidor', exact: true })
      .click();
    await page.getByRole('link', { name: 'Entenda este indicador', exact: true }).click();
    await expect(page).toHaveURL(/#indicator-explanation-content$/);
    await page
      .locator('#indicator-explanation-content')
      .getByRole('link', { name: 'Inflação', exact: true })
      .click();
    await expect(page.locator('h1')).toHaveText('Inflação');
  });

  for (const slug of slugs) {
    test(`conceito completo, rastreável e acessível: ${slug}`, async ({ page }) => {
      await page.goto(`/entenda/${slug}`);
      await expect(page.locator('h1')).toHaveCount(1);
      for (const id of [
        'conceito',
        'importancia',
        'interpretacao',
        'erros',
        'indicadores',
        'aprofundar',
        'fontes',
      ]) {
        await expect(page.locator(`#${id}`)).toBeVisible();
        await expect(page.locator(`#${id}`)).not.toBeEmpty();
      }
      await expect(page.getByRole('complementary', { name: 'Exemplo hipotético' })).toContainText(
        'não é um dado observado',
      );
      await expect(page.locator('#fontes time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
      await expect(page.locator('#fontes a').first()).toHaveAttribute('href', /^https:\/\//);
      await expect(page.locator('#indicadores a').first()).toHaveAttribute(
        'href',
        /^\/indicador\//,
      );
      if (['divida-publica', 'deficit', 'selic', 'juros'].includes(slug)) {
        await expect(page.locator('#indicadores')).toContainText(
          'não tem uma série própria no MVP',
        );
      }
      const url = `https://margem.com.br/entenda/${slug}/`;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url);
      await expect(page).toHaveTitle(`${await page.locator('h1').textContent()} | MARGEM`);
      for (const selector of [
        'meta[name="description"]',
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
      ]) {
        await expect(page.locator(selector)).toHaveAttribute(
          'content',
          await page.locator('.platform-intro').innerText(),
        );
      }
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', url);
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
      const schema = JSON.parse(
        (await page.locator('script[type="application/ld+json"]').textContent()) ?? '',
      );
      expect(schema[0]['@type']).toBe('BreadcrumbList');
      expect(schema[0].itemListElement[2].item).toBe(url);
      expect(schema[1]['@type']).toBe('DefinedTerm');
      expect(schema[1].description).toBe(await page.locator('#conceito p').innerText());
      expect(schema[1].subjectOf.citation).toEqual(
        await page
          .locator('#fontes a')
          .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href)),
      );
      for (const href of await page
        .locator('main a[href^="/"]')
        .evaluateAll((links) => [
          ...new Set(links.map((link) => link.getAttribute('href') ?? '')),
        ])) {
        const response = await page.request.get(href);
        expect(response.status(), href).toBe(200);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }

  test('índice tem SEO, dados estruturados e sitemap com todas as explicações', async ({
    page,
  }) => {
    await page.goto('/entenda');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://margem.com.br/entenda/',
    );
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    const sitemap = await readFile('dist/sitemap-0.xml', 'utf8');
    for (const route of [
      'entenda',
      'entenda/como-ler-os-dados',
      ...slugs.map((slug) => `entenda/${slug}`),
    ]) {
      expect(sitemap).toContain(`https://margem.com.br/${route}/`);
    }
    const robots = await readFile('dist/robots.txt', 'utf8');
    expect(robots).toContain('Sitemap: https://margem.com.br/sitemap-index.xml');
    expect(robots).not.toMatch(/Disallow:\s*\/(?:entenda)?\s*$/m);
  });
});

for (const slug of ['', ...slugs]) {
  test(`Entenda tem acessibilidade automática e largura adequada: ${slug || 'índice'}`, async ({
    page,
  }) => {
    await page.goto(`/entenda/${slug}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('painel contextual mantém a página, contém foco e permite auditar os dados', async ({
  page,
}, testInfo) => {
  await page.goto('/indicador/inflacao');
  await expect(page.locator('[data-ui-dialog-shell]')).toHaveAttribute('data-ready', 'true');
  const trigger = page.getByRole('link', { name: 'Entenda este indicador', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const drawer = page.getByRole('dialog', { name: 'Entenda: Inflação ao consumidor', exact: true });
  await expect(drawer).toBeVisible();
  await expect(drawer.locator('[data-ui-dialog-heading]')).toBeFocused();
  await expect(page).toHaveURL(/\/indicador\/inflacao\/?$/);
  for (const title of [
    'O que mede',
    'Por que importa',
    'Como interpretar',
    'Cuidados na leitura',
    'Fontes dos dados',
    'Conceitos para entender este indicador',
    'Indicadores relacionados',
  ]) {
    await expect(drawer.getByRole('heading', { name: title, exact: true })).toBeVisible();
  }
  await expect(drawer).toContainText('Inflação menor não significa preços menores');
  await page.keyboard.press('Shift+Tab');
  expect(await drawer.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('entenda-drawer.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer.getByRole('button', { name: /Fechar/ }).click();
  await expect(drawer).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await drawer
    .getByRole('link', { name: 'Conferir dados, fontes e metodologia por recorte', exact: true })
    .click();
  await expect(drawer).toBeHidden();
  await expect(page).toHaveURL(/#dados$/);
  await expect(page.locator('#dados')).toBeFocused();
  await page.goto('/indicador/inflacao#indicator-explanation-content');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('link', { name: 'Inflação', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Inflação');
  await page.screenshot({ path: testInfo.outputPath('entenda-concept.png'), fullPage: true });
});
