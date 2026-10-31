import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, createReadStream, openSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const compose = ['compose', '-f', 'backend/compose.yaml'];
const snapshotSQL = `SELECT json_build_object(
  'generation',(SELECT generation FROM published.channel WHERE id='public'),
  'running',(SELECT count(*) FROM ops.run WHERE status='running'),
  'raw',(SELECT COALESCE(json_agg(json_build_object('key',key,'sha256',sha256,'bytes',bytes) ORDER BY key),'[]'::json) FROM raw.object),
  'public',(SELECT COALESCE(json_agg(json_build_object('key',projection_key,'sha256',projection_sha256,'bytes',projection_bytes) ORDER BY projection_key),'[]'::json) FROM published.publication))`;

function docker(args, { stdout = 'pipe', stdin = 'ignore' } = {}) {
  const result = spawnSync('docker', [...compose, ...args], {
    cwd: root,
    stdio: [stdin, stdout, 'pipe'],
    encoding: stdout === 'pipe' ? 'utf8' : undefined,
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error(`Falha em docker compose ${args[0]}.`);
  return result.stdout;
}

function snapshot() {
  const text = docker([
    'exec',
    '-T',
    'postgres',
    'psql',
    '-U',
    'margem',
    '-d',
    'margem',
    '-Atc',
    snapshotSQL,
  ]);
  const data = JSON.parse(text);
  if (
    !Number.isSafeInteger(data.generation) ||
    data.generation < 0 ||
    !Number.isSafeInteger(data.running) ||
    !Array.isArray(data.raw) ||
    !Array.isArray(data.public)
  ) {
    throw new Error('Inventário do banco inválido.');
  }
  return data;
}

async function fileDigest(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function listFiles(base, directory = base) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(base, path)));
    else if (entry.isFile())
      files.push({
        path: relative(base, path).split(sep).join('/'),
        bytes: (await stat(path)).size,
        sha256: await fileDigest(path),
      });
    else throw new Error('A cópia contém um arquivo especial ou link simbólico.');
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function assessCopies(snapshotData, files) {
  const byPath = new Map(files.map((file) => [file.path, file]));
  const failures = [];
  for (const bucket of ['raw', 'public']) {
    for (const object of snapshotData[bucket]) {
      if (
        typeof object.key !== 'string' ||
        object.key.startsWith('/') ||
        object.key.split('/').some((part) => !part || part === '.' || part === '..') ||
        !/^[a-f0-9]{64}$/.test(object.sha256) ||
        !Number.isSafeInteger(object.bytes) ||
        object.bytes < 0
      ) {
        throw new Error('Objeto registrado com identidade inválida.');
      }
      const file = byPath.get(`${bucket}/${object.key}`);
      if (!file) failures.push({ bucket, sha256: object.sha256, reason: 'missing' });
      else if (file.bytes !== object.bytes || file.sha256 !== object.sha256)
        failures.push({ bucket, sha256: object.sha256, reason: 'corrupt' });
    }
  }
  return failures;
}

export function assertBackupStable(before, after) {
  if (before.running)
    throw new Error('Há jobs em andamento; interrompa os escritores antes da cópia.');
  if (after && (after.running || JSON.stringify(before) !== JSON.stringify(after))) {
    throw new Error('O inventário mudou durante a cópia.');
  }
}

async function main() {
  const before = snapshot();
  assertBackupStable(before);
  const backupRoot = join(root, '.data', 'local-backups');
  await mkdir(backupRoot, { recursive: true, mode: 0o700 });
  const directory = await mkdtemp(join(backupRoot, 'backup-'));
  await chmod(directory, 0o700);
  const objects = join(directory, 'objects');
  await mkdir(objects, { mode: 0o700 });
  const dump = join(directory, 'database.dump');
  const fd = openSync(dump, 'wx', 0o600);
  try {
    docker(['exec', '-T', 'postgres', 'pg_dump', '-U', 'margem', '-d', 'margem', '-Fc'], {
      stdout: fd,
    });
  } finally {
    closeSync(fd);
  }
  const dumpInput = openSync(dump, 'r');
  try {
    docker(['exec', '-T', 'postgres', 'pg_restore', '-l'], { stdin: dumpInput, stdout: 'ignore' });
  } finally {
    closeSync(dumpInput);
  }
  const scratch = `/tmp/margem-local-backup-${randomUUID()}`;
  let created = false;
  try {
    docker(['exec', '-T', 's3', 'mkdir', '-m', '700', scratch]);
    created = true;
    for (const bucket of ['raw', 'public']) {
      docker([
        'exec',
        '-T',
        's3',
        'awslocal',
        's3',
        'sync',
        `s3://margem-${bucket}`,
        `${scratch}/${bucket}`,
        '--only-show-errors',
      ]);
    }
    docker(['cp', `s3:${scratch}/.`, objects]);
  } finally {
    if (created) docker(['exec', '-T', 's3', 'rm', '-rf', '--', scratch]);
  }
  const files = await listFiles(objects);
  const failures = assessCopies(before, files);
  const after = snapshot();
  try {
    assertBackupStable(before, after);
  } catch (error) {
    throw new Error(`${error.message} Artefato não validado em ${directory}.`);
  }
  const manifest = {
    status: failures.length ? 'partial' : 'objects_verified',
    captured_at: new Date().toISOString(),
    generation: before.generation,
    expected_objects: { raw: before.raw.length, public: before.public.length },
    database: {
      path: 'database.dump',
      bytes: (await stat(dump)).size,
      sha256: await fileDigest(dump),
    },
    files,
    failures,
    consistency: 'not_atomic_across_services',
  };
  await writeFile(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  });
  console.log(`Cópia ${manifest.status}: ${directory}`);
  console.log(
    `Objetos copiados: ${files.length}; referências ausentes ou divergentes: ${failures.length}.`,
  );
  if (failures.length) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`Cópia não concluída: ${error.message}`);
    process.exitCode = 1;
  });
}
