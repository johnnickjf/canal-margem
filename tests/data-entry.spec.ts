import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('entrada de dados permite explorar temas e auditoria sem JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/dados');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A vida por trás dos números.');
  await expect(page.locator('.theme-card')).toHaveCount(5);
  await expect(page.getByRole('link', { name: /Confira as fontes/ })).toHaveAttribute(
    'href',
    '/auditoria',
  );
  await page.getByRole('link', { name: /Custo de vida Quanto custa viver no Brasil/ }).click();
  await expect(page).toHaveURL(/\/tema\/custo-de-vida\/?$/);
  await context.close();
});

test('entrada de dados mantém SEO, acessibilidade e estado da publicação', async ({ page }) => {
  await page.goto('/dados');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://margem.com.br/dados/',
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /indicadores/);
  const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
  expect(schema['@type']).toBe('BreadcrumbList');
  expect(schema.itemListElement[1].item).toBe('https://margem.com.br/dados/');
  await expect(
    page.getByRole('complementary', { name: 'Disponibilidade dos dados' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
