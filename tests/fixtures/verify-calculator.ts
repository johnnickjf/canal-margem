import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export async function verifyCalculator(page: Page, rendered: Page, info: TestInfo, width: number) {
  await rendered.goto('http://127.0.0.1:4323/calculadora/');
  await expect(rendered.locator('noscript p')).toContainText('precisa de JavaScript');
  await expect(rendered.locator('[data-calculator-form]')).toBeHidden();
  await expect(rendered.locator('#referencias')).toContainText('anterior a 2023');
  await page.goto('http://127.0.0.1:4323/calculadora/');
  const form = page.locator('[data-calculator-form]');
  const result = page.locator('[data-calculator-results]');
  const status = page.locator('[data-calculator-status]');
  await expect(form).toBeVisible();
  for (const [key, value] of Object.entries({
    income: '3000',
    members: '3',
    housing: '1000',
    transport: '250.25',
    other: '749.75',
    income_change: '500',
    month: '2025-12',
  }))
    await form.locator(`[name="${key}"]`).fill(value);
  await form.locator('[name="geography"]').selectOption('São Paulo');
  await form.getByRole('checkbox', { name: 'Alimentação e custo de vida' }).check();
  const submit = page.getByRole('button', { name: 'Calcular cenário', exact: true });
  const sent = page.waitForRequest(
    (request) => request.method() === 'POST' && request.url().endsWith('/api/v1/calculator'),
  );
  await submit.focus();
  await page.keyboard.press('Enter');
  const request = await sent;
  expect(request.postDataJSON()).toMatchObject({
    publication: 'a'.repeat(64),
    version: 'profile-v1',
    profile: { income: '3000', members: 3 },
  });
  expect(new URL(request.url()).search).toBe('');
  await expect(status).toContainText('Cálculo concluído');
  await expect(result).toContainText('Saldo: R$ 1500');
  await expect(result).toContainText('800,123456789012');
  await expect(result).toContainText('26,670781892967%');
  await expect(result).toContainText('não avalia a lei de 2023');
  await expect(result).toContainText('Sem estudo empírico');
  await expect(result).toContainText('Contrafactual:');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await result.locator('summary').click();
  await expect(result).toContainText('profile-v1');
  await expect(result).toContainText('income / members');
  const layout = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    overflowing: [...document.querySelectorAll('main *')]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 1)
      .slice(0, 8)
      .map((element) => ({ tag: element.tagName, text: element.textContent?.slice(0, 90) })),
  }));
  expect(layout.width, JSON.stringify(layout)).toBeLessThanOrEqual(layout.viewport);
  await result.locator('summary').click();
  await page.screenshot({ path: info.outputPath(`calculadora-${width}.png`), fullPage: true });
  expect(
    await page.evaluate(() => ({
      url: location.search,
      local: localStorage.length,
      session: sessionStorage.length,
    })),
  ).toEqual({ url: '', local: 0, session: 0 });
  await form.locator('[name="geography"]').selectOption('not-covered');
  await expect(result).toBeEmpty();
  await submit.click();
  await expect(status).toContainText('Cálculo concluído');
  await expect(result).toContainText('nenhuma cesta foi estimada');
  await expect(result).not.toContainText('Uma cesta equivale');
  // A failure clears old results and permits an explicit retry.
  await page.route('**/api/v1/calculator', async (route) => {
    if (route.request().method() === 'OPTIONS') await route.continue();
    else
      await route.fulfill({
        status: 503,
        headers: { 'Access-Control-Allow-Origin': '*' },
        contentType: 'application/json',
        body: '{}',
      });
  });
  await submit.click();
  await expect(status).toContainText('temporariamente indisponível');
  await expect(result).toBeEmpty();
  await page.unroute('**/api/v1/calculator');
  await submit.click();
  await expect(status).toContainText('Cálculo concluído');
  // In-flight responses must not publish results after editing the input.
  let release: (() => void) | undefined;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    arrived = resolve;
  });
  await page.route('**/api/v1/calculator', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.continue();
      return;
    }
    arrived?.();
    await wait;
    await route.abort().catch(() => {});
  });
  await submit.click();
  await started;
  await form.locator('[name="income"]').fill('3001');
  release?.();
  await expect(status).toContainText('Perfil alterado');
  await expect(result).toBeEmpty();
  await page.unroute('**/api/v1/calculator');
  await page.getByRole('button', { name: 'Limpar perfil' }).click();
  await expect(status).toHaveText('Perfil limpo.');
  await expect(form.locator('[name="income"]')).toHaveValue('');
  await expect(result).toBeEmpty();
}
