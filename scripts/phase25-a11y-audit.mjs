import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

async function pages(dir, prefix = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory())
      out.push(...(await pages(join(dir, entry.name), `${prefix}/${entry.name}`)));
    else if (entry.name === 'index.html') out.push(prefix || '/');
  }
  return out;
}
const buildDir = process.env.MARGEM_AUDIT_DIR ?? 'dist';
const origin = new URL(process.env.MARGEM_AUDIT_ORIGIN ?? 'http://127.0.0.1:4329');
const reportPath = process.env.MARGEM_AUDIT_REPORT ?? '.data/phase25-a11y-scan.json';
const routes = (await pages(buildDir)).sort();
const browser = await chromium.launch();
const results = [];
for (const [size, viewport] of [
  ['desktop', { width: 1440, height: 1000 }],
  ['mobile', { width: 393, height: 851 }],
]) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  for (const route of routes) {
    try {
      const response = await page.goto(new URL(route, origin).href, {
        waitUntil: 'domcontentloaded',
      });
      const violations = (await new AxeBuilder({ page }).analyze()).violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.map((n) => n.target),
      }));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (response?.status() !== 200 || overflow || violations.length)
        results.push({ size, route, status: response?.status(), overflow, violations });
    } catch (e) {
      results.push({ size, route, error: String(e) });
    }
  }
  await context.close();
  console.log(`${size}: rotas examinadas: ${routes.length}`);
}
await browser.close();
await mkdir('.data', { recursive: true });
await writeFile(reportPath, JSON.stringify({ routes: routes.length, results }, null, 2));
console.log(
  JSON.stringify(
    { routes: routes.length, states: routes.length * 2, issues: results.length, results },
    null,
    2,
  ),
);
if (!routes.length || results.length) process.exitCode = 1;
