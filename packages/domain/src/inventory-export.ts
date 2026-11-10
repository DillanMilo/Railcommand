import { inventoryUnitLabel } from "./inventory-catalogue";
import {
  COST_BUCKETS,
  materialCostSummary,
  operationalCarrying,
  type InventorySnapshot,
} from "./inventory";
import {
  INVENTORY_COST_LABELS,
  inventoryCostStatus,
  inventoryPerTie,
  inventoryLatestCost,
} from "./inventory-presentation";

export type InventoryCsvReport = {
  projectId: string;
  asOf: string;
  fileName: string;
  mimeType: "text/csv";
  csv: string;
};
export const INVENTORY_CSV_MAX_LENGTH = 2 * 1024 * 1024;
const HEADERS = [
  "Record type",
  "Project ID",
  "As of UTC",
  "Lot ID",
  "Material",
  "Yard",
  "Cost item",
  "Amount",
  "Currency",
  "Status",
  "Source",
  "Opening quantity",
  "On hand",
  "Per stock unit",
  "Received date",
  "Days held",
  "Annual carrying rate",
  "Material code",
  "Stock unit",
];
/** RFC 4180 quoting plus spreadsheet formula protection for every text field.
 * Numeric values stay numeric, including a legitimate negative budget balance.
 */
function cell(value: string | number | null | undefined): string {
  if (value == null || (typeof value === "number" && !Number.isFinite(value)))
    return '""';
  let text = String(value).replace(/\u0000/g, "");
  if (
    typeof value === "string" &&
    (/^[\s\x00-\x1f]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))
  )
    text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
const money = (n: number | null | undefined) =>
  n == null || !Number.isFinite(Number(n))
    ? null
    : Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Pure serializer of a newly authorized finance projection; never persist it in an operational cache. */
