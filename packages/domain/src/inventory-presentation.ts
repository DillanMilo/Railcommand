import {
  COST_BUCKETS,
  type CostBucket,
  type InventoryCost,
  type InventoryFinance,
  type InventorySnapshot,
  type InventoryRequest,
} from "./inventory";

export const INVENTORY_COST_LABELS: Record<CostBucket, string> = {
  log: "Log / raw tie",
  mill: "Milling",
  trucking: "Trucking",
  treating: "Treating",
  drying: "Drying",
  creosote: "Creosote",
  rail_car: "Rail car",
  install_labour: "Installation labour",
  inspection: "Inspection",
  carrying_cost: "Capital carrying",
  disposal: "Disposal",
};
export function inventoryMoney(
  value: number | null | undefined,
  currency?: string,
) {
  if (value === null || value === undefined || !Number.isFinite(Number(value)))
    return "Not recorded";
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };
  if (currency && /^[A-Z]{3}$/.test(currency)) {
    options.style = "currency";
    options.currency = currency;
  }
  return new Intl.NumberFormat("en-US", options).format(Number(value));
}
export function inventoryDate(value: string | undefined | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date not recorded";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(value.length === 10
      ? { timeZone: "UTC" }
      : { hour: "numeric", minute: "2-digit" }),
  }).format(new Date(value));
}
export function inventoryActor(
  snapshot: InventorySnapshot,
  id: string | null | undefined,
) {
  return (
    snapshot.actors?.find((a) => a.id === id)?.name ??
    (id ? "Recorded member" : "Not yet assigned")
  );
}
export function inventoryRequestName(
  snapshot: InventorySnapshot,
  id: string | null | undefined,
) {
  if (!id) return "Project setup";
  const request = snapshot.requests.find((r) => r.id === id);
  return request ? `Request #${request.number}` : "Earlier request";
}
export function inventoryEventName(action: string) {
  return (
    (
      {
        submit: "Request submitted",
        verify: "Stock verified",
        authorize: "PM authorized",
        supply_chain: "Supply Chain authorized",
        reject: "Request rejected",
        cancel: "Request cancelled",
        revise: "Request revised",
        cost: "Material costs updated",
        catalogue_add: "Material approved",
        catalogue_import: "Catalogue / opening stock imported",
        opening: "Opening stock accepted",
        count: "Stock count recorded",
        assign: "Approvers assigned",
        policy: "Organization rules updated",
        baseline: "Opening commitments verified",
        contract: "Contract registered",
        supply_chain_assign: "Supply Chain approver assigned",
        cost_access: "Cost access updated",
        configuration: "Configuration proposal recorded",
      } as Record<string, string>
    )[action] ?? action.replaceAll("_", " ")
  );
}
export function inventoryCostStatus(status: string | undefined) {
  return (
    (
      {
        actual: "Actual",
        estimate: "Estimate",
        commitment: "Committed",
        awaiting_wendy: "Needs confirmation",
      } as Record<string, string>
    )[status ?? ""] ?? "Not recorded"
  );
}
/** Per tie uses the original lot quantity, never the declining on-hand balance. */
export function inventoryPerTie(
  amount: number | null | undefined,
  openingQuantity: number | undefined,
) {
  return amount != null &&
    Number.isFinite(Number(amount)) &&
    openingQuantity &&
    openingQuantity > 0
    ? Number(amount) / openingQuantity
    : null;
}
/** Preserve all existing price/source values when opening a financial editor. Memory only. */
export function inventoryCostFormValues(
  cost: InventoryCost,
  finance: InventoryFinance,
): Record<string, string> {
  const source = finance.sources.find((s) => s.id === cost.exposure_id);
  const contractSource = finance.contractSources?.find(
    (s) => s.id === cost.exposure_id,
  );
  const annual = finance.annual?.find(
    (a) =>
      a.lotId === cost.lot_id && a.evaluation.sourceId === cost.exposure_id,
  )?.evaluation;
  const fields: Record<string, string> = {
    pricingMode:
      cost.purchase_price ||
      (finance.costEntryVersion === 2 &&
        cost.version === 1 &&
        !cost.exposure_id &&
        COST_BUCKETS.slice(0, 7).every(
          (k) => cost.components[k].amount === null,
        ))
        ? "delivered"
        : "breakdown",
    purchaseAmount:
      cost.purchase_price?.amount == null
        ? ""
        : String(cost.purchase_price.amount),
    purchaseSource: cost.purchase_price?.source ?? "",
    purchaseStatus: cost.purchase_price?.status ?? "estimate",
    costVersion: String(cost.version),
    oil: cost.creosote_oil_reference ?? "",
    exposureId: cost.exposure_id ?? "",
    sourceKey: source?.source_key ?? "",
    source: source?.source ?? "",
    funding: source?.funding ?? "unknown",
    incrementalAmount: source?.amount == null ? "" : String(source.amount),
    milestoneId: source?.milestone_id ?? "",
    changeOrderId: source?.change_order_id ?? "",
    contractId: contractSource?.contract_id ?? annual?.contractId ?? "",
    periodYear: contractSource
      ? String(contractSource.period_year)
      : annual?.periodYear == null
        ? ""
        : String(annual.periodYear),
    currency:
      contractSource?.currency ??
      annual?.currency ??
      finance.policy?.currency ??
      "",
    annualRateOverride:
      cost.annual_rate_override == null
        ? ""
        : String(cost.annual_rate_override),
  };
  for (const key of COST_BUCKETS) {
    fields[key] =
      cost.components[key].amount == null
        ? ""
        : String(cost.components[key].amount);
    fields[`${key}:source`] = cost.components[key].source;
    fields[`${key}:status`] = cost.components[key].status;
  }
  return fields;
}

