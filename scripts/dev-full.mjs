import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const children = new Set();
let stopping = false;
let resolveStopped;
const stopped = new Promise((resolve) => {
  resolveStopped = resolve;
});

function finishIfStopped() {
  if (stopping && children.size === 0) resolveStopped();
}

function signalChild(child, signal) {
  try {
    if (process.platform === 'win32' || child.pid === undefined) child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

function stop(signal, exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  for (const child of children) signalChild(child, signal);
  const forceStop = setTimeout(() => {
    for (const child of children) signalChild(child, 'SIGKILL');
  }, 5000);
  forceStop.unref();
  finishIfStopped();
}

process.on('SIGINT', () => {
  console.log('\nEncerrando front e API...');
  console.log(
    'PostgreSQL e LocalStack continuam ativos. O S3 local pode perder os objetos ao reiniciar; preserve uma cópia antes de pará-lo.',
  );
  stop('SIGINT', 0);
});
process.on('SIGTERM', () => stop('SIGTERM', 0));

function launch(command, args, { service = false, env = process.env } = {}) {
  const child = spawn(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
  });
  children.add(child);

  let spawnError;
  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });

  child.once('error', (error) => {
    spawnError = error;
  });
  child.once('close', (code, signal) => {
    children.delete(child);
    resolveClosed({ code, signal, error: spawnError });
    if (service && !stopping) {
      console.error(`${command} encerrou inesperadamente (código ${code ?? signal}).`);
      stop('SIGTERM', 1);
    }
    finishIfStopped();
  });

  return { child, closed };
}

async function run(command, args) {
  const { closed } = launch(command, args);
  const result = await closed;
  if (result.error) throw result.error;
  if (result.code !== 0)
    throw new Error(`${command} encerrou com código ${result.code ?? 'desconhecido'}.`);
}

function loopback(hostname) {
  return ['127.0.0.1', '::1', 'localhost'].includes(hostname.replace(/^\[|\]$/g, ''));
}

function localURL(value, name, { protocol, port }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} precisa apontar para os serviços locais do backend/compose.yaml.`);
  }
  if (url.protocol !== protocol || !loopback(url.hostname) || url.port !== port) {
    throw new Error(`${name} precisa apontar para os serviços locais do backend/compose.yaml.`);
  }
  return url;
}

function apiAddress() {
  const address = process.env.API_ADDR || '127.0.0.1:8080';
  let url;
  try {
    url = new URL(`http://${address}`);
  } catch {
    throw new Error('API_ADDR precisa usar um endereço local, como 127.0.0.1:8080.');
  }
  if (
    !loopback(url.hostname) ||
    !url.port ||
    url.port === '0' ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error('API_ADDR precisa usar um endereço local, como 127.0.0.1:8080.');
  }
  return {
    address,
    origin: url.origin,
    host: url.hostname.replace(/^\[|\]$/g, ''),
    port: Number(url.port),
  };
}

async function ensurePortAvailable({ address, host, port }) {
  const server = createServer();
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen({ host, port, exclusive: true }, resolve);
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      throw new Error(
        `A porta ${address} já está ocupada. Encerre a API existente antes de iniciar.`,
      );
    }
    throw error;
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
}

function validateLocalConfig() {
  localURL(process.env.DATABASE_URL ?? '', 'DATABASE_URL', {
    protocol: 'postgresql:',
    port: '55437',
  });
  localURL(process.env.S3_ENDPOINT_URL ?? '', 'S3_ENDPOINT_URL', {
    protocol: 'http:',
    port: '59007',
  });
  return apiAddress();
}

async function waitForAPI(child, origin) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (stopping || child.exitCode !== null)
      throw new Error('A API encerrou durante a inicialização.');
    try {
      const response = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // A API pode levar um instante para abrir a porta depois da conexão ao banco.
    }
    await delay(250);
  }
  throw new Error('A API não respondeu em até 30 segundos.');
}

async function useLocalAPIWhenPublished(origin) {
  if (process.env.MARGEM_API_URL) return;

  const currentResponse = await fetch(`${origin}/api/v1/publications/current`, {
    signal: AbortSignal.timeout(3000),
  });
  const current = await currentResponse.json().catch(() => null);
  if (currentResponse.ok && /^[a-f0-9]{64}$/.test(current?.publication ?? '')) {
    const projectionResponse = await fetch(`${origin}/api/v1/publications/${current.publication}`, {
      signal: AbortSignal.timeout(5000),
    });
    const projection = await projectionResponse.json().catch(() => null);
    if (
      projectionResponse.status === 503 &&
      projection?.error?.code === 'temporarily_unavailable'
    ) {
      console.warn(
        `A publicação ${current.publication} está ativa, mas sua projeção não está disponível. ` +
          'O Astro seguirá com o catálogo local sem observações.',
      );
      return;
    }
    if (!projectionResponse.ok) {
      throw new Error(
        `Não foi possível carregar a projeção local (HTTP ${projectionResponse.status}).`,
      );
    }
    process.env.MARGEM_API_URL = origin;
    console.log(`Publicação ativa encontrada; o Astro usará a API local em ${origin}.`);
    return;
  }
  if (currentResponse.status === 404 && current?.error?.code === 'not_covered') {
    console.log('Sem publicação ativa; o Astro usará o catálogo local sem observações.');
    return;
  }
  throw new Error(
    `Não foi possível consultar a publicação atual da API (HTTP ${currentResponse.status}).`,
  );
}

async function start() {
  const api = validateLocalConfig();
  await ensurePortAvailable(api);

  console.log('Iniciando PostgreSQL e LocalStack...');
  await run('docker', ['compose', '-f', 'backend/compose.yaml', 'up', '-d', '--wait']);

  console.log('Aplicando migrações locais...');
  await run('pnpm', ['pipeline', 'migrate']);

  console.log(`Iniciando API em ${api.address}...`);
  const apiProcess = launch('pnpm', ['pipeline', 'serve'], { service: true });
  await waitForAPI(apiProcess.child, api.origin);
  await useLocalAPIWhenPublished(api.origin);

  console.log('Iniciando Astro em http://localhost:4321/ ...');
  // Astro otherwise backgrounds itself when it detects an agent, outside this process supervisor.
  launch('pnpm', ['dev'], {
    service: true,
    env: { ...process.env, ASTRO_DEV_BACKGROUND: '0' },
  });
  await stopped;
}

try {
  await start();
} catch (error) {
  if (!stopping) {
    console.error(`Não foi possível iniciar a aplicação: ${error.message}`);
    stop('SIGTERM', 1);
  }
  await stopped;
}
