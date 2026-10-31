type BackupFile = { path: string; bytes: number; sha256: string };
type ObjectRecord = { key: string; sha256: string; bytes: number };
export function assessCopies(
  snapshotData: { raw: ObjectRecord[]; public: ObjectRecord[] },
  files: BackupFile[],
): { bucket: string; sha256: string; reason: string }[];
export function assertBackupStable(
  before: { generation: number; running: number; raw: ObjectRecord[]; public: ObjectRecord[] },
  after?: { generation: number; running: number; raw: ObjectRecord[]; public: ObjectRecord[] },
): void;
