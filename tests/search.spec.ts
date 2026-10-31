import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const queries = [
  { word: 'comida', slugs: ['inflacao-alimentacao', 'cesta-basica', 'inseguranca-alimentar'] },
  { word: 'gasolina', slugs: ['gasolina'] },
  { word: 'salário', slugs: ['rendimento-real', 'salario-minimo-real'] },
  { word: 'aluguel', slugs: ['onus-aluguel'] },
  { word: 'dívida', slugs: ['comprometimento-renda', 'vf2'] },
];

for (const { word, slugs } of queries) {
  test(`busca cotidiana encontra e abre indicadores: ${word}`, async ({ page }) => {
    await page.goto(`/busca?q=${encodeURIComponent(word)}`);
    const results = page.locator('[data-search-results]');
    await expect(page.getByRole('status')).toContainText(/\d+ resultados? para/);
    for (const slug of slugs)
      await expect(results.locator(`a[href="/indicador/${slug}"]`)).toBeVisible();
    await expect(results.locator('li').first().locator('.result__type')).toHaveText('Indicador');
    await results.locator(`a[href="/indicador/${slugs[0]}"]`).click();
    await expect(page).toHaveURL(new RegExp(`/indicador/${slugs[0]}/?$`));
    await expect(page.locator('#dados')).toBeVisible();
  });
}

test('filtros, exemplos e envio pelo teclado mantêm consulta e URL coerentes', async ({ page }) => {
  await page.goto('/busca');
  await page.evaluate(() => document.fonts.ready);
  const placeholderFits = await page.getByRole('searchbox').evaluate((input: HTMLInputElement) => {
    const style = getComputedStyle(input);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return false;
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return context.measureText(input.placeholder.toUpperCase()).width <= input.clientWidth;
  });
  expect(placeholderFits).toBe(true);
  await page.getByRole('link', { name: 'dívida', exact: true }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('dívida');
  const type = page.getByLabel('Buscar em', { exact: true });
  await type.selectOption('entenda');
  await expect(page.locator('[data-search-results] .result__type').first()).toHaveText('Entenda');
  await expect(
    page.locator('[data-search-results] a[href="/entenda/divida-publica"]'),
  ).toBeVisible();
  expect(await page.locator('[data-search-results] .result__type').allTextContents()).not.toContain(
    'Indicador',
  );
  await expect(page).toHaveURL(/tipo=entenda/);
  await page.reload();
  await expect(type).toHaveValue('entenda');
  await page.locator('[data-search-results] a[href="/entenda/divida-publica"]').click();
  await expect(page.locator('h1')).toHaveText('Dívida pública');
  await page.goBack();
  await expect(type).toHaveValue('entenda');
  await type.selectOption('indicadores');
  await page.getByRole('searchbox').fill('comida');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('status')).toContainText('para “comida”');
  expect(new URL(page.url()).searchParams.get('q')).toBe('comida');
  await page.getByRole('searchbox').fill('');
  await page.getByRole('searchbox').press('Enter');
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.locator('[data-search-results] li')).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('q')).toBe(false);
  await expect(page.locator('[data-search-suggest]')).toBeVisible();
});

test('falha HTTP informa recuperação e permite tentar novamente', async ({ page }) => {
  let requests = 0;
  await page.route('**/busca.json', async (route) => {
    if (++requests === 1) await route.fulfill({ status: 503, body: 'indisponível' });
    else await route.continue();
  });
  await page.goto('/busca?q=comida');
  await expect(page.getByRole('status')).toContainText('Não foi possível carregar');
  await expect(page.locator('[data-search-suggest]')).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('status')).toContainText('resultados para “comida”');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeHidden();
  await expect(
    page.locator('[data-search-results] a[href="/indicador/cesta-basica"]'),
  ).toBeVisible();
  expect(requests).toBe(2);
});

test('consulta alterada durante carregamento não reaparece depois de limpar', async ({ page }) => {
  let release: () => void = () => {};
  let started: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loading = new Promise<void>((resolve) => {
    started = resolve;
  });
  await page.route('**/busca.json', async (route) => {
    started();
    await pending;
    await route.continue();
  });
  await page.goto('/busca?q=comida');
  await loading;
  await page.getByRole('searchbox').fill('');
  await expect(page.getByRole('status')).toBeEmpty();
  const response = page.waitForResponse('**/busca.json');
  release();
  await response;
  await expect(page.locator('[data-search-results]')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('[data-search-results] li')).toHaveCount(0);
  await expect(page.getByRole('status')).toBeEmpty();
});

test('resultados tratam conteúdo como texto e busca tem acessibilidade e largura adequadas', async ({
  page,
}, testInfo) => {
  await page.goto('/busca?q=comida');
  await expect(page.getByRole('status')).toContainText('resultados para');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('busca-comida.png'), fullPage: true });
  await page.goto('/busca?q=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  await expect(page.getByRole('status')).toContainText('Nada encontrado');
  await expect(page.locator('[data-search-status] img')).toHaveCount(0);
});

test.describe('catálogo sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('indicadores, conceitos, acervo e SEO permanecem acessíveis', async ({ page }) => {
    await page.goto('/busca?q=comida');
    await expect(page.locator('noscript p')).toContainText('explorar todos os indicadores');
    await expect(page.locator('noscript p')).toBeVisible();
    const catalog = page.locator('[data-search-suggest]');
    await expect(catalog.locator('a[href^="/indicador/"]')).toHaveCount(20);
    await expect(catalog.locator('a[href^="/entenda/"]')).toHaveCount(12);
    await catalog
      .locator('summary')
      .filter({ hasText: /^Custo de vida$/ })
      .click();
    await catalog.getByRole('link', { name: 'Custo da cesta básica', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Custo da cesta básica');
    await page.goBack();
    await catalog
      .locator('summary')
      .filter({ hasText: /^Entenda a economia$/ })
      .click();
    await catalog.getByRole('link', { name: 'Inflação', exact: true }).click();
    await expect(page.locator('h1')).toHaveText('Inflação');
    await page.goBack();
    await expect(catalog.getByRole('link', { name: 'Habitação', exact: true })).toBeVisible();
    await expect(page).toHaveTitle('Busca | MARGEM');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://margem.com.br/busca/',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /indicadores, conceitos/,
    );
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      'https://margem.com.br/busca/',
    );
    await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute(
      'content',
      /indicadores, conceitos/,
    );
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    expect(await readFile('dist/sitemap-0.xml', 'utf8')).toContain('https://margem.com.br/busca/');
    expect(await readFile('dist/robots.txt', 'utf8')).not.toMatch(/Disallow:\s*\/(?:busca)?\s*$/m);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});
