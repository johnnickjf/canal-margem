import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('auditoria mantém navegação e estrutura acessíveis', async ({ page, browser }) => {
  await page.goto('/auditoria');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Auditoria e transparência dos dados',
  );
  await expect(page.locator('#edicoes')).toBeVisible();
  await expect(page.locator('#linhagem')).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: page.viewportSize(),
  });
  const withoutScript = await context.newPage();
  await withoutScript.goto('/auditoria');
  await expect(withoutScript.locator('#linhagem a[href^="/indicador/"]').first()).toBeVisible();
  await expect(withoutScript.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://margem.com.br/auditoria/',
  );
  await context.close();
});
