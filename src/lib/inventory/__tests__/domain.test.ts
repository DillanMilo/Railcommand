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
