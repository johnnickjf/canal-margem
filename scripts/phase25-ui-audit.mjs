import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { chromium } from '@playwright/test';

async function pages(dir, prefix = '') {
  const routes = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      routes.push(...(await pages(join(dir, entry.name), `${prefix}/${entry.name}`)));
    else if (entry.name === 'index.html') routes.push(prefix || '/');
  }
  return routes;
}
const buildDir = process.env.MARGEM_AUDIT_DIR ?? 'dist';
const origin = new URL(process.env.MARGEM_AUDIT_ORIGIN ?? 'http://127.0.0.1:4321');
const reportPath = process.env.MARGEM_AUDIT_REPORT ?? '.data/phase25-ui-audit.json';
const routes = (await pages(buildDir)).sort();
const browser = await chromium.launch({ headless: true });
const report = [];
for (const [name, viewport, javascriptEnabled, reducedMotion] of [
  ['desktop-js', { width: 1440, height: 1000 }, true, 'no-preference'],
  ['mobile-js', { width: 393, height: 851 }, true, 'reduce'],
  ['desktop-sem-js', { width: 1440, height: 1000 }, false, 'reduce'],
  ['mobile-sem-js', { width: 393, height: 851 }, false, 'reduce'],
]) {
  const context = await browser.newContext({
    viewport,
    javaScriptEnabled: javascriptEnabled,
    reducedMotion,
  });
  const page = await context.newPage();
  for (const route of routes) {
    const result = { route, state: name };
    try {
      const response = await page.goto(new URL(route, origin).href, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page.evaluate(() => document.fonts.ready);
      Object.assign(
        result,
        await page.evaluate(() => ({
          title: document.title,
          h1: [...document.querySelectorAll('h1')].map((x) => x.textContent.trim()),
          mainText: document.querySelector('main')?.innerText.trim().length || 0,
          overflow: document.documentElement.scrollWidth > innerWidth,
          canonical: document.querySelector('link[rel=canonical]')?.getAttribute('href') || '',
          description:
            document.querySelector('meta[name=description]')?.getAttribute('content') || '',
        })),
      );
      result.status = response?.status();
      await page.keyboard.press('Tab');
      result.focus = await page.evaluate(() => document.activeElement?.tagName || '');
    } catch (error) {
      result.error = String(error);
    }
    report.push(result);
  }
  await context.close();
}
await browser.close();
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, JSON.stringify(report, null, 2));
const problems = report.filter(
  (r) =>
    r.error ||
    r.status !== 200 ||
    r.overflow ||
    r.h1?.length !== 1 ||
    !r.mainText ||
    !r.title ||
    !r.description ||
    !r.canonical ||
    r.focus === 'BODY',
);
console.log(
  JSON.stringify(
    {
      routes: routes.length,
      states: report.length,
      problems,
    },
    null,
    2,
  ),
);
if (problems.length || !routes.length) process.exitCode = 1;
