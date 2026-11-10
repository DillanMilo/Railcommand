import assert from "node:assert/strict";
import { inventoryHttp } from "../http";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  COST_BUCKETS,
  InventoryController,
  type InventoryDraft,
  type InventoryPorts,
  inventoryForCostEntry,
  materialCostSummary,
  operationalCarrying,
  inventoryCostFormValues,
  inventoryLatestCost,
  inventoryMemberOptions,
  inventoryNextApproval,
  inventoryRequestStatus,
  createInventoryCsvReport,
  operationalInventory,
  type InventoryCost,
  type InventoryFinance,
  type InventoryLot,
  type InventorySnapshot,
  type InventoryRequest,
} from "@railcommand/domain";
const components = () =>
  Object.fromEntries(
    COST_BUCKETS.map((k) => [
      k,
      { amount: 100, status: "actual", source: `Invoice ${k}` },
    ]),
  ) as InventoryCost["components"];
const cost = (): InventoryCost => ({
  id: "price",
  lot_id: "lot",
  version: 2,
  created_at: "2026-01-01",
  exposure_id: null,
  creosote_oil_reference: null,
  components: components(),
  purchase_price: {
    amount: 12000,
    status: "actual",
    source: "Delivered invoice",
  },
});
const lot = {
  id: "lot",
  material: "Ties",
  yard: "Salt Lake",
  balance: 50,
  opening_quantity: 100,
  received_at: "2025-11-05",
} as InventoryLot;
const finance = (c = cost()) =>
  ({
    costEntryVersion: 2,
    sources: [],
    costs: [c],
    policy: { annual_rate: 0.05, currency: "USD" },
    budget: {
      adjusted: 20000,
      base: 20000,
      spent: 0,
      postedNewExposure: 0,
      changeOrders: [],
    },
  }) as unknown as InventoryFinance;
