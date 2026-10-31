import { describe, expect, it } from 'vitest';
import { assertBackupStable, assessCopies } from '../../scripts/backup-local.mjs';

const sha = 'a'.repeat(64);
const other = 'b'.repeat(64);
const inventory = {
  raw: [{ key: `raw/sha256/${sha}`, sha256: sha, bytes: 3 }],
  public: [{ key: 'publications/one/snapshot.json', sha256: other, bytes: 7 }],
};

describe('conferência da cópia local', () => {
  it('aceita somente cópias com tamanho e hash registrados', () => {
    expect(
      assessCopies(inventory, [
        { path: `raw/raw/sha256/${sha}`, sha256: sha, bytes: 3 },
        { path: 'public/publications/one/snapshot.json', sha256: other, bytes: 7 },
      ]),
    ).toEqual([]);
  });
  it('distingue objeto ausente de cópia divergente', () => {
    expect(
      assessCopies(inventory, [
        { path: 'public/publications/one/snapshot.json', sha256: other, bytes: 8 },
      ]),
    ).toEqual([
      { bucket: 'raw', sha256: sha, reason: 'missing' },
      { bucket: 'public', sha256: other, reason: 'corrupt' },
    ]);
  });
  it('rejeita chaves que tentam sair do diretório de cópia', () => {
    expect(() =>
      assessCopies({ raw: [{ key: '../outro', sha256: sha, bytes: 1 }], public: [] }, []),
    ).toThrow('identidade inválida');
  });
  it('recusa jobs ativos ou mudanças de geração e inventário detectadas na cópia', () => {
    const before = { generation: 6, running: 0, ...inventory };
    expect(() => assertBackupStable(before, before)).not.toThrow();
    expect(() => assertBackupStable({ ...before, running: 1 })).toThrow('jobs em andamento');
    expect(() => assertBackupStable(before, { ...before, running: 1 })).toThrow('mudou');
    expect(() => assertBackupStable(before, { ...before, generation: 7 })).toThrow('mudou');
    expect(() => assertBackupStable(before, { ...before, raw: [] })).toThrow('mudou');
  });
});
