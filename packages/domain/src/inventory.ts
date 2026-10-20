/** Additive Phase 1 contract. Field projections never contain finance. */
export const COST_BUCKETS = [
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
] as const;
export type CostBucket = (typeof COST_BUCKETS)[number];
export type CostComponent = {
  amount: number | null;
  status: "awaiting_wendy" | "estimate" | "actual" | "commitment";
  source: string;
};
export type InventoryCommand = {
  action:
    | "settle"
    | "assign"
    | "opening"
    | "configuration"
    | "cost"
    | "count"
    | "submit"
    | "revise"
    | "cancel"
    | "verify"
    | "authorize"
    | "reject";
  [key: string]: unknown;
};
export type InventoryResult = {
  ok?: boolean;
  error?: string;
  code?: string;
  requestId?: string;
  lotId?: string;
  version?: number;
  balance?: number;
};
export type InventoryLot = {
  id: string;
  project_id: string;
  material: string;
  yard: string;
  balance: number;
  version: number;
  readiness: "ready" | "drying" | "quarantined";
  inspection_accepted: boolean;
  received_at: string | null;
  age_source: string;
  drying_started_at: string | null;
  drying_completed_at: string | null;
  drying_min_months: 4;
  drying_max_months: 10;
  condition: "unknown_age" | "aged" | "current";
  latestCount: {
    expected: number;
    counted: number;
    lot_version: number;
    reason: string;
    created_at: string;
  } | null;
};
export type InventoryRequest = {
  id: string;
  number: number;
  lot_id: string;
  requester_id: string;
  quantity: number;
  work_location: string;
  reason: string;
  state: "submitted" | "verified" | "posted" | "rejected" | "cancelled";
  version: number;
  revision: number;
  verifier_id: string | null;
  approver_id: string | null;
  created_at: string;
};
export type InventoryEvent = {
  id: string;
  request_id: string | null;
  action: string;
  actor_id: string;
  revision: number | null;
  previous_state: string | null;
  next_state: string | null;
  reason?: string | null;
  created_at: string;
};
export type InventoryCost = {
  id: string;
  lot_id: string;
  version: number;
  components: Record<CostBucket, CostComponent>;
  creosote_oil_reference: string | null;
  exposure_id: string | null;
  created_at: string;
};
export type InventorySource = {
  id: string;
  source_key: string;
  funding: "funded" | "committed" | "new" | "unknown";
  amount: number | null;
  source: string;
  milestone_id: string | null;
  change_order_id: string | null;
};
export type InventoryFinance = {
  budget: {
    base: number;
    spent: number;
    adjusted: number;
    postedNewExposure: number;
    postedSourceIds?: string[];
    changeOrders: {
      id: string;
      number: string;
      amount: number;
      status: string;
      signed: boolean;
    }[];
  };
  costs: InventoryCost[];
  sources: InventorySource[];
  milestones: { id: string; name: string }[];
  configuration: {
    version: number;
    status: "unconfirmed";
    annual_rate: number | null;
    storage_daily: number | null;
    threshold_amount: number | null;
    currency: string | null;
    source: string;
  } | null;
  requestSnapshots?: {
    request_id: string;
    revision: number;
    cost_revision_id: string | null;
    exposure_id: string | null;
    budget_snapshot: InventoryFinance["budget"];
  }[];
  evaluation: "incomplete_awaiting_wendy";
};
export type InventorySnapshot = {
  projectId: string;
  asOf: string;
  canManage: boolean;
  actors?: { id: string; name: string; role: string }[];
  revisions?: {
    request_id: string;
    revision: number;
    payload: {
      quantity: number;
      workLocation: string;
      reason: string;
      lotVersion: number;
      leadId: string;
      pmId: string;
      policyVersion: number;
    };
    actor_id: string;
    created_at: string;
  }[];
  assignments: { lead_id: string; pm_id: string; version: number } | null;
  lots: InventoryLot[];
  requests: InventoryRequest[];
  events: InventoryEvent[];
  denials: {
    id: string;
    code: string;
    actor_id: string;
    request_id: string | null;
    created_at: string;
  }[];
  finance?: InventoryFinance;
};
export function operationalInventory(
  snapshot: InventorySnapshot,
): InventorySnapshot {
  const { finance: _finance, ...field } = snapshot;
  // Match the server's field boundary. Unknown/new event classes stay online
  // until explicitly reviewed for operational persistence. No event reason is
  // public to field clients, even when the current online reader has finance.
  const actions = new Set([
    "assign", "opening", "count", "submit", "revise", "cancel", "verify",
    "authorize", "reject",
  ]);
  return {
    ...field,
    ...(field.events && {
      events: field.events.filter((e) => actions.has(e.action)).map((e) => ({
        id: e.id,
        request_id: e.request_id,
        action: e.action,
        actor_id: e.actor_id,
        revision: e.revision,
        previous_state: e.previous_state,
        next_state: e.next_state,
        created_at: e.created_at,
      })),
    }),
  };
}
/** Explicitly supplied example inputs, never an operational rate or config default. */
export function basicHoldingExample(
  upstream: readonly number[],
  storageDaily: number,
  annualRate: number,
  days: number,
  installLabour: number,
) {
  if (
    ![...upstream, storageDaily, annualRate, days, installLabour].every(
      (v) => Number.isFinite(v) && v >= 0,
    )
  )
    throw new Error("Nonnegative example inputs required");
  const landed = upstream.reduce((a, b) => a + b, 0);
  const holding =
    Math.round(
      (storageDaily * days + (landed * annualRate * days) / 365) * 100,
    ) / 100;
  return {
    landed,
    holding,
    landedAndHolding: landed + holding,
    installedBasic: landed + holding + installLabour,
  };
}
export function budgetEvaluation(
  budget: InventoryFinance["budget"],
  source: InventorySource | undefined,
  alreadyPosted: boolean,
) {
  if (
    !source ||
    source.funding === "unknown" ||
    (source.funding === "new" && source.amount === null)
  )
    return { state: "unknown" as const };
  const incremental =
    source.funding === "new" &&
    !alreadyPosted &&
    !budget.postedSourceIds?.includes(source.id)
      ? source.amount!
      : 0;
  const forecast =
    Number(budget.spent) +
    Number(budget.postedNewExposure) +
    Number(incremental);
  const headroom = Number(budget.adjusted) - forecast;
  return {
    state: headroom < 0 ? ("hold" as const) : ("within_budget" as const),
    incremental,
    forecast,
    headroom,
    shortfall: Math.max(0, -headroom),
  };
}
export type InventoryDraft = {
  schemaVersion: 1;
  userId: string;
  projectId: string;
  operationId: string;
  updatedAt: string;
  phase: "editing" | "unknown";
  pending?: { operationId: string; command: InventoryCommand };
  command: InventoryCommand;
};
export function parseInventoryDraft(
  input: unknown,
  userId: string,
  projectId: string,
): InventoryDraft | null {
  const d = input as InventoryDraft | null;
  if (
    !d ||
    d.schemaVersion !== 1 ||
    d.userId !== userId ||
    d.projectId !== projectId ||
    !d.operationId ||
    !d.command ||
    !["editing", "unknown"].includes(d.phase)
  )
    return null;
  return d;
}

