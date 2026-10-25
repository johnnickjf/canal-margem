#!/usr/bin/env node

import { isIP } from 'node:net';
import {
  inspectPublicHtml,
  parseRobotsGroups,
  parseRobotsSitemaps,
  parseSitemapLocations,
  resolveSameOriginUrl,
  robotsAllows,
} from '../src/lib/deployment-audit.mjs';

const timeoutMs = 10_000;
const maxSitemapPages = 5_000;
const concurrency = 8;

function usage() {
  return 'Uso: pnpm deployment:check --site https://site.example [--api https://api.example]';
}

function parseArgs(args) {
  const options = { site: process.env.MARGEM_SITE_URL, api: process.env.MARGEM_API_URL };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    if (argument !== '--site' && argument !== '--api')
      throw new Error(`Opção desconhecida: ${argument}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta URL para ${argument}`);
    options[argument.slice(2)] = value;
    index += 1;
  }
  if (!options.site) throw new Error('Informe --site ou MARGEM_SITE_URL');
  return options;
}

function baseUrl(value, label) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label}: URL inválida`);
  }
  const hostname = url.hostname.toLowerCase();
  const local =
    hostname === 'localhost' ||
    hostname === '[::1]' ||
    (isIP(hostname) === 4 && Number.parseInt(hostname.split('.')[0], 10) === 127);
  if (
    !['https:', ...(local ? ['http:'] : [])].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${label}: use uma origem HTTPS sem caminho, credenciais, query ou fragmento`);
  }
  return new URL(url.origin);
}

async function get(url, label) {
  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: 'text/html,application/xml,text/plain,application/json',
        'user-agent': 'MargemDeploymentCheck/1.0',
      },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(
      `${label}: ${error.name === 'TimeoutError' ? 'tempo limite excedido' : 'falha de conexão'}`,
    );
  }
  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `${label}: redirecionamento HTTP ${response.status}; informe a origem canônica`,
    );
  }
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return response;
}

function unique(values) {
  return [...new Set(values)];
}

async function mapLimit(values, limit, callback) {
  const results = new Array(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await callback(values[index]);
      }
    }),
  );
  return results;
}

