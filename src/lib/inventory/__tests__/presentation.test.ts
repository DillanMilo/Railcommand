import assert from "node:assert/strict";
import {
  COST_BUCKETS,
  inventoryMatchesSearch,
  inventoryMoney,
  inventoryPerTie,
  inventoryCostFormValues,
  type InventoryCost,
  type InventoryFinance,
} from "@railcommand/domain";
describe("Inventory financial presentation safety", () => {
  it("distinguishes unknown amounts from actual zero and formats source currency", () => {
    assert.equal(inventoryMoney(null, "USD"), "Not recorded");
    assert.equal(inventoryMoney(NaN, "USD"), "Not recorded");
    assert.equal(inventoryMoney(0, "USD"), "$0.00");
    assert.equal(inventoryMoney(12500.5, "USD"), "$12,500.50");
    assert.equal(inventoryMoney(12500.5), "12,500.50");
  });
  it("uses the opening lot quantity for unit prices and keeps unknown quantity incomplete", () => {
    assert.equal(inventoryPerTie(10000, 100), 100);
    assert.equal(inventoryPerTie(10000, undefined), null);
    assert.equal(inventoryPerTie(10000, 0), null);
    assert.equal(inventoryPerTie(null, 100), null);
  });
  it("opens an existing price revision without blanking other costs or creating another source", () => {
    const cost = {
      version: 7,
      exposure_id: "purchase",
      creosote_oil_reference: "quote 3",
      annual_rate_override: null,
      components: Object.fromEntries(
        COST_BUCKETS.map((k) => [
          k,
          {
            amount: k === "carrying_cost" ? null : 123.45,
            status: "actual",
            source: `invoice ${k}`,
          },
        ]),
      ),
    } as InventoryCost;
    const finance = {
      sources: [
        {
          id: "purchase",
          source_key: "PO-21",
          source: "invoice evidence",
          funding: "new",
          amount: 12345,
          milestone_id: "milestone",
          change_order_id: "co",
        },
      ],
      contractSources: [
        {
          id: "purchase",
          contract_id: "contract",
          period_year: 2026,
          currency: "USD",
        },
      ],
    } as InventoryFinance;
    const fields = inventoryCostFormValues(cost, finance);
    assert.equal(fields.exposureId, "purchase");
    assert.equal(fields.costVersion, "7");
    assert.equal(fields.contractId, "contract");
    assert.equal(fields.periodYear, "2026");
    assert.equal(fields.currency, "USD");
    assert.equal(fields.milestoneId, "milestone");
    assert.equal(fields.changeOrderId, "co");
    for (const k of COST_BUCKETS) {
      assert.equal(fields[k], k === "carrying_cost" ? "" : "123.45");
      assert.equal(fields[`${k}:source`], `invoice ${k}`);
      assert.equal(fields[`${k}:status`], "actual");
    }
    const edited: Record<string, string> = { ...fields, log: "200" };
    assert.equal(edited.mill, "123.45");
    assert.equal(edited.exposureId, "purchase");
    assert.equal(cost.components.log.amount, 123.45);
  });
  it("keeps an older purchase currency when organization defaults change", () => {
    const cost = {
      lot_id: "lot",
      version: 1,
      exposure_id: "source",
      components: Object.fromEntries(
        COST_BUCKETS.map((k) => [
          k,
          { amount: null, status: "awaiting_wendy", source: "" },
        ]),
      ),
    } as InventoryCost;
    const finance = {
      sources: [],
      policy: { currency: "EUR" },
      annual: [
        {
          lotId: "lot",
          evaluation: {
            sourceId: "source",
            currency: "USD",
            contractId: "original-contract",
            periodYear: 2026,
          },
        },
      ],
    } as unknown as InventoryFinance;
    const fields = inventoryCostFormValues(cost, finance);
    assert.equal(fields.currency, "USD");
    assert.equal(fields.contractId, "original-contract");
    assert.equal(fields.periodYear, "2026");
  });
});

describe("Inventory snapshot search", () => {
  it("matches multiple words across material and yard, regardless of case or spacing", () => {
    assert.equal(
      inventoryMatchesSearch("  SALT   tie ", "Treated ties", "Salt Lake"),
      true,
    );
    assert.equal(
      inventoryMatchesSearch("missing tie", "Treated ties", "Salt Lake"),
      false,
    );
  });
  it("handles request numbers, missing fields and literal punctuation", () => {
    assert.equal(
      inventoryMatchesSearch("#12 east", "#12", undefined, "East yard"),
      true,
    );
    assert.equal(inventoryMatchesSearch(".*", "Ties", null), false);
    assert.equal(inventoryMatchesSearch("", undefined), true);
  });
});
