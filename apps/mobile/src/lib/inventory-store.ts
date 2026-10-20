import {
  inventoryDeviceDraft,
  operationalInventory,
  parseInventoryDraft,
  type InventoryDraft,
  type InventorySnapshot,
} from "@railcommand/domain";
type SqlDatabase = {
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T | null>;
  withExclusiveTransactionAsync(
    work: (db: SqlDatabase) => Promise<void>,
  ): Promise<void>;
};
/** Uses existing user-scoped SQLite tables additively; old log/photo identities are untouched. */
export function createInventoryStore(
  open: (userId: string) => Promise<SqlDatabase>,
) {
  return {
    async saveDraft(d: InventoryDraft, current: () => boolean) {
      const db = await open(d.userId);
      await db.withExclusiveTransactionAsync(async (tx) => {
        if (!current())
          throw new Error("Account changed; device save canceled");
        await tx.runAsync(
          "INSERT INTO record_drafts(draft_key,payload,updated_at) VALUES(?,?,?) ON CONFLICT(draft_key) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
          `inventory:${d.projectId}`,
          JSON.stringify(inventoryDeviceDraft(d)),
          d.updatedAt,
        );
        if (!current())
          throw new Error("Account changed; device save canceled");
      });
    },
    async readDraft(user: string, project: string, current: () => boolean) {
      const db = await open(user);
      const row = await db.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM record_drafts WHERE draft_key=?",
        `inventory:${project}`,
      );
      if (!current()) return null;
      if (!row) return null;
      const d = parseInventoryDraft(JSON.parse(row.payload), user, project);
      if (!d)
        throw new Error(
          "Saved inventory draft needs a supported app version; it was preserved.",
        );
      return d;
    },
    async deleteDraft(user: string, project: string, current: () => boolean) {
      const db = await open(user);
      if (!current()) throw new Error("Account changed");
      await db.runAsync(
        "DELETE FROM record_drafts WHERE draft_key=?",
        `inventory:${project}`,
      );
    },
    async cache(user: string, s: InventorySnapshot, current: () => boolean) {
      const db = await open(user);
      if (!current()) throw new Error("Account changed");
      await db.runAsync(
        "INSERT INTO cache_records(cache_key,payload,cached_at) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET payload=excluded.payload,cached_at=excluded.cached_at",
        `inventory:${s.projectId}`,
        JSON.stringify(operationalInventory(s)),
        s.asOf,
      );
    },
    async readCache(user: string, project: string, current: () => boolean) {
      const db = await open(user);
      const row = await db.getFirstAsync<{ payload: string }>(
        "SELECT payload FROM cache_records WHERE cache_key=?",
        `inventory:${project}`,
      );
      if (!current() || !row) return null;
      return operationalInventory(JSON.parse(row.payload) as InventorySnapshot);
    },
  };
}
