import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('calculadora oferece métodos e fontes sem JavaScript, com SEO e navegação', async ({
  page,
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize(),
  });
  const rendered = await context.newPage();
  await rendered.goto('/calculadora');
  await expect(rendered.locator('h1')).toHaveText('Calculadora socioeconômica');
  const help = rendered.locator('.calculator-help');
  await help.locator('summary').focus();
  await rendered.keyboard.press('Enter');
  await expect(help).toContainText('Não multiplicamos seu preço pelo número de moradores');
  await expect(help).toContainText('Não há previsão de benefício');
  await expect(rendered.locator('#metodo')).toContainText('profile-v1');
  await expect(rendered.locator('#referencias')).toContainText('anterior a 2023');
  await expect(rendered.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://margem.com.br/calculadora/',
  );
  await expect(rendered.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    /orçamento familiar/,
  );
  await expect(rendered.locator('meta[property="og:url"]')).toHaveAttribute(
    'content',
    'https://margem.com.br/calculadora/',
  );
  await expect(rendered.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  const schema = JSON.parse(
    await rendered.locator('script[type="application/ld+json"]').innerText(),
  );
  expect(schema['@type']).toBe('BreadcrumbList');
  expect(await readFile('dist/sitemap-0.xml', 'utf8')).toContain(
    'https://margem.com.br/calculadora/',
  );
  expect(await rendered.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
  await rendered.getByRole('link', { name: 'Cesta básica por capital', exact: true }).click();
  await expect(rendered.locator('h1')).toHaveCount(1);
  await page.goto('/calculadora');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await context.close();
});