export function createInventoryCsvReport(
  s: InventorySnapshot,
): InventoryCsvReport {
  const f = s.finance;
  if (!f) throw new Error("Cost access is required to export this report.");
  if (!Number.isFinite(Date.parse(s.asOf)))
    throw new Error("Report timestamp is unavailable. Refresh and try again.");
  const rows: (string | number | null | undefined)[][] = [HEADERS];
  const budgetRows: [string, number][] = [
    ["Approved project budget", f.budget.adjusted],
    ["Recorded budget spend", f.budget.spent],
    ["Approved new material commitments", f.budget.postedNewExposure],
    [
      "Budget left before pending requests",
      Number(f.budget.adjusted) -
        Number(f.budget.spent) -
        Number(f.budget.postedNewExposure),
    ],
  ];
  for (const [label, amount] of budgetRows)
    rows.push([
      "Project budget",
      s.projectId,
      s.asOf,
      "",
      "",
      "",
      label,
      money(amount),
      "",
      "Budget currency unconfirmed",
      "Existing budget figures; invoice payments are not automatically imported",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  for (const lot of s.lots) {
    const cost = inventoryLatestCost(f, lot.id);
    const currency =
      f.contractSources?.find((x) => x.id === cost?.exposure_id)?.currency ??
      f.annual?.find((a) => a.lotId === lot.id)?.evaluation.currency ??
      f.policy?.currency ??
      "";
    const totals = materialCostSummary(cost);
    const carrying = operationalCarrying(lot, cost, f.policy, s.asOf);
    const add = (
      type: string,
      label: string,
      amount: number | null | undefined,
      status: string,
      source: string,
      perTie = false,
    ) =>
      rows.push([
        type,
        s.projectId,
        s.asOf,
        lot.id,
        lot.material,
        lot.yard,
        label,
        money(amount),
        currency,
        status,
        source,
        lot.opening_quantity,
        lot.balance,
        perTie ? money(inventoryPerTie(amount, lot.opening_quantity)) : null,
        lot.received_at,
        carrying.days,
        carrying.rate,
        lot.material_code ?? "",
        inventoryUnitLabel(lot.unit),
      ]);
    add(
      "Lot summary",
      "Acquisition subtotal - original lot",
      totals.landed,
      totals.landed == null ? "Incomplete" : "Recorded source subtotal",
      cost?.purchase_price
        ? "Delivered invoice / quote; manufacturing inputs are not added again"
        : "Log through rail car; source statuses are itemized below",
      true,
    );
    add(
      "Lot summary",
      "Installed subtotal - original lot (excludes carrying)",
      totals.installedExcludingCarrying,
      totals.installedExcludingCarrying == null
        ? "Incomplete"
        : "Recorded source subtotal",
      "Acquisition + installation + inspection; excludes disposal and carrying",
      true,
    );
    add(
      "Lot summary",
      "Future disposal - original lot",
      totals.disposal,
      totals.disposal == null ? "Incomplete" : "Recorded source input",
      "Separate lifecycle input",
      true,
    );
    if (cost?.purchase_price)
      add(
        "Cost input",
        "Delivered invoice / quote",
        cost.purchase_price.amount,
        inventoryCostStatus(cost.purchase_price.status),
        cost.purchase_price.source,
        true,
      );
    add(
      "Lot summary",
      "Accrued capital carrying - stock on hand",
      carrying.annual,
      carrying.annual == null
        ? "Incomplete"
        : "Calculated annual component only",
      "Remaining acquisition value × annual rate × UTC days held / 365; excludes storage and entered carrying",
    );
    add(
      "Lot summary",
      "Full lifecycle true cost",
      null,
      "Incomplete",
      "Subtotals are not a final lifecycle total",
    );
    for (const bucket of COST_BUCKETS) {
      if (
        lot.category != null &&
        lot.category !== "rail_tie" &&
        COST_BUCKETS.slice(0, 7).includes(bucket as (typeof COST_BUCKETS)[0])
      )
        continue;
      const component = cost?.components[bucket];
      const referenceOnly =
        !!cost?.purchase_price &&
        COST_BUCKETS.slice(0, 7).includes(bucket as (typeof COST_BUCKETS)[0]);
      add(
        referenceOnly ? "Reference only - excluded from totals" : "Cost input",
        bucket === "carrying_cost"
          ? "Entered carrying cost (not added to calculated capital)"
          : INVENTORY_COST_LABELS[bucket],
        component?.amount,
        inventoryCostStatus(component?.status),
        component?.source ?? "",
        true,
      );
    }
  }
  const csv =
    "\uFEFF" +
    rows
      .map((row) =>
        Array.from({ length: HEADERS.length }, (_, i) => row[i])
          .map(cell)
          .join(","),
      )
      .join("\r\n") +
    "\r\n";
  if (csv.length > INVENTORY_CSV_MAX_LENGTH)
    throw new Error(
      "This project exceeds the beta CSV size limit. No partial report was exported.",
    );
  return {
    projectId: s.projectId,
    asOf: s.asOf,
    fileName: `material-costs-${s.projectId}-${s.asOf.slice(0, 10)}.csv`,
    mimeType: "text/csv",
    csv,
  };
}
/** Guard asynchronous client delivery against an account/project switch or invalid response. */
export async function prepareInventoryCsv(
  projectId: string,
  deps: {
    current(): boolean;
    online(): boolean;
    read(): Promise<InventoryCsvReport>;
  },
): Promise<InventoryCsvReport> {
  const check = () => {
    if (!deps.current())
      throw new Error(
        "Export cancelled because the account or project changed.",
      );
    if (!deps.online())
      throw new Error(
        "CSV export requires a connection. Reconnect and try again; saved work is unchanged.",
      );
  };
  check();
  const r = await deps.read();
  check();
  if (
    r.projectId !== projectId ||
    r.mimeType !== "text/csv" ||
    !Number.isFinite(Date.parse(r.asOf)) ||
    typeof r.csv !== "string" ||
    !r.csv.startsWith('\uFEFF"Record type",') ||
    r.csv.length > INVENTORY_CSV_MAX_LENGTH ||
    r.fileName !== `material-costs-${projectId}-${r.asOf.slice(0, 10)}.csv`
  )
    throw new Error("The CSV response was invalid. No file was exported.");
  return r;
}
