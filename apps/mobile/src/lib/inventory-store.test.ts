import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createInventoryStore } from "./inventory-store";
import { InventoryController, type InventoryPorts, type InventorySnapshot, type InventoryDraft } from "@railcommand/domain";
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
      const privateReason = "Budget hold USD 2800; landed value USD 68000";
      const event = { id: "e", action: "reject", reason: privateReason };
      const online = { projectId: project, asOf: draft.updatedAt, lots: [], requests: [],
        events: [event, { ...event, action: "cost" }, { ...event, action: "configuration" }],
        finance: { budget: { base: 68000 } } } as unknown as InventorySnapshot;
      await store.cache(a, online, () => true);
      assert.equal(online.events[0].reason, privateReason);
      let raw = () => connections.get(a)!.prepare("SELECT payload FROM cache_records WHERE cache_key=?").get(`inventory:${project}`)!.payload as string;
      assert.doesNotMatch(raw(), /2800|68000|cost|configuration|reason/);
      // Pre-correction installed clients could have written this exact legacy row.
      await (await open(a)).runAsync("UPDATE cache_records SET payload=? WHERE cache_key=?", JSON.stringify(online), `inventory:${project}`);
      connections.get(a)!.close(); connections.delete(a);
      const offline = await store.readCache(a, project, () => true);
      assert.deepEqual(offline!.events.map((e) => e.action), ["reject"]);
      assert.doesNotMatch(raw(), /2800|68000|cost|configuration|reason/);
      const downgraded = new InventoryController({
        userId: a, projectId: project, current: () => true, online: () => false, uuid: randomUUID,
        read: async () => { throw Error("Offline after role downgrade"); },
        readCache: () => store.readCache(a, project, () => true), cache: async () => {},
        readDraft: async () => null, saveDraft: async () => {}, deleteDraft: async () => {},
        execute: async () => { throw Error("Offline"); }, receipt: async () => null,
      });
      await downgraded.open();
      assert.doesNotMatch(JSON.stringify(downgraded.snapshot), /2800|68000|cost|configuration|reason/);
      downgraded.dispose();
      for (const action of ["reject", "cancel", "cost", "configuration"] as const) {
        let calls = 0, receipt: import("@railcommand/domain").InventoryResult | null = null;
        const ports: InventoryPorts = {
          userId: a, projectId: project, current: () => true, online: () => true,
          uuid: randomUUID, read: async () => online,
          readCache: () => store.readCache(a, project, () => true), cache: (s) => store.cache(a, s, () => true),
          readDraft: () => store.readDraft(a, project, () => true), saveDraft: (d) => store.saveDraft(d, () => true),
          deleteDraft: () => store.deleteDraft(a, project, () => true), receipt: async () => receipt,
          execute: async (id, command) => {
            calls++;
            if (command.action === "settle") {
              assert.equal(id, (await store.readDraft(a, project, () => true))!.pending!.operationId);
              receipt = { ok: false, code: "operation_not_applied" }; return receipt;
            }
            assert.equal(command.reason, privateReason); throw Error("Synthetic pre-execution failure");
          },
        };
        await store.saveDraft(draft, () => true);
        const first = new InventoryController(ports); await first.open();
        await first.act({ action, requestId: "r", expectedVersion: 2, lotId: "original-lot", lotVersion: 7, costVersion: 3, reason: privateReason });
        const original = first.draft!.pending!.operationId;
        const rawDraft = () => connections.get(a)!.prepare("SELECT payload FROM record_drafts WHERE draft_key=?").get(`inventory:${project}`)!.payload as string;
        assert.doesNotMatch(rawDraft(), /2800|68000/);
        first.dispose(); connections.get(a)!.close(); connections.delete(a);
        const restarted = new InventoryController(ports); await restarted.open();
        assert.equal(restarted.draft?.pending?.operationId, original);
        assert.equal(restarted.draft?.pending?.command.receiptOnly, true);
        await restarted.act(); await restarted.recover(); assert.equal(calls, 1);
        assert.match(restarted.message, /No receipt.*original receipt/);
        assert.doesNotMatch(rawDraft(), /2800|68000/);
        assert.deepEqual(restarted.draft?.pending?.command, { action, receiptOnly: true, requestId: "r", expectedVersion: 2, lotId: "original-lot", lotVersion: 7, costVersion: 3 });
        await restarted.settle();
        assert.equal(restarted.draft?.pending, undefined);
        assert.equal(restarted.draft?.command.reason, "Field work");
        await restarted.edit({ quantity: 26 });
        assert.equal((await store.readDraft(a, project, () => true))?.command.quantity, 26);
        assert.equal(calls, 2);
        // Legacy unknown draft is scrubbed on read, keeping original identity.
        const legacy = { ...draft, phase: "unknown", pending: { operationId: original, command: { action, reason: privateReason } } };
        await (await open(a)).runAsync("UPDATE record_drafts SET payload=? WHERE draft_key=?", JSON.stringify(legacy), `inventory:${project}`);
        const sanitized = await store.readDraft(a, project, () => true);
        assert.equal(sanitized?.pending?.operationId, original);
        assert.equal(sanitized?.pending?.command.receiptOnly, true);
        assert.doesNotMatch(rawDraft(), /2800|68000/);
        restarted.dispose();
        // An old receipt-only envelope has no recoverable baselines. Settlement
        // still uses only its identity; it never invents versions from online data.
        const minimal = { ...legacy, pending: { operationId: original, command: { action, receiptOnly: true } } };
        await store.saveDraft(minimal as InventoryDraft, () => true);
        connections.get(a)!.close(); connections.delete(a);
        receipt = null;
        const oldClientRestart = new InventoryController(ports); await oldClientRestart.open();
        assert.deepEqual(oldClientRestart.draft?.pending?.command, { action, receiptOnly: true });
        await oldClientRestart.settle();
        assert.equal(oldClientRestart.draft?.pending, undefined);
        assert.equal(oldClientRestart.draft?.command.reason, "Field work");
        assert.doesNotMatch(rawDraft(), /2800|68000/);
        oldClientRestart.dispose();
        // Retain the original accepted-but-response-lost SQLite regression too:
        // a second process restart recovers its receipt without any execute.
        await store.saveDraft(minimal as InventoryDraft, () => true);
        connections.get(a)!.close(); connections.delete(a);
        receipt = { ok: true };
        const beforeRecovery = calls;
        const acceptedRestart = new InventoryController(ports); await acceptedRestart.open();
        await acceptedRestart.recover();
        assert.equal(acceptedRestart.draft?.pending, undefined);
        assert.equal(acceptedRestart.draft?.command.reason, "Field work");
        assert.equal(calls, beforeRecovery);
        acceptedRestart.dispose();
      }
      assert.equal((await (await open(a)).getFirstAsync<{id:string}>("SELECT * FROM outbox"))?.id, oldId);

    } finally {
      for (const db of connections.values()) db.close();
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
