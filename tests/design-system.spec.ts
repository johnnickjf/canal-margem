import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page, javaScriptEnabled }) => {
  await page.goto('/design-system');
  if (javaScriptEnabled !== false)
    await expect(page.locator('[data-ui-dialog-shell]').first()).toHaveAttribute(
      'data-ready',
      'true',
    );
});

test('apresenta estados de dados sem confundir ausência e zero', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Design system');
  await expect(page.locator('[data-indicator-state="ready"]')).toHaveCount(2);
  await expect(page.locator('[data-indicator-state="ready"]').nth(1)).toContainText('0 p.p.');
  await expect(page.locator('[data-indicator-state="empty"]')).toContainText(
    'Ausência não equivale a zero',
  );
  await expect(page.locator('[data-indicator-state="error"]')).toContainText(
    'A fonte não respondeu',
  );
  await expect(page.locator('[data-indicator-state="loading"]').getByRole('status')).toContainText(
    'Carregando',
  );
  for (const state of ['loading', 'empty', 'error']) {
    await expect(
      page.locator(`[data-indicator-state="${state}"] .indicator-card__value`),
    ).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Indisponível', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Carregando', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Carregando', exact: true })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  await expect(page.locator('#ds-recorte-error')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#ds-recorte-error')).toHaveAttribute(
    'aria-describedby',
    'ds-recorte-error-error',
  );
});