describe("First-use pricing and approvals", () => {
  it("uses delivered price once and separates installation, future disposal and 5% remaining-stock carrying", () => {
    const c = cost();
    c.components.install_labour.amount = 2000;
    c.components.inspection.amount = 300;
    c.components.disposal.amount = 500;
    const t = materialCostSummary(c);
    assert.equal(t.landed, 12000);
    assert.equal(t.installedExcludingCarrying, 14300);
    assert.equal(t.disposal, 500);
    assert.equal(t.lifecycleExcludingCarrying, 14800);
    assert.equal(t.total, null);
    assert.equal(
      operationalCarrying(lot, c, finance().policy, "2026-11-05T00:00:00Z")
        .annual,
      300,
    );
  });
  it("retains manufacturing pricing and distinguishes an actual zero invoice from missing acquisition", () => {
    const c = cost();
    delete c.purchase_price;
    assert.equal(materialCostSummary(c).landed, 700);
    c.components.mill.amount = null;
    assert.equal(materialCostSummary(c).landed, null);
    c.purchase_price = {
      amount: 0,
      status: "actual",
      source: "No-charge delivered stock",
    };
    assert.equal(materialCostSummary(c).landed, 0);
    c.purchase_price.source = "";
    assert.equal(materialCostSummary(c).landed, null);
  });
  it("opens existing evidence and source identities, defaulting only untouched supported lots to delivered entry", () => {
    const c = cost(),
      f = finance(c),
      input = inventoryCostFormValues(c, f);
    assert.equal(input.pricingMode, "delivered");
    assert.equal(input.purchaseAmount, "12000");
    assert.equal(input.log, "100");
    assert.equal(input["log:source"], "Invoice log");
    delete c.purchase_price;
    c.version = 1;
    for (const k of COST_BUCKETS)
      c.components[k] = { amount: null, status: "awaiting_wendy", source: "" };
    assert.equal(inventoryCostFormValues(c, f).pricingMode, "delivered");
    delete f.costEntryVersion;
    assert.equal(inventoryCostFormValues(c, f).pricingMode, "breakdown");
  });
  it("selects the newest revision even when creation timestamps tie and preserves source inputs in CSV", () => {
    const c = cost(),
      f = finance(c);
    f.costs = [{ ...c, version: 1, purchase_price: null }, c];
    assert.equal(inventoryLatestCost(f, "lot")?.version, 2);
    const s = {
      projectId: "project",
      asOf: "2026-11-05T00:00:00Z",
      finance: f,
      lots: [lot],
    } as InventorySnapshot;
    const csv = createInventoryCsvReport(s).csv;
    assert.ok(
      csv.includes(
        '"Delivered invoice / quote","12000","USD","Actual","Delivered invoice"',
      ),
    );
    assert.ok(csv.includes('"Reference only - excluded from totals"'));
    assert.ok(csv.includes('"Future disposal - original lot"'));
    assert.equal(operationalInventory(s).finance, undefined);
  });
  it("gives older clients an incomplete acquisition instead of a competing manufacturing subtotal", () => {
    const c = cost(),
      s = { finance: finance(c) } as InventorySnapshot;
    const legacy = inventoryForCostEntry(s, null);
    assert.equal(
      materialCostSummary({
        ...legacy.finance!.costs[0],
        purchase_price: undefined,
      }).landed,
      null,
    );
    assert.ok(
      legacy.finance!.costs[0].components.log.source.includes("update"),
    );
    assert.equal(s.finance!.costs[0].components.log.amount, 100);
    assert.equal(inventoryForCostEntry(s, "2"), s);
  });
  it("offers current eligible invited members by name without assigning read-only PMs or duplicate approvers", () => {
    const actors = [
      { id: "lead", name: "Wendy", role: "foreman", can_edit: true },
      { id: "pm", name: "Mark", role: "manager", can_edit: true },
      { id: "read", name: "Read only", role: "manager", can_edit: false },
      { id: "eng", name: "Engineer", role: "engineer", can_edit: true },
    ];
    assert.deepEqual(
      inventoryMemberOptions(actors, "pm").map((a) => a.value),
      ["pm"],
    );
    assert.deepEqual(
      inventoryMemberOptions(actors, "supplyChain", ["pm", "lead"]).map(
        (a) => a.value,
      ),
      ["eng"],
    );
    assert.equal(
      inventoryMemberOptions(actors, "lead")[0].label,
      "Wendy · foreman",
    );
  });
  it("gives an actionable next step without financial amounts, including handover after authorization", () => {
    const s = {
      actors: [{ id: "lead", name: "Wendy", role: "foreman" }],
      assignments: { lead_id: "lead", pm_id: "pm", version: 1 },
    } as InventorySnapshot;
    const r = { state: "submitted" } as InventoryRequest;
    assert.equal(inventoryRequestStatus(r), "Awaiting stock verification");
    assert.equal(inventoryNextApproval(s, r), "Next: Wendy verifies stock.");
    r.state = "awaiting_supply_chain";
    assert.ok(inventoryNextApproval(s, r).includes("before release"));
    r.state = "posted";
    assert.ok(inventoryNextApproval(s, r).includes("physical handover"));
  });
  it("negotiates invoice reads through the shared web/native HTTP handler while keeping current CSV", async () => {
    const projectId = randomUUID(),
      s = {
        projectId,
        asOf: "2026-11-05T00:00:00Z",
        finance: finance(),
        lots: [lot],
      } as InventorySnapshot;
    const db = {
      rpc: async (name: string) => {
        assert.equal(name, "inventory_read");
        return { data: s, error: null };
      },
    } as unknown as SupabaseClient;
    const legacy = await (
      await inventoryHttp(
        new Request(`http://local/api/inventory?projectId=${projectId}`),
        db,
      )
    ).json();
    assert.equal(legacy.finance.costs[0].components.log.amount, null);
    const updated = await (
      await inventoryHttp(
        new Request(
          `http://local/api/mobile/v1/inventory?projectId=${projectId}&costEntryVersion=2`,
        ),
        db,
      )
    ).json();
    assert.equal(updated.finance.costs[0].components.log.amount, 100);
    assert.equal(updated.finance.costs[0].purchase_price.amount, 12000);
    const csv = await (
      await inventoryHttp(
        new Request(
          `http://local/api/inventory?projectId=${projectId}&format=csv`,
        ),
        db,
      )
    ).json();
    assert.ok(csv.csv.includes('"Delivered invoice / quote","12000"'));
  });
  it("recovers a lost opening receipt once without clearing an unrelated field request", async () => {
    let saved: InventoryDraft | null = null,
      sent = 0;
    const snapshot = {
      projectId: "p",
      asOf: "2026-11-05",
      canManage: true,
      assignments: null,
      lots: [],
      requests: [],
      events: [],
      denials: [],
    } as InventorySnapshot;
    const ports: InventoryPorts = {
      userId: "u",
      projectId: "p",
      current: () => true,
      online: () => true,
      uuid: randomUUID,
      read: async () => snapshot,
      readCache: async () => null,
      cache: async () => {},
      readDraft: async () => saved,
      saveDraft: async (d) => {
        saved = structuredClone(d);
      },
      deleteDraft: async () => {
        saved = null;
      },
      execute: async () => {
        sent++;
        throw Error("Response dropped after acceptance");
      },
      receipt: async () => ({ ok: true, lotId: "accepted-opening" }),
    };
    const first = new InventoryController(ports);
    await first.open();
    await first.edit({
      lotId: "field-lot",
      quantity: 25,
      reason: "Unfinished field request",
    });
    await first.act({ action: "opening", quantity: 100 });
    assert.equal(first.lastConfirmed, null);
    const identity = first.draft!.pending!.operationId;
    first.dispose();
    const reopened = new InventoryController(ports);
    await reopened.open();
    assert.equal(reopened.draft!.pending!.operationId, identity);
    await reopened.recover();
    assert.equal(sent, 1);
    assert.equal(reopened.lastConfirmed?.action, "opening");
    assert.equal(reopened.lastConfirmed?.result.lotId, "accepted-opening");
    assert.equal(reopened.draft?.command.reason, "Unfinished field request");
    assert.equal(reopened.draft?.pending, undefined);
  });
});
