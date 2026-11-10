import type { InventorySnapshot } from "./inventory";

export const INVENTORY_UNITS = [
  { value: "each", label: "each" },
  { value: "litre", label: "L" },
  { value: "us_gallon", label: "US gal" },
  { value: "kg", label: "kg" },
  { value: "lb", label: "lb" },
  { value: "metric_tonne", label: "metric tonnes" },
  { value: "short_ton", label: "US short tons" },
  { value: "metre", label: "m" },
  { value: "foot", label: "ft" },
] as const;
export type InventoryUnit = (typeof INVENTORY_UNITS)[number]["value"];
export const INVENTORY_CATEGORIES = [
  { value: "rail_tie", label: "Rail ties" },
  { value: "fuel", label: "Fuel" },
  { value: "aggregate", label: "Aggregate" },
  { value: "hardware", label: "Hardware" },
  { value: "other", label: "Other materials" },
] as const;
export type InventoryMaterial = {
  id: string;
  code: string;
  name: string;
  unit: InventoryUnit;
  category: (typeof INVENTORY_CATEGORIES)[number]["value"];
  catalogueVersion: 1 | 3;
};
export const inventoryUnitLabel = (unit?: string) =>
  INVENTORY_UNITS.find((u) => u.value === (unit ?? "each"))?.label ??
  unit ??
  "each";
export function validInventoryQuantity(
  value: number,
  unit = "each",
  zero = false,
) {
  return (
    Number.isFinite(value) &&
    value >= (zero ? 0 : 0.001) &&
    value <= 2147483647 &&
    Math.abs(value * 1000 - Math.round(value * 1000)) < 0.000001 &&
    (unit !== "each" || Number.isInteger(value))
  );
}

export type InventoryImportRow = Omit<
  InventoryMaterial,
  "id" | "catalogueVersion"
> & {
  quantity?: number;
  yard?: string;
  source?: string;
  receivedAt?: string;
  inspectionAccepted?: boolean;
};
export const INVENTORY_IMPORT_TEMPLATE =
  "code,name,category,unit,quantity,yard,received_date,receipt_reference,inspection_accepted\r\nDIESEL-US,Dyed diesel - US gallons,fuel,us_gallon,250.5,Main yard,2026-11-05,Opening tank reading,true\r\n";
/** Bounded RFC4180 parser. No spreadsheet execution or file-system dependencies. */
export function parseInventoryImport(csv: string): InventoryImportRow[] {
  if (csv.length > 50000)
    throw new Error("Use a CSV smaller than 50 KB (up to 100 materials).");
  const records: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  csv = csv.replace(/^\uFEFF/, "");
  const finish = () => {
    row.push(cell);
    cell = "";
    closed = false;
  };
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += c;
    } else if (c === '"') {
      if (cell || closed) throw new Error("CSV contains an unexpected quote.");
      quoted = true;
    } else if (c === ",") finish();
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && csv[i + 1] === "\n") i++;
      finish();
      if (row.some((x) => x.trim())) records.push(row);
      row = [];
    } else {
      if (closed) throw new Error("CSV contains text after a closing quote.");
      cell += c;
    }
  }
  if (quoted) throw new Error("CSV has an unclosed quoted value.");
  finish();
  if (row.some((x) => x.trim())) records.push(row);
  const header = records.shift()?.map((x) => x.trim().toLowerCase()) ?? [];
  const allowed = [
    "code",
    "name",
    "category",
    "unit",
    "quantity",
    "yard",
    "received_date",
    "receipt_reference",
    "inspection_accepted",
  ];
  if (
    ["code", "name", "category", "unit"].some((x) => !header.includes(x)) ||
    new Set(header).size !== header.length ||
    header.some((x) => !allowed.includes(x))
  )
    throw new Error(
      "Use the template headings: code, name, category, unit, and optional opening-stock columns.",
    );
  if (!records.length || records.length > 100)
    throw new Error("Import 1–100 material rows at a time.");
  const codes = new Set<string>();
  return records.map((cells, i) => {
    const fail = (message: string): never => {
      throw new Error(`Row ${i + 2}: ${message}`);
    };
    if (cells.length !== header.length)
      fail("column count does not match the headings.");
    const values = Object.fromEntries(
      header.map((h, j) => [h, cells[j].trim()]),
    );
    const code = values.code.toUpperCase(),
      name = values.name;
    if (
      !/^[A-Z0-9][A-Z0-9._/-]{0,63}$/.test(code) ||
      name.length < 2 ||
      name.length > 200
    )
      fail("use a valid code and a specific material name.");
    if (codes.has(code)) fail("use one row per material code.");
    codes.add(code);
    if (
      !INVENTORY_UNITS.some((x) => x.value === values.unit) ||
      !INVENTORY_CATEGORIES.some((x) => x.value === values.category)
    )
      fail("use a unit and category from the template instructions.");
    const item: InventoryImportRow = {
      code,
      name,
      unit: values.unit as InventoryUnit,
      category: values.category as InventoryMaterial["category"],
    };
    if (values.quantity) {
      if (
        !/^\d+(\.\d{1,3})?$/.test(values.quantity) ||
        !validInventoryQuantity(Number(values.quantity), item.unit)
      )
        fail(
          "quantity must match the unit; each uses whole numbers, other units allow 3 decimals.",
        );
      if (
        !values.yard ||
        !values.receipt_reference ||
        values.inspection_accepted?.toLowerCase() !== "true"
      )
        fail(
          "opening stock needs a yard, receipt reference and inspection_accepted=true.",
        );
      const date = values.received_date;
      if (
        date &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date)
      )
        fail("use a real received date as YYYY-MM-DD, or leave it blank.");
      Object.assign(item, {
        quantity: Number(values.quantity),
        yard: values.yard,
        source: values.receipt_reference,
        receivedAt: date ?? "",
        inspectionAccepted: true,
      });
    } else if (
      [
        values.yard,
        values.receipt_reference,
        values.received_date,
        values.inspection_accepted,
      ].some(Boolean)
    )
      fail(
        "opening stock information needs a quantity; otherwise leave all stock columns blank.",
      );
    return item;
  });
}

/** Unversioned installed clients assume ties/whole quantities. Preserve their original slice. */
export function inventoryForVersion(
  s: InventorySnapshot,
  version: string | null,
): InventorySnapshot {
  if (version === "3") return s;
  const lots = s.lots.filter(
    (l) => (l.catalogueVersion ?? 1) === 1 && (l.unit ?? "each") === "each",
  );
  const lotIds = new Set(lots.map((l) => l.id)),
    requests = (s.requests ?? []).filter((r) => lotIds.has(r.lot_id));
  const requestIds = new Set(requests.map((r) => r.id));
  return {
    ...s,
    catalogue: undefined,
    canReceive: undefined,
    lots,
    requests,
    revisions: s.revisions?.filter((r) => requestIds.has(r.request_id)),
    events: (s.events ?? []).filter(
      (e) =>
        !e.action.startsWith("catalogue_") &&
        (!e.request_id || requestIds.has(e.request_id)),
    ),
    denials: (s.denials ?? []).filter(
      (e) => !e.request_id || requestIds.has(e.request_id),
    ),
    ...(s.finance && {
      finance: {
        ...s.finance,
        costs: s.finance.costs.filter((c) => lotIds.has(c.lot_id)),
        annual: s.finance.annual?.filter((a) => lotIds.has(a.lotId)),
        approvalEvidence: s.finance.approvalEvidence?.filter((a) =>
          requestIds.has(a.request_id),
        ),
      },
    }),
  };
}
