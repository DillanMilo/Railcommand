import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  basicHoldingExample,
  budgetEvaluation,
  COST_BUCKETS,
  inventoryDeviceDraft,
  operationalInventory,
  InventoryController,
  type InventorySnapshot,
  type InventoryDraft,
  type InventoryPorts,
} from "@railcommand/domain";
describe("Phase 1 shared contracts", () => {
  it("keeps Wendy’s exact taxonomy and explicitly supplied example separate", () => {
    assert.deepEqual(COST_BUCKETS, [
      "log",
      "mill",
      "trucking",
      "treating",
      "drying",
      "creosote",
      "rail_car",
      "install_labour",
      "inspection",
      "carrying_cost",
      "disposal",
    ]);
    assert.deepEqual(
      basicHoldingExample(
        [20000, 10000, 8000, 6000, 4000, 12000, 8000],
        30,
        0.08,
        60,
        42000,
      ),
      {
        landed: 68000,
        holding: 2694.25,
        landedAndHolding: 70694.25,
        installedBasic: 112694.25,
      },
    );
  });
  it("adds only distinct incremental exposure and holds unknown funding", () => {
    const b = {
      base: 130000,
      adjusted: 130000,
      spent: 126000,
      postedNewExposure: 0,
      changeOrders: [],
    };
    const source = {
      id: "s",
      source_key: "s",
      source: "source",
      funding: "funded" as const,
      amount: 6800,
      milestone_id: null,
      change_order_id: null,
    };
    assert.equal(budgetEvaluation(b, source, false).state, "within_budget");
    assert.equal(budgetEvaluation(b, source, false).forecast, 126000);
    assert.equal(
      budgetEvaluation(b, { ...source, funding: "new" }, false).shortfall,
      2800,
    );
    assert.equal(
      budgetEvaluation(
        { ...b, adjusted: 133000 },
        { ...source, funding: "new" },
        false,
      ).headroom,
      200,
    );
    assert.equal(budgetEvaluation(b, undefined, false).state, "unknown");
  });
  it("strips online finance and does not cache financial editor payloads", () => {
    const s = {
      projectId: "p",
      finance: { budget: { base: 9 } },
    } as unknown as InventorySnapshot;
    assert.deepEqual(operationalInventory(s), { projectId: "p" });
    const d = {
      command: { action: "submit" },
      pending: {
        operationId: "op",
        command: {
          action: "configuration",
          annualRate: 0.08,
          thresholdAmount: 99999,
        },
      },
    } as unknown as InventoryDraft;
    assert.deepEqual(inventoryDeviceDraft(d).pending, {
      operationId: "op",
      command: { action: "configuration", receiptOnly: true },
    });
    const legacy = { ...d, operationId: "original-private-operation", phase: "editing",
      pending: undefined, command: { action: "reject", reason: "Private commercial decision" } } as InventoryDraft;
    const safe = inventoryDeviceDraft(legacy);
    assert.equal(safe.phase, "unknown");
    assert.deepEqual(safe.pending, { operationId: "original-private-operation", command: { action: "reject", receiptOnly: true } });
    assert.doesNotMatch(JSON.stringify(safe), /Private commercial decision/);
  });
  it("persists the exact operation before sending and recovers a lost response without a new identity", async () => {
    const userId = randomUUID(),
      projectId = randomUUID(),
      snapshot = {
        projectId,
        asOf: new Date().toISOString(),
        canManage: false,
        assignments: null,
        lots: [],
        requests: [],
        events: [],
        denials: [],
      } satisfies InventorySnapshot;
    let saved: InventoryDraft | null = null,
      online = true,
      sent = 0;
    const order: string[] = [];
    let receipt: import("@railcommand/domain").InventoryResult | null = null;
    const ports: InventoryPorts = {
      userId,
      projectId,
      current: () => true,
      online: () => online,
      uuid: randomUUID,
      read: async () => snapshot,
      cache: async () => {},
      readCache: async () => null,
      readDraft: async () => saved,
      saveDraft: async (d) => {
        saved = structuredClone(d);
        order.push("saved");
      },
      deleteDraft: async () => {
        saved = null;
      },
      execute: async (id, c) => {
        assert.equal(saved?.pending?.operationId, id);
        assert.deepEqual(saved?.pending?.command, c);
        order.push("sent");
        sent++;
        receipt = { ok: true, requestId: "synthetic-request" };
        throw Error("Synthetic dropped response");
      },
      receipt: async () => receipt,
    };
    const c = new InventoryController(ports);
    await c.open();
    await c.edit({
      lotId: "lot",
      lotVersion: 1,
      quantity: 100,
      workLocation: "Milepost 1",
      reason: "Maintenance",
    });
    const id = c.draft!.operationId;
    online = false;
    await c.act();
    assert.equal(sent, 0);
    online = true;
    await c.act();
    assert.equal(c.draft!.pending!.operationId, id);
    assert.equal(c.draft!.phase, "unknown");
    c.dispose();
    const reopened = new InventoryController(ports);
    await reopened.open();
    await reopened.recover();
    assert.equal(reopened.draft, null);
    assert.equal(saved, null);
    assert.equal(sent, 1);
    assert.ok(order.indexOf("sent") > order.indexOf("saved"));
  });
  it("keeps authorized online event evidence but persists only an allowlisted operational shape", () => {
    const privateReason = "Budget hold USD 2800; landed value USD 68000";
    const event = { id: "e", request_id: "r", actor_id: "pm", action: "reject", revision: 1,
      previous_state: "verified", next_state: "rejected", reason: privateReason, created_at: "now" };
    const snapshot = { projectId: "p", events: [event, { ...event, action: "cost" },
      { ...event, action: "configuration" }, { ...event, action: "future_finance" }],
      finance: { budget: { base: 68000 } } } as unknown as InventorySnapshot;
    const safe = operationalInventory(snapshot);
    assert.equal(snapshot.events[0].reason, privateReason);
    assert.deepEqual(safe.events.map((e) => e.action), ["reject"]);
    assert.equal("reason" in safe.events[0], false);
    assert.doesNotMatch(JSON.stringify(safe), /2800|68000|finance|configuration|cost/);
    assert.deepEqual(operationalInventory(safe), safe);
  });
  it("retains private decision input only in memory and recovers the original receipt after restart without redacted replay", async () => {
    for (const action of ["reject", "cancel", "cost", "configuration"] as const) {
      let saved: InventoryDraft | null = null, sent = 0;
      let receipt: import("@railcommand/domain").InventoryResult | null = null;
      const snapshot = { projectId: "p", lots: [], events: [] } as unknown as InventorySnapshot;
      const ports: InventoryPorts = {
        userId: "u", projectId: "p", current: () => true, online: () => true,
        uuid: randomUUID, read: async () => snapshot, cache: async () => {}, readCache: async () => null,
        readDraft: async () => saved, saveDraft: async (d) => { saved = structuredClone(inventoryDeviceDraft(d)); },
        deleteDraft: async () => { saved = null; }, receipt: async () => receipt,
        execute: async (id, command) => {
          assert.equal(saved?.pending?.operationId, id);
          assert.equal(command.reason, "Budget hold USD 2800; landed value USD 68000");
          assert.doesNotMatch(JSON.stringify(saved), /2800|68000/);
          sent++;
          throw Error("Synthetic lost response");
        },
      };
      const first = new InventoryController(ports);
      await first.open();
      await first.edit({ lotId: "lot", quantity: 100, reason: "Durable field request" });
      await first.act({ action, requestId: "r", expectedVersion: 2,
        reason: "Budget hold USD 2800; landed value USD 68000" });
      const original = first.draft!.pending!.operationId;
      assert.equal(first.draft!.pending!.command.reason, "Budget hold USD 2800; landed value USD 68000");
      first.dispose();
      const reopened = new InventoryController(ports);
      await reopened.open();
      assert.equal(reopened.draft?.pending?.operationId, original);
      assert.equal(reopened.draft?.pending?.command.receiptOnly, true);
      await reopened.act({ action, reason: "Different re-entered input" });
      assert.equal(sent, 1);
      await reopened.recover();
      assert.match(reopened.message, /No receipt.*original receipt/);
      assert.equal(reopened.draft?.pending?.operationId, original);
      receipt = { ok: true, requestId: "r" };
      await reopened.recover();
      assert.equal(reopened.draft?.pending, undefined);
      assert.equal(reopened.draft?.command.reason, "Durable field request");
      assert.notEqual(reopened.draft?.operationId, original);
    }
  });
  it("settles never-received private actions and legacy minimal envelopes without replay, preserving field work", async () => {
    for (const action of ["reject", "cancel", "cost", "configuration"] as const) {
      for (const legacy of [false, true]) {
        let saved: InventoryDraft | null = null;
        let receipt: import("@railcommand/domain").InventoryResult | null = null;
        let originalId = "", calls = 0;
        const ports: InventoryPorts = {
          userId: "u", projectId: "p", current: () => true, online: () => true, uuid: randomUUID,
          read: async () => ({ projectId: "p", lots: [], events: [] }) as unknown as InventorySnapshot,
          readCache: async () => null, cache: async () => {}, readDraft: async () => saved,
          saveDraft: async d => { saved = structuredClone(inventoryDeviceDraft(d)); },
          deleteDraft: async () => { saved = null; }, receipt: async () => receipt,
          execute: async (id, command) => {
            calls++;
            if (command.action !== "settle") {
              originalId = id;
              throw Error("Transport failed before execution");
            }
            assert.equal(id, originalId);
            assert.deepEqual(command, { action: "settle" });
            receipt = { ok: false, code: "operation_not_applied", error: "Original operation was not applied" };
            return receipt;
          },
        };
        const first = new InventoryController(ports); await first.open();
        await first.edit({ lotId: "field-lot", quantity: 25, reason: "Saved ordinary work" });
        await first.act({ action, requestId: "original-request", lotId: "original-lot",
          expectedVersion: 2, lotVersion: 7, costVersion: 3, reason: "USD 68000 private",
          components: { log: 68000 }, annualRate: 0.08 });
        assert.deepEqual(saved!.pending!.command, { action, receiptOnly: true,
          requestId: "original-request", lotId: "original-lot", expectedVersion: 2, lotVersion: 7, costVersion: 3 });
        if (legacy) saved!.pending!.command = { action, receiptOnly: true };
        first.dispose();
        const restarted = new InventoryController(ports); await restarted.open();
        await restarted.recover(); await restarted.act(); assert.equal(calls, 1);
        assert.equal(restarted.draft!.pending!.operationId, originalId);
        assert.doesNotMatch(JSON.stringify(saved), /68000|annualRate|components/);
        await restarted.settle();
        assert.equal(calls, 2); assert.equal(restarted.draft!.pending, undefined);
        assert.equal(restarted.draft!.command.quantity, 25);
        await restarted.edit({ quantity: 26 });
        assert.equal(saved!.command.quantity, 26);
        assert.notEqual(saved!.operationId, originalId);
      }
    }
  });
  it("settlement uses only a durable original receipt, including accepted response loss, conflicts and denied settlement", async () => {
    let saved: InventoryDraft | null = null;
    let receipt: import("@railcommand/domain").InventoryResult | null = null;
    let phase = "lost", calls = 0;
    const ports: InventoryPorts = {
      userId: "u", projectId: "p", current: () => true, online: () => true, uuid: randomUUID,
      read: async () => ({ lots: [], events: [] }) as unknown as InventorySnapshot,
      cache: async () => {}, readCache: async () => null, readDraft: async () => saved,
      saveDraft: async d => { saved = structuredClone(inventoryDeviceDraft(d)); }, deleteDraft: async () => { saved = null; },
      receipt: async () => receipt,
      execute: async () => {
        calls++;
        if (phase === "lost") throw Error("Lost response");
        if (phase === "denied") return { code: "denied" };
        return { code: "operation_conflict" };
      },
    };
    const c = new InventoryController(ports); await c.open();
    await c.edit({ lotId: "lot", reason: "Preserved", quantity: 25 });
    await c.act({ action: "reject", requestId: "r", expectedVersion: 2, reason: "Private" });
    const original = c.draft!.pending!.operationId;
    phase = "denied"; await c.settle();
    assert.equal(c.draft!.pending!.operationId, original); // no fabricated terminal receipt
    phase = "conflict"; await c.act();
    assert.equal(c.draft!.pending!.operationId, original); // null lookup cannot clear it
    receipt = { ok: true, requestId: "original-accepted" };
    await c.act(); // changed-payload conflict recovers accepted original, not a new mutation
    assert.equal(c.draft!.pending, undefined); assert.equal(c.draft!.command.reason, "Preserved");
    await c.act({ action: "cost", lotId: "lot", costVersion: 1 });
    // Conflict receipt resolves the original; no extra execute is needed to recover it.
    assert.equal(c.draft!.pending, undefined); assert.equal(calls, 5);
  });
  it("recovers a lost settlement response after another restart without replay or a new identity", async () => {
    let saved: InventoryDraft | null = { schemaVersion: 1, userId: "u", projectId: "p", operationId: "field",
      updatedAt: "now", phase: "unknown", command: { action: "submit", lotId: "lot", quantity: 25 },
      pending: { operationId: "original-private", command: { action: "configuration", receiptOnly: true } } };
    let receipt: import("@railcommand/domain").InventoryResult | null = null, calls = 0;
    const ports: InventoryPorts = {
      userId: "u", projectId: "p", current: () => true, online: () => true, uuid: randomUUID,
      read: async () => ({ lots: [], events: [] }) as unknown as InventorySnapshot,
      cache: async () => {}, readCache: async () => null, readDraft: async () => saved,
      saveDraft: async d => { saved = structuredClone(inventoryDeviceDraft(d)); }, deleteDraft: async () => { saved = null; },
      receipt: async () => receipt, execute: async (id, command) => {
        calls++; assert.equal(id, "original-private"); assert.deepEqual(command, { action: "settle" });
        receipt = { ok: false, code: "operation_not_applied" }; throw Error("Settlement response lost");
      },
    };
    const c = new InventoryController(ports); await c.open(); await c.settle();
    assert.equal(c.draft!.pending!.operationId, "original-private"); c.dispose();
    const restarted = new InventoryController(ports); await restarted.open(); await restarted.recover();
    assert.equal(calls, 1); assert.equal(restarted.draft!.pending, undefined); assert.equal(restarted.draft!.command.quantity, 25);
  });
  it("preserves complete operational approval, count and revision retry payloads", () => {
    for (const action of ["submit", "verify", "authorize", "count", "revise"] as const) {
      const d = { command: { action: "submit", reason: "Field request" }, pending: {
        operationId: "original-operation", command: { action, expectedVersion: 3, lotVersion: 7, reason: "Operational evidence" },
      } } as unknown as InventoryDraft;
      assert.deepEqual(inventoryDeviceDraft(d), d);
    }
  });
  it("does not send if local persistence fails", async () => {
    let sent = false;
    const c = new InventoryController({
      userId: "u",
      projectId: "p",
      current: () => true,
      uuid: randomUUID,
      online: () => true,
      read: async () => ({ lots: [] }) as unknown as InventorySnapshot,
      readDraft: async () => null,
      readCache: async () => null,
      cache: async () => {},
      saveDraft: async () => {
        throw Error("QuotaExceededError");
      },
      deleteDraft: async () => {},
      execute: async () => {
        sent = true;
        return { ok: true };
      },
      receipt: async () => null,
    });
    await c.open();
    await c.edit({ quantity: 1 });
    await c.act();
    assert.equal(sent, false);
    assert.match(c.message, /QuotaExceeded/);
    assert.equal(c.draft?.command.quantity, 1);
  });
});
