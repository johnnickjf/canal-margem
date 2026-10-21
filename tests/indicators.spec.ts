import { expect, test } from '@playwright/test';
import indicators from '../backend/internal/publications/indicators.json' with { type: 'json' };

test.use({ javaScriptEnabled: false });

for (const indicator of indicators) {
  test(`indicador tem leitura completa sem JavaScript: ${indicator.slug}`, async ({ page }) => {
    await page.goto(`/indicador/${indicator.slug}`);
    await expect(page.locator('h1')).toHaveText(indicator.name);
    for (const id of ['aconteceu', 'significa', 'dados', 'relacionados']) {
      await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await expect(page.locator('#significa p').first()).not.toBeEmpty();
    await expect(page.locator('#relacionados a').first()).toHaveAttribute('href', /^\/indicador\//);
    await expect(
      page.getByRole('link', { name: 'Entenda este indicador', exact: true }),
    ).toHaveAttribute('href', '#indicator-explanation-content');
    await expect(page.locator('#indicator-explanation-content')).toBeVisible();
    await expect(page.locator('#indicator-explanation-content')).toContainText('Por que importa');
    await expect(
      page.locator('#indicator-explanation-content a[href^="/entenda/"]').first(),
    ).toBeVisible();
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
  });
}
