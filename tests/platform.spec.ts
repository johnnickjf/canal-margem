import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('navegação da plataforma funciona sem JavaScript e com teclado', async ({ page, browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize(),
    reducedMotion: 'reduce',
  });
  const rendered = await context.newPage();
  await rendered.goto('/indicador/desemprego');
  const navigation = rendered.getByRole('navigation', { name: 'Dados e indicadores' });
  const mobileMenu = navigation.getByText('Explorar dados', { exact: true });
  if (await mobileMenu.isVisible()) {
    const summary = navigation.locator('summary');
    await expect(navigation.getByRole('link', { name: 'Custo de vida', exact: true })).toBeHidden();
    await summary.focus();
    await rendered.keyboard.press('Enter');
    await expect(navigation.locator('details')).toHaveAttribute('open', '');
    await expect(
      navigation.getByRole('link', { name: 'Custo de vida', exact: true }),
    ).toBeVisible();
    await rendered.keyboard.press('Enter');
    await expect(navigation.locator('details')).not.toHaveAttribute('open', '');
    await rendered.keyboard.press('Enter');
  }
  await navigation.getByRole('link', { name: 'Custo de vida', exact: true }).click();
  await expect(rendered).toHaveURL(/\/tema\/custo-de-vida\/?$/);
  await context.close();
});

test('shell navega da home ao tema e ao indicador sem JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/');
  await page
    .locator('.platform-entry')
    .getByRole('link', { name: /Estou trabalhando mais/ })
    .click();
  await expect(page).toHaveURL(/\/tema\/trabalho-e-renda\/?$/);
  await page.getByRole('heading', { name: 'Desemprego', exact: true }).getByRole('link').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Desemprego');
  await expect(
    page.locator('#dados').getByText('Taxa de desocupação', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('complementary', { name: 'Disponibilidade dos dados' })
    .getByRole('link', { name: 'Como ler os dados e suas limitações', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Como ler os dados');
  await context.close();
});

for (const route of [
  '/tema/custo-de-vida',
  '/indicador/desemprego',
  '/comparar',
  '/entenda/como-ler-os-dados',
]) {
  test(`shell tem SEO, acessibilidade e largura adequada: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://margem.com.br${route}/`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://margem.com.br${route}/`,
    );
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement[1].item).toBe(`https://margem.com.br${route}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

test('dados exibidos e consultas compartilham publicação; ausência não vira zero', async ({
  page,
}) => {
  await page.goto('/indicador/desemprego');
  const note = page.getByRole('complementary', { name: 'Disponibilidade dos dados' });
  const publication = await note.getAttribute('data-publication');
  if (publication === 'unavailable') {
    await expect(note).toContainText('Dados ainda indisponíveis');
    await expect(page.locator('.platform-value')).toHaveCount(0);
    return;
  }
  for (const href of await page
    .locator('a[href*="/api/v1/"]')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))) {
    expect(new URL(href).searchParams.get('publication')).toBe(publication);
  }
});
