import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// go -C changes the child's working directory. Preserve the caller's path
// semantics for the existing `pnpm pipeline import-poc --root ...` command.
const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--root' || args[i] === '-root') {
    if (args[i + 1]) {
      i += 1;
      args[i] = resolve(args[i]);
    }
  } else if (args[i].startsWith('--root=') || args[i].startsWith('-root=')) {
    const separator = args[i].indexOf('=');
    args[i] = `${args[i].slice(0, separator + 1)}${resolve(args[i].slice(separator + 1))}`;
  }
}
const result = spawnSync('go', ['-C', backend, 'run', './cmd/margem', ...args], {
  stdio: 'inherit',
});
if (result.error) console.error(`Não foi possível executar Go: ${result.error.code}`);
process.exitCode = result.status ?? 1;
