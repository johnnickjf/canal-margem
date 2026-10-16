import { expect, test } from '@playwright/test';

test('menu mobile permite navegar por teclado e fechar com retorno de foco', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Abrir menu', exact: true });
  const menu = page.getByRole('dialog', { name: 'Menu', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(menu.getByRole('button', { name: 'Fechar menu' })).toBeFocused();
  for (const name of ['Vídeos', 'Temas', 'Análises', 'Manifesto', 'Sobre', 'Busca']) {
    await page.keyboard.press('Tab');
    await expect(menu.getByRole('link', { name: new RegExp(name) })).toBeFocused();
  }
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await trigger.click();
  const analyses = menu.getByRole('link', { name: /Análises/ });
  await analyses.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/analises\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Economia');
  await expect(page.getByRole('dialog', { name: 'Menu', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Menu', exact: true }).getByRole('link', { name: /Análises/ }),
  ).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Fechar menu', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Abrir menu', exact: true })).toBeFocused();
});

test('menu mobile fecha ao mudar para a largura de desktop', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 851 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Menu', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.getByRole('dialog', { name: 'Menu', exact: true })).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Principal', exact: true })).toBeVisible();
  expect(
    await page.locator('html').evaluate((element) => getComputedStyle(element).overflow),
  ).not.toBe('hidden');
});

test('busca com e sem acentos retorna os mesmos links e abre o resultado', async ({ page }) => {
  const results = page.locator('[data-search-results]');
  await page.goto(`/busca?q=${encodeURIComponent('habitação')}`);
  await expect(page.getByRole('status')).toContainText(/\d+ resultados? para/);
  await expect(results.getByRole('link', { name: /Habitação/ })).toBeVisible();
  const accented = await results
    .locator('a')
    .evaluateAll((links) => links.map((link) => link.getAttribute('href')));
  await page.goto('/busca?q=habitacao');
  await expect(page.getByRole('status')).toContainText(/\d+ resultados? para/);
  expect(
    await results
      .locator('a')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
  ).toEqual(accented);
  await results.getByRole('link', { name: /Habitação/ }).click();
  await expect(page).toHaveURL(/\/temas\/habitacao\/?$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Habitação');
});

test('busca sem resultados permite recuperar pela lista de temas e limpar a consulta', async ({
  page,
}) => {
  await page.goto('/busca?q=aluguel');
  await expect(page.locator('[data-search-results] li').first()).toBeVisible();
  const input = page.getByRole('searchbox', { name: 'O que você procura?' });
  await input.fill('zzzxqvnenhumresultado');
  await expect(page.getByRole('status')).toContainText('Nada encontrado');
  await expect(page.locator('[data-search-results] li')).toHaveCount(0);
  await expect(page).toHaveURL(/q=zzzxqvnenhumresultado/);
  await expect(page.locator('[data-search-suggest]')).toBeVisible();
  await expect(page.locator('[data-search-suggest]').getByRole('link').first()).toBeVisible();
  await input.fill('   ');
  await expect(page.getByRole('status')).toBeEmpty();
  await expect(page.locator('[data-search-results] li')).toHaveCount(0);
  await expect(page.locator('[data-search-suggest]')).toBeVisible();
  await input.fill('');
  await expect(page).toHaveURL(/\/busca\/?$/);
  await page
    .locator('[data-search-suggest]')
    .getByRole('link', { name: 'Habitação', exact: true })
    .click();
  await expect(page).toHaveURL(/\/temas\/habitacao\/?$/);
});
