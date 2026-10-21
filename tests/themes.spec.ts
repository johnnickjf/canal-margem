import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const slug of [
  'trabalho-e-renda',
  'custo-de-vida',
  'vida-financeira',
  'qualidade-de-vida',
  'economia-e-estado',
]) {
  test(`tema com resumo, explicações e navegação acessível: ${slug}`, async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/tema/${slug}`);
    await expect(page.locator('h1')).toHaveCount(1);
    const navigation = page.getByRole('navigation', { name: 'Nesta página' });
    for (const id of ['resumo', 'mudancas', 'indicadores', 'entenda', 'comparar']) {
      await navigation.locator(`a[href="#${id}"]`).click();
      await expect(page.locator(`#${id}`)).toBeInViewport();
    }
    await expect(page.locator('#resumo')).toContainText('último período');
    await expect(page.locator('#entenda')).toContainText('Ausência não equivale a zero');
    await expect(page.locator('#indicadores article')).not.toHaveCount(0);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://margem.com.br/tema/${slug}/`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
      'content',
      `https://margem.com.br/tema/${slug}/`,
    );
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    const schema = JSON.parse(await page.locator('script[type="application/ld+json"]').innerText());
    expect(schema['@type']).toBe('BreadcrumbList');
    expect(schema.itemListElement[1].item).toBe(`https://margem.com.br/tema/${slug}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const accessibleContext = await browser.newContext({ javaScriptEnabled: true });
    const accessiblePage = await accessibleContext.newPage();
    await accessiblePage.goto(page.url());
    expect((await new AxeBuilder({ page: accessiblePage }).analyze()).violations).toEqual([]);
    await accessibleContext.close();
    await page.locator('#comparar a').click();
    await expect(page).toHaveURL(/\/comparar\/?$/);
    await context.close();
  });
}
