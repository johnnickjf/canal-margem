import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const journeys = [
  [
    'Trabalho e renda',
    'Estou trabalhando mais e ganhando melhor?',
    'trabalho-e-renda',
    'desemprego',
    'Desemprego',
  ],
  [
    'Custo de vida',
    'Meu dinheiro compra mais ou menos?',
    'custo-de-vida',
    'inflacao',
    'Inflação ao consumidor',
  ],
  [
    'Vida financeira',
    'Quanto da minha renda está indo para dívidas?',
    'vida-financeira',
    'comprometimento-renda',
    'Comprometimento da renda com dívidas',
  ],
  [
    'Qualidade de vida',
    'As condições de vida estão melhorando?',
    'qualidade-de-vida',
    'pobreza',
    'Pobreza monetária',
  ],
  [
    'Economia e Estado',
    'A economia do país está ficando mais forte ou mais frágil?',
    'economia-e-estado',
    'pib-por-pessoa',
    'PIB por pessoa',
  ],
] as const;

test('home começa por perguntas e mantém conteúdo editorial, SEO e acessibilidade', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('main > :first-child h1')).toHaveText('O que você quer entender?');
  await expect(page.locator('h1')).toHaveCount(1);
  const questions = page.getByRole('navigation', { name: 'Perguntas para entender a economia' });
  await expect(questions.getByRole('link')).toHaveCount(5);
  for (const [theme, question, slug] of journeys) {
    const link = questions.getByRole('link', { name: `${theme} ${question}`, exact: true });
    await expect(link).toHaveAttribute('href', `/tema/${slug}`);
    await expect(link).toBeVisible();
  }
  await expect(page.locator('main a[href^="/videos/"]').first()).toBeVisible();
  await expect(page.locator('main a[href^="/analises/"]').first()).toBeVisible();
  await expect(page).toHaveTitle('O que você quer entender? | MARGEM');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /trabalho, renda, custo de vida/,
  );
  for (const selector of ['link[rel="canonical"]', 'meta[property="og:url"]']) {
    await expect(page.locator(selector)).toHaveAttribute(
      selector.startsWith('link') ? 'href' : 'content',
      'https://margem.com.br/',
    );
  }
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    'content',
    'O que você quer entender? | MARGEM',
  );
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  expect(schema['@type']).toBe('Organization');
  expect(schema.url).toBe('https://margem.com.br');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('cinco perguntas chegam a indicadores em dois cliques sem JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const [theme, question, slug, indicator, name] of journeys) {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Perguntas para entender a economia' })
      .getByRole('link', { name: `${theme} ${question}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/tema/${slug}/?$`));
    await page.getByRole('heading', { name, exact: true }).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/indicador/${indicator}/?$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
  }
  await context.close();
});

test('perguntas permitem escolher e abrir um tema pelo teclado', async ({ page }) => {
  await page.goto('/');
  const links = page
    .getByRole('navigation', { name: 'Perguntas para entender a economia' })
    .getByRole('link');
  await links.first().focus();
  for (let index = 0; index < journeys.length; index++) {
    await expect(links.nth(index)).toBeFocused();
    if (index < journeys.length - 1) await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/tema\/economia-e-estado\/?$/);
});