/** Choose by revision, not created_at order (two revisions may share a transaction timestamp). */
export function inventoryLatestCost(finance: InventoryFinance, lotId: string) {
  return finance.costs
    .filter((c) => c.lot_id === lotId)
    .reduce<InventoryCost | undefined>(
      (latest, c) => (!latest || c.version > latest.version ? c : latest),
      undefined,
    );
}
export function inventoryMemberOptions(
  actors: InventorySnapshot["actors"],
  kind: "lead" | "pm" | "supplyChain" | "costViewer",
  exclude: (string | undefined)[] = [],
) {
  return (actors ?? [])
    .filter(
      (a) =>
        !exclude.includes(a.id) &&
        (kind === "costViewer" || a.can_edit !== false) &&
        (kind === "pm"
          ? a.role === "manager"
          : kind === "supplyChain"
            ? ["manager", "superintendent", "engineer"].includes(a.role)
            : kind === "costViewer"
              ? ["engineer", "superintendent"].includes(a.role)
              : true),
    )
    .map((a) => ({ value: a.id, label: `${a.name} · ${a.role}` }));
}
export function inventoryRequestStatus(r: InventoryRequest) {
  return {
    submitted: "Awaiting stock verification",
    verified: "Awaiting PM approval",
    awaiting_supply_chain: "Awaiting Supply Chain approval",
    posted: "Approved for release",
    rejected: "Rejected",
    cancelled: "Cancelled",
  }[r.state];
}
export function inventoryNextApproval(
  s: InventorySnapshot,
  r: InventoryRequest,
) {
  const name = (id: string | undefined, fallback: string) =>
    s.actors?.find((a) => a.id === id)?.name ?? fallback;
  if (r.state === "submitted")
    return `Next: ${name(s.assignments?.lead_id, "Inventory lead")} verifies stock.`;
  if (r.state === "verified")
    return `Next: ${name(s.assignments?.pm_id, "Project manager")} authorizes.`;
  if (r.state === "awaiting_supply_chain")
    return "Next: distinct Supply Chain approval before release.";
  if (r.state === "posted")
    return "Approved issue deducted from available stock. Confirm physical handover with the inventory lead.";
  return "No stock released by this request.";
}

/** Older inventory clients sum manufacturing buckets. Give them unknown acquisition
 * rather than a stale competing subtotal on invoice-priced lots. The immutable
 * evidence stays intact; updated clients receive it unchanged. */
export function inventoryForCostEntry(
  s: InventorySnapshot,
  version: string | null,
): InventorySnapshot {
  if (
    version === "2" ||
    !s.finance ||
    !s.finance.costs.some((c) => c.purchase_price)
  )
    return s;
  return {
    ...s,
    finance: {
      ...s.finance,
      costs: s.finance.costs.map((c) =>
        c.purchase_price
          ? {
              ...c,
              components: {
                ...c.components,
                ...Object.fromEntries(
                  COST_BUCKETS.slice(0, 7).map((k) => [
                    k,
                    {
                      amount: null,
                      status: "awaiting_wendy",
                      source:
                        "Delivered invoice pricing: update RailCommand Phase1 to view or edit this price.",
                    },
                  ]),
                ),
              },
            }
          : c,
      ),
    },
  };
}

/** Token search of fields already present in the authorized snapshot. */
export function inventoryMatchesSearch(
  query: string,
  ...fields: (string | number | null | undefined)[]
): boolean {
  const haystack = fields
    .filter((v) => v != null)
    .join(" ")
    .toLocaleLowerCase("en-US");
  return query
    .trim()
    .toLocaleLowerCase("en-US")
    .split(/\s+/)
    .every((word) => haystack.includes(word));
}
