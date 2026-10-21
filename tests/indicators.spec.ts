import { expect, test } from '@playwright/test';
import indicators from '../backend/internal/publications/indicators.json' with { type: 'json' };

for (const indicator of indicators.filter((item) => item.role === 'primary')) {
  test(`indicador tem leitura completa sem JavaScript: ${indicator.slug}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/indicador/${indicator.slug}`);
    await expect(page.locator('h1')).toHaveText(indicator.name);
    for (const id of ['aconteceu', 'significa', 'dados', 'relacionados']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator('#significa p').first()).not.toBeEmpty();
    await expect(page.locator('#relacionados a').first()).toHaveAttribute('href', /^\/indicador\//);
    await expect(page.locator('#significa a')).toHaveAttribute(
      'href',
      '/entenda/como-ler-os-dados',
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://margem.com.br/indicador/${indicator.slug}/`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      indicator.question,
    );
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await context.close();
  });
}