export function inventoryDeviceDraft(draft: InventoryDraft): InventoryDraft {
  // Request/revision/count text is operational field input. Decision reasons
  // are private event evidence; preserve only their original receipt identity.
  const safeCommand = (command: InventoryCommand): InventoryCommand => {
    if (!["cost", "configuration", "reject", "cancel"].includes(command.action))
      return command;
    // Retain only original operational scope/baselines, never commercial input.
    // Missing legacy metadata remains missing; a fresh snapshot cannot supply it.
    const safe: InventoryCommand = { action: command.action, receiptOnly: true };
    for (const key of ["requestId", "lotId"])
      if (typeof command[key] === "string") safe[key] = command[key];
    for (const key of ["expectedVersion", "lotVersion", "costVersion"])
      if (Number.isSafeInteger(command[key]) && Number(command[key]) >= 0)
        safe[key] = command[key];
    return safe;
  };
  const command = safeCommand(draft.command);
  const pending = draft.pending ?? (command.receiptOnly
    ? { operationId: draft.operationId, command }
    : undefined);
  return {
    ...draft,
    command,
    ...(command.receiptOnly && !draft.pending ? { phase: "unknown" as const } : {}),
    ...(pending && {
      pending: {
        operationId: pending.operationId,
        command: safeCommand(pending.command),
      },
    }),
  };
}

/** Partial manual cost totals only. An unconfirmed carrying rate never becomes zero. */
export function materialCostSummary(cost: InventoryCost | undefined) {
  const sum = (keys: readonly CostBucket[]) =>
    cost &&
    keys.every(
      (k) =>
        cost.components[k].amount !== null &&
        cost.components[k].status !== "awaiting_wendy" &&
        cost.components[k].source.trim(),
    )
      ? keys.reduce((total, k) => total + Number(cost.components[k].amount), 0)
      : null;
  return {
    landed: sum(COST_BUCKETS.slice(0, 7)),
    installedExcludingCarrying: sum(
      COST_BUCKETS.filter((k) => k !== "carrying_cost"),
    ),
    total: null,
    state: "incomplete_awaiting_wendy" as const,
  };
}