test('abas respondem a teclado, links diretos e múltiplas instâncias', async ({ page }) => {
  const mainTabs = page.getByRole('tablist', { name: 'Níveis de leitura' });
  const context = mainTabs.getByRole('tab', { name: 'Contexto' });
  await mainTabs.getByRole('tab', { name: 'Resumo' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(context).toBeFocused();
  await expect(context).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#ds-reading-panel-contexto')).toBeVisible();
  await expect(page.locator('#ds-reading-panel-resumo')).toBeHidden();
  await page.keyboard.press('End');
  await expect(mainTabs.getByRole('tab', { name: 'Metodologia' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(mainTabs.getByRole('tab', { name: 'Resumo' })).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(mainTabs.getByRole('tab', { name: 'Metodologia' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(mainTabs.getByRole('tab', { name: 'Resumo' })).toBeFocused();
  await expect(
    page.getByRole('tablist', { name: 'Referência adicional' }).getByRole('tab', { name: 'Fonte' }),
  ).toHaveAttribute('aria-selected', 'true');
  await page.goto('/design-system#ds-reading-panel-metodo');
  await expect(page.locator('#ds-reading-panel-metodo')).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Metodologia' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

test('modal e drawers contêm o foco, fecham e devolvem o foco ao acionador', async ({ page }) => {
  for (const [id, label] of [
    ['ds-modal', 'Abrir modal'],
    ['ds-drawer', 'Abrir painel lateral'],
    ['ds-explanation', 'Entenda este indicador'],
  ]) {
    const trigger = page.getByRole('link', { name: label, exact: true });
    await trigger.click();
    const dialog = page.locator(`#${id}`);
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.locator('[data-ui-dialog-heading]')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await dialog.locator('[data-ui-dialog-heading]').focus();
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: /Fechar/ })).toBeFocused();
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Tab');
      expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(
        true,
      );
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await dialog.getByRole('button', { name: /Fechar/ }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  }
  await page.getByRole('link', { name: 'Abrir modal', exact: true }).click();
  await page.mouse.click(2, 2);
  await expect(page.locator('#ds-modal')).toBeHidden();
});

test('links de modal e drawer fecham a sobreposição e focam a seção de destino', async ({
  page,
}) => {
  for (const [id, label, link, target] of [
    ['ds-modal', 'Abrir modal', 'Ver os cartões de exemplo', 'indicadores'],
    ['ds-drawer', 'Abrir painel lateral', 'Sobre estes exemplos', 'dados-ilustrativos'],
  ]) {
    const trigger = page.getByRole('link', { name: label, exact: true });
    const dialog = page.locator(`#${id}`);
    const destination = page.locator(`#${target}`);
    // Repetir cobre a navegação quando o hash já é o mesmo (sem hashchange).
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await trigger.click();
      await dialog.getByRole('link', { name: link, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${target}$`));
      await expect(dialog).toBeHidden();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await expect(destination).toBeFocused();
      await expect(destination).toBeInViewport();
      expect(
        await page.locator('html').evaluate((element) => getComputedStyle(element).overflow),
      ).not.toBe('hidden');
    }
    await trigger.click();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
  }
});

test('URLs de modal e drawers abrem o conteúdo no carregamento e na mudança de hash', async ({
  page,
}) => {
  for (const id of ['ds-modal', 'ds-drawer', 'ds-explanation']) {
    const dialog = page.locator(`#${id}`);
    const trigger = page.locator(`[data-ui-dialog-trigger][aria-controls="${id}"]`);
    await page.goto(`/design-system#${id}-content`);
    await expect(dialog).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog.locator('[data-ui-dialog-heading]')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    await page.reload();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await page.evaluate((hash) => {
      location.hash = hash;
    }, `${id}-title`);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-ui-dialog-heading]')).toBeFocused();
    await page.evaluate(() => {
      location.hash = 'indicadores';
    });
    await expect(dialog).toBeHidden();
    await expect(page.locator('#indicadores')).toBeFocused();
    await page.goBack();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-ui-dialog-heading]')).toBeFocused();
    await page.keyboard.press('Escape');
  }
});

test('acionadores de modal e drawers abrem o conteúdo em outra aba', async ({ page, context }) => {
  for (const [id, label] of [
    ['ds-modal', 'Abrir modal'],
    ['ds-drawer', 'Abrir painel lateral'],
    ['ds-explanation', 'Entenda este indicador'],
  ]) {
    const opened = context.waitForEvent('page');
    await page
      .getByRole('link', { name: label, exact: true })
      .click({ modifiers: ['ControlOrMeta'] });
    const tab = await opened;
    await expect(tab).toHaveURL(new RegExp(`#${id}-content$`));
    await expect(tab.locator(`#${id}`)).toBeVisible();
    await expect(tab.locator(`#${id} [data-ui-dialog-heading]`)).toBeFocused();
    await expect(page.locator('dialog:modal')).toHaveCount(0);
    await tab.close();
  }
});

test('abrir o destino de um modal em outra aba preserva o diálogo original', async ({
  page,
  context,
}) => {
  await page.getByRole('link', { name: 'Abrir modal', exact: true }).click();
  const opened = context.waitForEvent('page');
  await page
    .locator('#ds-modal')
    .getByRole('link', { name: 'Ver os cartões de exemplo' })
    .click({ modifiers: ['ControlOrMeta'] });
  const tab = await opened;
  await expect(tab).toHaveURL(/#indicadores$/);
  await expect(tab.locator('#indicadores')).toBeInViewport();
  await expect(tab.locator('dialog:modal')).toHaveCount(0);
  await expect(page.locator('#ds-modal')).toBeVisible();
  await expect(page).toHaveURL(/\/design-system$/);
  await tab.close();
});

test('tooltip funciona por foco e Escape, sem misturar instâncias', async ({ page }) => {
  await page.getByRole('button', { name: 'O que é uma revisão?' }).focus();
  await expect(page.locator('#ds-tip')).toBeVisible();
  await expect(page.locator('#ds-tip-two')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ds-tip')).toBeHidden();
  await page.getByRole('button', { name: 'O que é referência?' }).focus();
  await expect(page.locator('#ds-tip-two')).toBeVisible();
  const bounds = await page.locator('#ds-tip-two').boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport) throw new Error('Tooltip sem dimensões.');
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  await page.keyboard.press('Tab');
  await expect(page.locator('#ds-tip-two')).toBeHidden();
});

test('seletores e busca usam contratos de formulário reais', async ({ page }) => {
  await page.locator('#ds-live-range').selectOption('5a');
  await page.getByRole('button', { name: 'Atualizar exemplo' }).click();
  await expect(page.locator('[data-range-status]')).toContainText('últimos 5 anos');
  await page.locator('#ds-period').selectOption('5a');
  await page.getByRole('button', { name: 'Aplicar período' }).click();
  await expect(page).toHaveURL(/periodo=5a/);
  await expect(page.locator('[data-period-status]')).toContainText('Últimos 5 anos');
  await expect(page.locator('#ds-period')).toHaveValue('5a');
  await page.locator('#ds-search').fill('aluguel');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page).toHaveURL(/\/busca\?q=aluguel/);
  await expect(page.locator('[data-search-results]')).toContainText(/aluguel/i);
});

test('referência não tem violações automáticas WCAG A/AA, inclusive nas sobreposições', async ({
  page,
}) => {
  const scan = () =>
    new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
  expect((await scan()).violations).toEqual([]);
  for (const label of ['Abrir modal', 'Abrir painel lateral', 'Entenda este indicador']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    expect((await scan()).violations).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('layout cabe na viewport e respeita movimento reduzido', async ({ page }, testInfo) => {
  await expect(page.locator('body')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('fundamentos.png'), scale: 'css' });
  await page
    .locator('[data-indicator-state="ready"]')
    .first()
    .evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 100));
  await page.screenshot({ path: testInfo.outputPath('indicadores.png'), scale: 'css' });
  for (const label of ['Abrir modal', 'Abrir painel lateral', 'Entenda este indicador']) {
    await page.getByRole('link', { name: label, exact: true }).click();
    const dialog = page.locator('dialog:modal');
    const box = await dialog.boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error('Diálogo ou viewport sem dimensões.');
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: testInfo.outputPath(`${await dialog.getAttribute('id')}.png`),
      scale: 'css',
    });
    await page.keyboard.press('Escape');
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.btn__spinner')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('.ui-skeleton__line').first()).toHaveCSS('animation-name', 'none');
});

test('páginas editoriais preservam HTML, metadados, links, JSON-LD e sitemap', async ({
  page,
  request,
}) => {
  const dist = path.resolve('dist');
  const paths = await readdir(dist, { recursive: true });
  const htmlFiles = paths.filter((file) => file.endsWith('.html'));
  expect(htmlFiles.length).toBeGreaterThanOrEqual(38);
  const sitemap = (
    await Promise.all(
      paths
        .filter((file) => /^sitemap.*\.xml$/.test(file))
        .map((file) => readFile(path.join(dist, file), 'utf8')),
    )
  ).join('\n');
  expect(sitemap).not.toContain('/design-system');
  const existing = new Set(paths);
  for (const file of htmlFiles) {
    const html = await readFile(path.join(dist, file), 'utf8');
    const parsed = await page.evaluate((source) => {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      return {
        title: doc.title,
        description: doc.querySelector('meta[name="description"]')?.getAttribute('content'),
        canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href'),
        h1: doc.querySelectorAll('h1').length,
        content: doc.querySelector('main')?.textContent?.trim(),
        noindex: doc
          .querySelector('meta[name="robots"]')
          ?.getAttribute('content')
          ?.includes('noindex'),
        structured: [...doc.querySelectorAll('script[type="application/ld+json"]')].map((script) =>
          JSON.parse(script.textContent || ''),
        ),
        links: [...doc.querySelectorAll<HTMLAnchorElement>('a[href]')].map(
          (link) => link.getAttribute('href') ?? '',
        ),
      };
    }, html);
    expect(parsed.title, file).toBeTruthy();
    expect(parsed.description, file).toBeTruthy();
    expect(parsed.h1, file).toBe(1);
    expect(parsed.content, file).toBeTruthy();
    expect(parsed.canonical, file).toMatch(/^https:\/\/margem\.com\.br\//);
    if (!parsed.canonical) throw new Error(`${file}: canonical ausente.`);
    if (!parsed.noindex) expect(sitemap, file).toContain(parsed.canonical);
    for (const href of parsed.links) {
      const url = new URL(href, parsed.canonical);
      if (url.origin !== 'https://margem.com.br' || href.startsWith('#')) continue;
      const route = decodeURIComponent(url.pathname).replace(/^\/|\/$/g, '');
      expect(
        existing.has(route) ||
          existing.has(`${route}/index.html`) ||
          existing.has(`${route}.html`) ||
          (!route && existing.has('index.html')),
        `${file}: ${href}`,
      ).toBe(true);
    }
  }
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Allow: /');
  expect(await robots.text()).toContain('Sitemap: https://margem.com.br/sitemap-index.xml');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow');
});

test.describe('sem JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('conteúdo principal, explicações e todos os painéis permanecem legíveis', async ({
    page,
  }) => {
    await expect(page.getByRole('heading', { name: 'Design system', exact: true })).toBeVisible();
    await expect(page.locator('#ds-modal-content')).toBeVisible();
    await expect(page.locator('#ds-explanation-content')).toBeVisible();
    await expect(page.locator('#ds-reading-panel-resumo')).toBeVisible();
    await expect(page.locator('#ds-reading-panel-contexto')).toBeVisible();
    await expect(page.locator('#ds-reading-panel-metodo')).toBeVisible();
    await expect(page.locator('#ds-tip')).toBeVisible();
    await page.getByRole('link', { name: 'Entenda este indicador', exact: true }).click();
    await expect(page).toHaveURL(/#ds-explanation-content$/);
    await page.locator('#ds-period').selectOption('5a');
    await page.getByRole('button', { name: 'Aplicar período' }).click();
    await expect(page).toHaveURL(/periodo=5a/);
  });
});
