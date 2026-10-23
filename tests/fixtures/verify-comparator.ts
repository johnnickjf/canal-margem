import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export async function verifyComparator(
  page: Page,
  rendered: Page,
  testInfo: TestInfo,
  width: number,
) {
  page.setDefaultTimeout(10_000);
  // Chromium requires permission when an intercepted page calls a loopback fixture.
  await page.context().grantPermissions(['local-network-access']);
  await rendered.goto('http://127.0.0.1:4323/comparar/');
  await expect(rendered.locator('noscript p')).toBeVisible();
  await expect(rendered.locator('noscript p')).toContainText(
    'A seleção interativa precisa de JavaScript.',
  );
  await expect(rendered.locator('#catalogo a')).toHaveCount(15);
  await expect(rendered.locator('[data-comparison-form]')).toBeHidden();
  await page.goto('http://127.0.0.1:4323/comparar/');
  const form = page.locator('[data-comparison-form]');
  const results = page.locator('[data-comparison-results]');
  const status = page.locator('[data-comparison-status]');
  const submit = page.getByRole('button', { name: 'Comparar períodos selecionados', exact: true });
  const requests: URL[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/comparisons?')) requests.push(new URL(request.url()));
  });
  await expect(form).toBeVisible();
  await submit.click();
  await expect(status).toContainText('Selecione pelo menos um indicador');
  await form.getByLabel('Tema', { exact: true }).selectOption('trabalho-e-renda');
  await expect(form.getByRole('checkbox')).toHaveCount(4);
  await form.getByRole('checkbox', { name: 'Desemprego', exact: true }).check();
  await form.getByRole('checkbox', { name: 'Rendimento real do trabalho', exact: true }).check();
  await form.getByLabel('Início do primeiro período', { exact: true }).fill('2024-01-01');
  await form.getByLabel('Fim do último período', { exact: true }).fill('2025-03-31');
  await submit.focus();
  await page.keyboard.press('Enter');
  await expect(status).toContainText('Comparação concluída para 2 indicador(es)');
  await expect(status).toBeFocused();
  await expect(results).toContainText('Sem dados suficientes: indicador sem cobertura');
  const uncovered = results
    .locator('article')
    .filter({ has: page.getByRole('link', { name: 'Rendimento real do trabalho', exact: true }) });
  await uncovered.locator('summary').click();
  await expect(uncovered).toContainText('não há valores usados ou mudança calculada');
  const unemployment = results
    .locator('article')
    .filter({ has: page.getByRole('link', { name: 'Desemprego', exact: true }) });
  await expect(unemployment).toHaveAttribute('data-assessment', 'improved');
  await expect(unemployment).toContainText('Diferença absoluta: 0 pontos percentuais');
  await expect(unemployment).toContainText('Direção dos valores publicados: queda');
  await unemployment.locator('summary').click();
  await expect(unemployment).toContainText('0,000000000000000002');
  await expect(unemployment).toContainText('0,000000000000000001');
  await expect(unemployment).toContainText('current - previous');
  await expect(unemployment).toContainText('material-v1');
  await expect(unemployment.getByRole('link', { name: 'Fonte original', exact: true })).toHaveCount(
    2,
  );
  for (const href of await results
    .locator('a[href*="/api/v1/"]')
    .evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href))) {
    expect(new URL(href).searchParams.get('publication')).toBe('a'.repeat(64));
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await testInfo.attach(`comparator-${width}.png`, {
    body: await page.screenshot({
      path: testInfo.outputPath(`comparator-${width}.png`),
      fullPage: false,
    }),
    contentType: 'image/png',
  });
  const shared = page.url();
  await page.reload();
  await expect(results).toContainText('Melhorou nesta medida');
  await form.getByLabel('Medida da mudança', { exact: true }).selectOption('relative-change');
  await expect(results.locator('article')).toHaveCount(0);
  await submit.click();
  await expect(results).toContainText('Variação percentual: -50 %');
  await page.goBack();
  await expect(page).toHaveURL(shared);
  await expect(results).toContainText('Diferença absoluta: 0 pontos percentuais');

  // Real HTTP error, retry, then a response with another publication.
  await page.route('**/api/v1/comparisons?**', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await submit.click();
  await expect(results).toContainText('Consulta não concluída');
  await expect(results.locator('[data-assessment]')).toHaveCount(0);
  await page.unroute('**/api/v1/comparisons?**');

  // Audit text is not HTML, and source links cannot execute scripts.
  await page.route('**/api/v1/comparisons?**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.data.assessment.rule = '<img src=x onerror="alert(1)">Regra da edição';
    body.data.current.node.origins = [
      { url: 'javascript:alert(1)', retrieved_at: '2026-10-18T12:00:00Z' },
    ];
    await route.fulfill({ json: body });
  });
  await submit.click();
  await unemployment.locator('summary').click();
  await expect(unemployment).toContainText('<img src=x');
  await expect(results.locator('img, a[href^="javascript:"]')).toHaveCount(0);
  await page.unroute('**/api/v1/comparisons?**');
  await submit.click();
  await expect(results).toContainText('Melhorou nesta medida');
  await page.route('**/api/v1/comparisons?**', async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    body.publication = 'b'.repeat(64);
    await route.fulfill({ json: body });
  });
  await submit.click();
  await expect(results).toContainText('não corresponde à publicação');
  await expect(results.locator('[data-assessment]')).toHaveCount(0);
  await page.unroute('**/api/v1/comparisons?**');

  // Editing a selection invalidates an in-flight response immediately.
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let arrived = false;
  await page.route('**/api/v1/comparisons?**', async (route) => {
    const response = await route.fetch();
    arrived = true;
    await pending;
    await route.fulfill({ response }).catch(() => {});
  });
  await submit.click();
  await expect.poll(() => arrived).toBe(true);
  await form.getByLabel('Fim do último período', { exact: true }).fill('2025-03-30');
  release();
  await expect(results.locator('article')).toHaveCount(0);
  await expect(results).toHaveAttribute('aria-busy', 'false');
  await page.unroute('**/api/v1/comparisons?**');
  await submit.click();
  await expect(results).toContainText('Um dos extremos selecionados não tem cobertura');
  await expect(results.locator('[data-assessment="stable"]')).toHaveCount(0);
  await form.getByLabel('Tema', { exact: true }).selectOption('custo-de-vida');
  await submit.click();
  await expect(status).toContainText('Selecione pelo menos um indicador');
  await form.getByRole('checkbox', { name: 'Custo da cesta básica', exact: true }).check();
  await form.getByLabel('Recorte de Custo da cesta básica', { exact: true }).selectOption('1');
  await submit.click();
  await expect(results).toContainText('Recorte: Recife');
  await expect(status).toContainText('Comparação concluída para 1 indicador(es)');
  expect(requests.at(-1)?.searchParams.get('geography')).toBe('Recife');
  await form.getByLabel('Início do primeiro período', { exact: true }).fill('2026-01-01');
  await submit.click();
  await expect(status).toContainText('O início deve vir antes do fim');
  for (const url of requests) {
    expect(url.searchParams.get('publication')).toBe('a'.repeat(64));
    expect(url.searchParams.get('version')).toBe('2');
    expect(url.searchParams.get('assessment')).toBe('material-v1');
  }
  const oldEdition = new URL(shared);
  oldEdition.searchParams.set('publication', 'b'.repeat(64));
  const count = requests.length;
  await page.goto(oldEdition.href);
  await expect(status).toContainText('Este link aponta para outra edição');
  expect(requests).toHaveLength(count);
  const invalidSelection = new URL(shared);
  invalidSelection.searchParams.set('selection-desemprego', '999');
  await page.goto(invalidSelection.href);
  await expect(status).toContainText('recorte inválido');
  expect(requests).toHaveLength(count);
}