async function checkSite(site, failures) {
  console.log(`Site: ${site.origin}`);
  let robotsText;
  try {
    robotsText = await (await get(new URL('/robots.txt', site), '/robots.txt')).text();
    console.log('✓ /robots.txt');
  } catch (error) {
    failures.push(error.message);
    return 0;
  }

  const sitemapUrls = unique(parseRobotsSitemaps(robotsText));
  if (!sitemapUrls.length) {
    failures.push('/robots.txt: diretiva Sitemap ausente');
    return 0;
  }

  const indexQueue = [];
  for (const value of sitemapUrls) {
    const url = resolveSameOriginUrl(value, site);
    if (!url) {
      failures.push(`/robots.txt: sitemap fora da origem do site ou inválido (${value})`);
      continue;
    }
    indexQueue.push(url);
  }
  if (!indexQueue.length) return 0;

  const pageUrls = [];
  const seenSitemaps = new Set();
  while (indexQueue.length) {
    const indexUrl = indexQueue.shift();
    if (seenSitemaps.has(indexUrl.href)) continue;
    seenSitemaps.add(indexUrl.href);
    if (seenSitemaps.size > 100) {
      failures.push('sitemap: quantidade de arquivos excede o limite (100)');
      break;
    }
    try {
      const xml = await (await get(indexUrl, indexUrl.pathname)).text();
      const locations = parseSitemapLocations(xml);
      if (!locations.length) throw new Error(`${indexUrl.pathname}: sitemap sem entradas`);
      for (const location of locations) {
        const url = resolveSameOriginUrl(location, site);
        if (!url) {
          failures.push(
            `${indexUrl.pathname}: URL fora da origem do site ou inválida (${location})`,
          );
        } else if (/<sitemapindex\b/i.test(xml)) {
          indexQueue.push(url);
        } else if (/<urlset\b/i.test(xml)) {
          pageUrls.push(url);
        } else {
          failures.push(`${indexUrl.pathname}: tipo de sitemap desconhecido`);
          break;
        }
      }
    } catch (error) {
      failures.push(error.message);
    }
  }

  const pages = unique(pageUrls.map((url) => url.href));
  if (pages.length !== pageUrls.length) failures.push('sitemap: URLs de página repetidas');
  if (!pages.length) failures.push('sitemap: nenhuma URL pública encontrada');
  if (pages.length > maxSitemapPages) {
    failures.push(
      `sitemap: ${pages.length} URLs excedem o limite de verificação (${maxSitemapPages})`,
    );
    return pages.length;
  }

  const wildcardGroups = parseRobotsGroups(robotsText).filter((group) =>
    group.agents.includes('*'),
  );
  if (!wildcardGroups.length) {
    failures.push('/robots.txt: grupo User-agent: * ausente');
  } else {
    for (const href of pages) {
      const url = new URL(href);
      if (!robotsAllows(wildcardGroups, url)) {
        failures.push(`/robots.txt: rastreamento bloqueado para ${url.pathname}`);
        if (
          failures.filter((failure) => failure.includes('/robots.txt: rastreamento bloqueado'))
            .length >= 10
        ) {
          failures.push('/robots.txt: outras páginas também estão bloqueadas');
          break;
        }
      }
    }
  }

  const pageFailures = await mapLimit(pages, concurrency, async (href) => {
    const url = new URL(href);
    try {
      const response = await get(url, url.pathname);
      const html = await response.text();
      const result = inspectPublicHtml(html, url, response.headers.get('x-robots-tag'));
      return result.issues.map((issue) => `${url.pathname}: ${issue}`);
    } catch (error) {
      return [error.message];
    }
  });
  failures.push(...pageFailures.flat());
  if (pages.length) console.log(`✓ ${pages.length} páginas do sitemap consultadas`);
  return pages.length;
}

async function checkApi(api, failures) {
  console.log(`API: ${api.origin}`);
  for (const path of ['/healthz', '/readyz']) {
    try {
      await get(new URL(path, api), path);
      console.log(`✓ ${path}`);
    } catch (error) {
      failures.push(error.message);
    }
  }

  try {
    const response = await get(
      new URL('/api/v1/publications/current', api),
      '/api/v1/publications/current',
    );
    let activation;
    try {
      activation = await response.json();
    } catch {
      throw new Error('/api/v1/publications/current: JSON inválido');
    }
    if (
      !Number.isSafeInteger(activation.generation) ||
      activation.generation < 0 ||
      !/^[a-f\d]{64}$/i.test(activation.publication ?? '') ||
      Number.isNaN(Date.parse(activation.activated_at ?? ''))
    ) {
      throw new Error('/api/v1/publications/current: edição ativa inválida');
    }
    console.log(`✓ /api/v1/publications/current (geração ${activation.generation})`);
  } catch (error) {
    failures.push(error.message);
  }
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${usage()}`);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(`${usage()}\n\nMARGEM_SITE_URL e MARGEM_API_URL também podem ser usados.`);
    return;
  }

  let site;
  let api;
  try {
    site = baseUrl(options.site, 'Site');
    if (options.api) api = baseUrl(options.api, 'API');
  } catch (error) {
    console.error(`${error.message}\n${usage()}`);
    process.exitCode = 2;
    return;
  }

  const failures = [];
  const pageCount = await checkSite(site, failures);
  if (api) await checkApi(api, failures);

  if (failures.length) {
    for (const failure of failures.slice(0, 30)) console.error(`✗ ${failure}`);
    if (failures.length > 30) console.error(`… mais ${failures.length - 30} falhas`);
    console.error(`Checagem reprovada: ${failures.length} falhas`);
    process.exitCode = 1;
  } else {
    console.log(`Checagem aprovada: ${pageCount} páginas públicas${api ? ' e API pronta' : ''}`);
  }
}

await main();
