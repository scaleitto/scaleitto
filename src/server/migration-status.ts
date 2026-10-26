// Result of the automatic migration at startup, read by /api/health.
type Status = { ok: boolean; error?: string } | null;

const store = globalThis as unknown as { __scaleittoMigration?: Status };

export function setMigrationStatus(status: Status) {
  store.__scaleittoMigration = status;
}

export function getMigrationStatus(): Status {
  return store.__scaleittoMigration ?? null;
}
