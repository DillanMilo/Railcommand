import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  COST_BUCKETS,
  createInventoryCsvReport,
  prepareInventoryCsv,
  type InventorySnapshot,
  type InventoryCost,
} from "@railcommand/domain";
import { inventoryHttp } from "../http";
const projectId = "c1311731-86fb-41a9-8542-ff6e4fd10288";
function fixture(): InventorySnapshot {
  return {
    projectId,
    asOf: "2026-11-04T12:00:00.000Z",
    canManage: true,
    assignments: null,
    requests: [],
    events: [],
    denials: [],
    lots: [
      {
        id: "lot",
        project_id: projectId,
        material: 'Ties, "oak"\nÉlite',
        yard: '=HYPERLINK("bad")',
        balance: 100,
        opening_quantity: 100,
        version: 1,
        readiness: "ready",
        inspection_accepted: true,
        received_at: "2025-11-04",
        age_source: "receipt",
        drying_started_at: null,
        drying_completed_at: null,
        drying_min_months: 4,
        drying_max_months: 10,
        condition: "aged",
        latestCount: null,
      },
    ],
    finance: {
      budget: {
        base: 100,
        adjusted: 100,
        spent: 150,
        postedNewExposure: 0,
        changeOrders: [],
      },
      sources: [],
      milestones: [],
      configuration: null,
      evaluation: "incomplete_awaiting_wendy",
      policy: {
        organization_id: "org",
        version: 1,
        annual_rate: 0.05,
        threshold_amount: 50000,
        currency: "EUR",
        period_convention: "contract_year",
        spend_basis: "approved_commitments_plus_proposed",
        source: "Wendy",
        created_by: null,
        created_at: "2026-01-01",
      },
      contractSources: [
        {
          id: "purchase",
          contract_id: "contract",
          period_year: 2026,
          currency: "USD",
          source_key: "PO",
          amount: 10000,
          evidence: "invoice",
        },
      ],
      costs: [
        {
          id: "cost",
          lot_id: "lot",
          version: 1,
          created_at: "2026-01-01",
          exposure_id: "purchase",
          creosote_oil_reference: null,
          components: Object.fromEntries(
            COST_BUCKETS.map((k) => [
              k,
              {
                amount: k === "log" ? 10000 : k === "carrying_cost" ? 99 : 0,
                status: "actual",
                source: "receipt",
              },
            ]),
          ) as InventoryCost["components"],
        },
      ],
    },
  } as InventorySnapshot;
}
// Independent CSV reader for verifying escaped cells and rectangular output.
function parse(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 1; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && c === ",") {
      row.push(field);
      field = "";
    } else if (!quoted && c === "\r" && csv[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else field += c;
  }
  assert.equal(quoted, false);
  return rows;
}
describe("Phase 1 cost CSV export", () => {
  it("exports Excel-compatible rectangular UTF-8 CSV with sources, source currency and safe text", () => {
    const s = fixture(),
      before = JSON.stringify(s),
      r = createInventoryCsvReport(s),
      rows = parse(r.csv);
    assert.ok(r.csv.startsWith("\uFEFF"));
    assert.ok(rows.every((row) => row.length === 19));
    const log = rows.find((row) => row[6] === "Log / raw tie")!;
    assert.equal(log[4], 'Ties, "oak"\nÉlite');
    assert.equal(log[5], '\'=HYPERLINK("bad")');
    assert.equal(log[7], "10000");
    assert.equal(log[8], "USD");
    assert.equal(log[13], "100");
    assert.equal(log[10], "receipt");
    const capital = rows.find(
      (row) => row[6] === "Accrued capital carrying - stock on hand",
    )!;
    assert.equal(capital[7], "500");
    assert.equal(capital[15], "365");
    assert.equal(capital[16], "0.05");
    assert.equal(
      rows.find(
        (row) =>
          row[6] === "Entered carrying cost (not added to calculated capital)",
      )![7],
      "99",
    );
    assert.equal(
      rows.find((row) => row[6] === "Budget left before pending requests")![7],
      "-50",
    );
    assert.ok(
      rows
        .filter((row) => row[0] === "Project budget")
        .every(
          (row) => row[8] === "" && row[9] === "Budget currency unconfirmed",
        ),
    );
    assert.equal(JSON.stringify(s), before);
  });
  it("keeps missing prices blank and actual zero numeric; does not invent a full TCO", () => {
    const s = fixture();
    s.finance!.costs[0].components.log.amount = null;
    const rows = parse(createInventoryCsvReport(s).csv);
    assert.equal(rows.find((r) => r[6] === "Log / raw tie")![7], "");
    assert.equal(rows.find((r) => r[6] === "Milling")![7], "0");
    assert.equal(
      rows.find((r) => r[6] === "Acquisition subtotal - original lot")![7],
      "",
    );
    assert.equal(
      rows.find((r) => r[6] === "Full lifecycle true cost")![9],
      "Incomplete",
    );
  });
  it("neutralizes formula prefixes, whitespace and embedded quotes in every text field", () => {
    for (const malicious of [
      "=1+1",
      " +SUM(A1)",
      "-2+3",
      "@SUM(A1)",
      "\t=1",
      "\r=1",
      "\n=1",
    ]) {
      const s = fixture();
      s.finance!.costs[0].components.log.source = malicious;
      assert.equal(
        parse(createInventoryCsvReport(s).csv).find(
          (r) => r[6] === "Log / raw tie",
        )![10],
        "'" + malicious,
      );
    }
  });
  it("rechecks the finance projection for each direct GET; denies revoked/field access without writing", async () => {
    const s = fixture();
    const calls: string[] = [];
    const db = {
      rpc: async (name: string) => {
        calls.push(name);
        if (name === "inventory_beta_access") return { data: true, error: null };
        return { data: s, error: null };
      },
    } as unknown as SupabaseClient;
    const get = () =>
      inventoryHttp(
        new Request(
          `http://localhost/api/inventory?projectId=${projectId}&format=csv`,
        ),
        db,
      );
    const allowed = await get();
    assert.equal(allowed.status, 200);
    assert.match(allowed.headers.get("cache-control")!, /no-store/);
    assert.match((await allowed.json()).csv, /Capital|capital/);
    delete s.finance;
    const denied = await get();
    assert.equal(denied.status, 403);
    assert.ok(!(await denied.text()).includes("10000"));
    assert.deepEqual(calls, ["inventory_beta_access", "inventory_read", "inventory_beta_access", "inventory_read"]);
    assert.throws(() => createInventoryCsvReport(s), /Cost access/);
    const old = await inventoryHttp(
      new Request(`http://localhost/api/inventory?projectId=${projectId}`),
      db,
    );
    assert.equal(old.status, 200);
    assert.deepEqual(await old.json(), s);
  });
  it("preserves receipt routing and rejects a receipt/export combination before reading", async () => {
    const calls: string[] = [];
    const db = {
      rpc: async (name: string) => {
        calls.push(name);
        if (name === "inventory_beta_access") return { data: true, error: null };
        return { data: null, error: null };
      },
    } as unknown as SupabaseClient;
    const operationId = "8e0a18ce-5483-486c-a8e2-769b9f33b075";
    const old = await inventoryHttp(
      new Request(
        `http://localhost/api/inventory?projectId=${projectId}&operationId=${operationId}`,
      ),
      db,
    );
    assert.deepEqual(await old.json(), { receipt: null });
    assert.deepEqual(calls, ["inventory_beta_access", "inventory_receipt"]);
    const combined = await inventoryHttp(
      new Request(
        `http://localhost/api/inventory?projectId=${projectId}&operationId=${operationId}&format=csv`,
      ),
      db,
    );
    assert.equal(combined.status, 400);
    assert.deepEqual(calls, ["inventory_beta_access", "inventory_receipt", "inventory_beta_access"]);
  });
  it("cancels before fetching offline and after a project/account switch or connection loss", async () => {
    let online = false,
      current = true,
      reads = 0;
    const deps = {
      online: () => online,
      current: () => current,
      read: async () => {
        reads++;
        current = false;
        return createInventoryCsvReport(fixture());
      },
    };
    await assert.rejects(
      prepareInventoryCsv(projectId, deps),
      /requires a connection/,
    );
    assert.equal(reads, 0);
    online = true;
    await assert.rejects(
      prepareInventoryCsv(projectId, deps),
      /account or project changed/,
    );
    assert.equal(reads, 1);
    current = true;
    deps.read = async () => {
      online = false;
      return createInventoryCsvReport(fixture());
    };
    await assert.rejects(
      prepareInventoryCsv(projectId, deps),
      /requires a connection/,
    );
  });
});
