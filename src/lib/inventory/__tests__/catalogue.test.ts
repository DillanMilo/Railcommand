import assert from "node:assert/strict";
import {
  parseInventoryImport,
  INVENTORY_IMPORT_TEMPLATE,
  validInventoryQuantity,
  inventoryForVersion,
  operationalInventory,
  inventoryDeviceDraft,
  type InventorySnapshot,
} from "@railcommand/domain";
describe("Approved catalogue and fixed stock units", () => {
  it("previews Excel CSV with a BOM, escaped commas/quotes and measured quantities", () => {
    const rows = parseInventoryImport(
      `\uFEFFcode,name,category,unit,quantity,yard,received_date,receipt_reference,inspection_accepted\r\nDIESEL,"Diesel, ""dyed""",fuel,us_gallon,250.125,Main yard,2026-11-05,Invoice-1,true\r\n`,
    );
    assert.equal(rows[0].name, 'Diesel, "dyed"');
    assert.equal(rows[0].quantity, 250.125);
    assert.equal(parseInventoryImport(INVENTORY_IMPORT_TEMPLATE).length, 1);
  });
  it("rejects ambiguous units, overprecision, duplicate codes, missing acceptance and invalid dates", () => {
    for (const [from, to] of [
      ["us_gallon", "gallon"],
      ["250.5", "1.0001"],
      ["true", "false"],
      ["2026-11-05", "2026-02-30"],
    ])
      assert.throws(() =>
        parseInventoryImport(INVENTORY_IMPORT_TEMPLATE.replace(from, to)),
      );
    const line = INVENTORY_IMPORT_TEMPLATE.split("\r\n")[1];
    assert.throws(() => parseInventoryImport(INVENTORY_IMPORT_TEMPLATE + line));
    assert.throws(() =>
      parseInventoryImport('code,name,category,unit\nA,"Unclosed,other,each'),
    );
  });
  it("permits a catalogue-only import and precise quantities without automatic conversions", () => {
    assert.deepEqual(
      parseInventoryImport(
        "code,name,category,unit\nbolt-1,Track bolt 1 inch,hardware,each",
      ),
      [
        {
          code: "BOLT-1",
          name: "Track bolt 1 inch",
          category: "hardware",
          unit: "each",
        },
      ],
    );
    assert.equal(validInventoryQuantity(1.5, "each"), false);
    assert.equal(validInventoryQuantity(0.001, "litre"), true);
    assert.equal(validInventoryQuantity(1.0001, "litre"), false);
    assert.equal(validInventoryQuantity(0, "litre", true), true);
  });
  it("protects installed tie-only clients and preserves operational offline metadata", () => {
    const s = {
      projectId: "p",
      canManage: true,
      canReceive: true,
      asOf: "2026-11-05",
      catalogue: [],
      lots: [
        { id: "old", unit: "each", catalogueVersion: 1 },
        { id: "fuel", unit: "litre", catalogueVersion: 3 },
      ],
      requests: [
        { id: "r1", lot_id: "old" },
        { id: "r2", lot_id: "fuel" },
      ],
      events: [
        { action: "catalogue_import" },
        { action: "submit", request_id: "r2" },
      ],
      denials: [],
      revisions: [{ request_id: "r2" }],
    } as unknown as InventorySnapshot;
    assert.deepEqual(
      inventoryForVersion(s, null).lots.map((l) => l.id),
      ["old"],
    );
    assert.equal(inventoryForVersion(s, null).requests.length, 1);
    assert.equal(inventoryForVersion(s, null).events.length, 0);
    assert.equal(inventoryForVersion(s, "3"), s);
    assert.equal(operationalInventory(s).lots[1].unit, "litre");
  });
  it("retains receipt identity rather than persisting import/receiving payloads", () => {
    for (const action of [
      "catalogue_import",
      "catalogue_add",
      "opening",
    ] as const) {
      const d = inventoryDeviceDraft({
        userId: "u",
        projectId: "p",
        operationId: "op",
        phase: "editing",
        command: {
          action,
          rows: [{ name: "private file contents" }],
          source: "receipt",
        },
      } as never);
      assert.equal(d.command.receiptOnly, true);
      assert.equal(d.command.rows, undefined);
      assert.equal(d.pending?.operationId, "op");
    }
  });
});
