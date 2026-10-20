import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInventoryStore } from "./inventory-store";
import type { InventoryDraft } from "@railcommand/domain";
type Adapter = {
  runAsync(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
  getFirstAsync<T>(
    sql: string,
    ...params: (string | number | null)[]
  ): Promise<T | null>;
  withExclusiveTransactionAsync(
    work: (tx: Adapter) => Promise<void>,
  ): Promise<void>;
};
describe("inventory actual SQLite persistence and isolation", () => {
  it("survives a closed connection, A → B → A, preserves old work, and rolls back a quota/save failure", async () => {
    const folder = mkdtempSync(join(tmpdir(), "tia-sqlite-"));
    const connections = new Map<string, DatabaseSync>();
    const open = async (user: string) => {
      let db = connections.get(user);
      if (!db) {
        db = new DatabaseSync(join(folder, `${user}.db`));
        db.exec(
          "CREATE TABLE IF NOT EXISTS record_drafts(draft_key TEXT PRIMARY KEY,payload TEXT,updated_at TEXT);CREATE TABLE IF NOT EXISTS cache_records(cache_key TEXT PRIMARY KEY,payload TEXT,cached_at TEXT);CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,payload TEXT)",
        );
        connections.set(user, db);
      }
      const local = db;
      const adapter: Adapter = {
        async runAsync(sql: string, ...params: (string | number | null)[]) {
          return local.prepare(sql).run(...params);
        },
        async getFirstAsync<T>(
          sql: string,
          ...params: (string | number | null)[]
        ) {
          return (local.prepare(sql).get(...params) ?? null) as T | null;
        },
        async withExclusiveTransactionAsync(
          work: (tx: Adapter) => Promise<void>,
        ) {
          local.exec("BEGIN IMMEDIATE");
          try {
            await work(adapter);
            local.exec("COMMIT");
          } catch (e) {
            local.exec("ROLLBACK");
            throw e;
          }
        },
      };
      return adapter;
    };
    const store = createInventoryStore(open),
      a = randomUUID(),
      b = randomUUID(),
      project = randomUUID(),
      oldId = randomUUID();
    try {
      const db = await open(a);
      await db.runAsync(
        "INSERT INTO outbox VALUES(?,?)",
        oldId,
        "old-log-and-photo-identities",
      );
      const draft: InventoryDraft = {
        schemaVersion: 1,
        userId: a,
        projectId: project,
        operationId: randomUUID(),
        phase: "editing",
        updatedAt: new Date().toISOString(),
        command: {
          action: "submit",
          lotId: randomUUID(),
          quantity: 100,
          lotVersion: 7,
          workLocation: "Milepost 1",
          reason: "Field work",
        },
      };
      await store.saveDraft(draft, () => true);
      connections.get(a)!.close();
      connections.delete(a);
      assert.deepEqual(await store.readDraft(a, project, () => true), draft);
      assert.equal(await store.readDraft(b, project, () => true), null);
      assert.deepEqual(await store.readDraft(a, project, () => true), draft);
      connections
        .get(a)!
        .exec(
          "CREATE TRIGGER synthetic_quota BEFORE UPDATE ON record_drafts BEGIN SELECT RAISE(ABORT,'SQLITE_FULL: synthetic quota'); END",
        );
      await assert.rejects(
        store.saveDraft(
          { ...draft, command: { ...draft.command, quantity: 200 } },
          () => true,
        ),
        /SQLITE_FULL/,
      );
      assert.deepEqual(await store.readDraft(a, project, () => true), draft);
      connections.get(a)!.exec("DROP TRIGGER synthetic_quota");
      await assert.rejects(
        store.saveDraft(
          { ...draft, command: { ...draft.command, quantity: 300 } },
          () => false,
        ),
        /Account changed/,
      );
      assert.deepEqual(await store.readDraft(a, project, () => true), draft);
      assert.equal(
        (
          await (
            await open(a)
          ).getFirstAsync<{ id: string }>("SELECT * FROM outbox")
        )?.id,
        oldId,
      );
      await store.saveDraft(
        {
          ...draft,
          phase: "unknown",
          pending: { operationId: draft.operationId, command: draft.command },
        },
        () => true,
      );
      connections.get(a)!.close();
      connections.delete(a);
      assert.equal(
        (await store.readDraft(a, project, () => true))?.pending?.operationId,
        draft.operationId,
      );
    } finally {
      for (const db of connections.values()) db.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
