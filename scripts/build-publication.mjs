import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

function apiOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('MARGEM_API_URL deve apontar para uma origem HTTP(S).');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('MARGEM_API_URL deve ser uma origem HTTP(S) sem credenciais ou caminho.');
  }
  return url.origin;
}

async function currentPublication(origin, request) {
  const response = await request(`${origin}/api/v1/publications/current`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`Consulta da publicação atual falhou: HTTP ${response.status}.`);
  const current = await response.json();
  if (
    !Number.isSafeInteger(current.generation) ||
    current.generation < 1 ||
    typeof current.publication !== 'string' ||
    !/^[a-f0-9]{64}$/.test(current.publication)
  ) {
    throw new Error('A API retornou uma publicação atual inválida.');
  }
  return { generation: current.generation, publication: current.publication };
}

function run(command, args, env, cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0) resolveRun();
      else reject(new Error(`${command} falhou (${code ?? signal}).`));
    });
  });
}

async function buildInWorkspace(site, origin) {
  const env = { ...process.env, MARGEM_API_URL: origin };
  await run('pnpm', ['check'], env);
  // Astro moves assets into the output directory using rename, which requires one filesystem.
  const workspace = await mkdtemp(join(dirname(site), '.workspace-'));
  try {
    for (const entry of ['src', 'public', 'astro.config.mjs', 'tsconfig.json', 'package.json']) {
      await cp(join(root, entry), join(workspace, entry), { recursive: true });
    }
    const catalog = 'backend/internal/publications';
    await mkdir(join(workspace, catalog), { recursive: true });
    await cp(join(root, catalog, 'indicators.json'), join(workspace, catalog, 'indicators.json'));
    await symlink(join(root, 'node_modules'), join(workspace, 'node_modules'), 'dir');
    await run(
      process.execPath,
      [join(root, 'node_modules/astro/bin/astro.mjs'), 'build', '--outDir', site],
      env,
      workspace,
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function verifyPublicationNotes(dir, expected) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await verifyPublicationNotes(path, expected);
    else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = await readFile(path, 'utf8');
      for (const match of html.matchAll(/\bdata-publication="([^"]*)"/g)) {
        if (match[1] !== expected) throw new Error('O HTML gerado contém outra publicação.');
      }
    }
  }
}

// A ready marker is written only after the generated HTML and current generation agree.
export async function buildPublication({ api, outputRoot, request = fetch, build }) {
  const origin = apiOrigin(api);
  const before = await currentPublication(origin, request);
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(join(resolve(outputRoot), 'edition-'));
  const site = join(directory, 'site');
  await build(site, origin);
  const html = await readFile(join(site, 'auditoria', 'index.html'), 'utf8');
  if (!html.includes(`data-publication="${before.publication}"`)) {
    throw new Error('O HTML gerado não corresponde à publicação inicial.');
  }
  await verifyPublicationNotes(site, before.publication);
  const after = await currentPublication(origin, request);
  if (before.publication !== after.publication || before.generation !== after.generation) {
    throw new Error('A publicação ativa mudou durante o build; gere outra versão.');
  }
  await writeFile(join(directory, 'ready.json'), `${JSON.stringify(before, null, 2)}\n`, {
    flag: 'wx',
  });
  return { ...before, directory, site };
}

async function main() {
  const result = await buildPublication({
    api: process.env.MARGEM_API_URL,
    outputRoot: join(root, '.data', 'publication-builds'),
    build: buildInWorkspace,
  });
  console.log(`Build pronto: geração ${result.generation}, publicação ${result.publication}`);
  console.log(`Artefato local: ${result.site}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Build não concluído: ${error.message}`);
    process.exitCode = 1;
  });
}
