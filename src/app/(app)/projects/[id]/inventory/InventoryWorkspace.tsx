"use client";
import { useEffect, useMemo, useReducer, useState } from "react";
import {
  InventoryController,
  COST_BUCKETS,
  budgetEvaluation,
  materialCostSummary,
  basicHoldingExample,
  operationalCarrying,
  type InventoryCommand,
  type InventoryFinance,
} from "@railcommand/domain";
import {
  saveInventoryDraft,
  readInventoryDraft,
  removeInventoryDraft,
  cacheInventory,
  readCachedInventory,
} from "@/lib/inventory/drafts";
import { ConfirmedRules } from "./ConfirmedRules";
import styles from "./inventory.module.css";
import { createClient } from "@/lib/supabase/client";
async function request<T>(
  userId: string,
  url: string,
  body?: unknown,
): Promise<T> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  if (session?.user.id !== userId)
    throw new Error("Account changed; saved request was not sent.");
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await r.json();
  if (!r.ok || (!body && data.error))
    throw new Error(data.error ?? "Inventory unavailable");
  return data;
}
export function InventoryWorkspace({
  userId,
  projectId,
  transport,
}: {
  userId: string;
  projectId: string;
  transport?: Pick<
    import("@railcommand/domain").InventoryPorts,
    "read" | "execute" | "receipt"
  >;
}) {
  const [, render] = useReducer((x) => x + 1, 0);
  const [online, setOnline] = useState(true);
  const [financialInput, setFinancialInput] = useState<
    Record<string, Record<string, string>>
  >({});
  const controller = useMemo(
    () =>
      new InventoryController({
        userId,
        projectId,
        current: () => true,
        uuid: () => crypto.randomUUID(),
        online: () => navigator.onLine,
        read:
          transport?.read ??
          (() =>
            request(
              userId,
              `/api/inventory?${new URLSearchParams({ projectId })}`,
            )),
        execute:
          transport?.execute ??
          ((operationId, command) =>
            request(userId, "/api/inventory", {
              projectId,
              operationId,
              command,
            })),
        receipt:
          transport?.receipt ??
          (async (operationId) =>
            (
              await request<{
                receipt: Awaited<
                  ReturnType<
                    typeof import("@/lib/inventory/service").inventoryReceipt
                  >
                >;
              }>(
                userId,
                `/api/inventory?${new URLSearchParams({ projectId, operationId })}`,
              )
            ).receipt),
        readDraft: () => readInventoryDraft(userId, projectId),
        saveDraft: saveInventoryDraft,
        deleteDraft: () => removeInventoryDraft(userId, projectId),
        cache: (s) => cacheInventory(userId, s),
        readCache: () => readCachedInventory(userId, projectId),
      }),
    [userId, projectId, transport],
  );
  useEffect(() => {
    const unsub = controller.subscribe(render);
    void controller.open();
    const change = () => {
      setOnline(navigator.onLine);
      void controller.refresh();
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    return () => {
      unsub();
      controller.dispose();
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
    };
  }, [controller]);
  const s = controller.snapshot,
    d = controller.draft?.command;
  const disabled =
    !online || controller.busy || controller.draft?.phase === "unknown";
  const actorName = (id: string | null | undefined) =>
    s?.actors?.find((a) => a.id === id)?.name ?? id ?? "waiting";
  const act = (command: InventoryCommand) => void controller.act(command);
  return (
    <main className={styles.page}>
      <header>
        <div>
          <small>FIELD / MATERIAL CONTROL</small>
          <h1>Inventory & approval trail</h1>
          <p>Request → inventory lead → distinct PM → required authorization → release</p>
        </div>
        <button
          onClick={() => void controller.refresh()}
          disabled={!online || controller.busy}
        >
          Refresh
        </button>
      </header>
      <p role="status" className={styles.notice}>
        {controller.message}
      </p>
      {s && (
        <p>
          As of {new Date(s.asOf).toLocaleString()} ·{" "}
          {!online
            ? "Cached · read-only; reconnect to verify stock"
            : "Server snapshot · refresh before decisions"}
        </p>
      )}
      {controller.draft?.phase === "unknown" && (
        <section>
          <h2>Unconfirmed operation</h2>
          <p>
            Keep this operation identity:{" "}
            {controller.draft.pending?.operationId}. Check the receipt before
            changing the saved input. Private decision input stays only in the
            current session. Resolve online to return an accepted receipt or durably close a never-applied operation, without replaying private input.
          </p>
          <button
            disabled={!online || controller.busy}
            onClick={() => void controller.recover()}
          >
            Check receipt
          </button>
          <button
            disabled={!online || controller.busy}
            onClick={() => void controller.settle()}
          >
            Resolve original operation online
          </button>
          <button
            disabled={!online || controller.busy || !!controller.draft?.pending?.command.receiptOnly}
            onClick={() => void controller.act()}
          >
            Retry saved operation
          </button>
        </section>
      )}
      {!s && !controller.loaded && <p>Loading inventory…</p>}
      {s && (
        <>
          <section>
            <h2>Stock by lot</h2>
            {!s.lots.length && (
              <p>
                No accepted opening stock yet. An authorized manager must record
                the source and inspection acceptance.
              </p>
            )}
            <div className={styles.grid}>
              {s.lots.map((l) => (
                <article key={l.id}>
                  <h3>
                    {l.material} · {l.yard}
                  </h3>
                  <strong className={styles.balance}>
                    {l.balance.toLocaleString()} ties
                  </strong>
                  <p>
                    {l.readiness} · inspection{" "}
                    {l.inspection_accepted ? "accepted" : "pending"}
                  </p>
                  <p>
                    {l.received_at
                      ? `Received ${l.received_at}`
                      : "Receipt date unknown"}{" "}
                    · {l.condition.replaceAll("_", " ")}
                  </p>
                  <p>Age source: {l.age_source}</p>
                  <p>
                    Drying window: 4–10 calendar months ·{" "}
                    {l.drying_started_at ?? "start unknown"} →{" "}
                    {l.drying_completed_at ?? "completion unknown"}
                  </p>
                  {l.latestCount && (
                    <p
                      className={
                        l.latestCount.counted !== l.balance ? styles.hold : ""
                      }
                    >
                      Count {l.latestCount.counted} vs ledger {l.balance} ·{" "}
                      {l.latestCount.reason} ·{" "}
                      {l.latestCount.lot_version === l.version
                        ? "current baseline"
                        : "recount required"}
                    </p>
                  )}
                  <button
                    disabled={controller.draft?.phase === "unknown"}
                    onClick={() =>
                      void controller.edit({
                        lotId: l.id,
                        lotVersion: l.version,
                      })
                    }
                  >
                    Request from this lot
                  </button>
                  {(s.assignments?.lead_id === userId || s.canManage) && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        act({
                          action: "count",
                          lotId: l.id,
                          lotVersion: l.version,
                          quantity: Number(f.get("quantity")),
                          reason: String(f.get("reason")),
                        });
                      }}
                    >
                      <label>
                        Observed count
                        <input name="quantity" type="number" min="0" required />
                      </label>
                      <label>
                        Recount / verification evidence
                        <input name="reason" required maxLength={2000} />
                      </label>
                      <button disabled={disabled}>Record observation</button>
                    </form>
                  )}
                </article>
              ))}
            </div>
          </section>
          <section>
            <h2>Request stock</h2>
            <p>
              Offline input stays on this device. Submission and approval are
              online-only. No physical release before every required authorization.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void controller.act();
              }}
            >
              <label>
                Lot
                <select
                  required
                  value={String(d?.lotId ?? "")}
                  disabled={
                    !controller.loaded ||
                    controller.busy ||
                    controller.draft?.phase === "unknown"
                  }
                  onChange={(e) => {
                    const l = s.lots.find((x) => x.id === e.target.value);
                    void controller.edit({
                      lotId: l?.id ?? "",
                      lotVersion: l?.version,
                    });
                  }}
                >
                  <option value="">Choose stock</option>
                  {s.lots.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.material} · {l.yard} · {l.balance} ties
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Quantity of ties
                <input
                  required
                  type="number"
                  min="1"
                  step="1"
                  value={String(d?.quantity ?? "")}
                  disabled={
                    controller.busy || controller.draft?.phase === "unknown"
                  }
                  onChange={(e) =>
                    void controller.edit({
                      quantity:
                        e.target.value === "" ? "" : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                Work location
                <input
                  required
                  maxLength={240}
                  value={String(d?.workLocation ?? "")}
                  disabled={
                    controller.busy || controller.draft?.phase === "unknown"
                  }
                  onChange={(e) =>
                    void controller.edit({ workLocation: e.target.value })
                  }
                />
              </label>
              <label>
                Reason
                <textarea
                  aria-label="Reason"
                  required
                  maxLength={2000}
                  value={String(d?.reason ?? "")}
                  disabled={
                    controller.busy || controller.draft?.phase === "unknown"
                  }
                  onChange={(e) =>
                    void controller.edit({ reason: e.target.value })
                  }
                />
              </label>
              <button disabled={disabled || !d?.lotId}>
                Submit request online
              </button>
            </form>
          </section>
          <section>
            <h2>Requests & assigned approvals</h2>
            <p>
              Inventory lead:{" "}
              {actorName(s.assignments?.lead_id) ?? "Not assigned"} · PM:{" "}
              {actorName(s.assignments?.pm_id) ?? "Not assigned"}
            </p>
            {!s.requests.length && <p>No requests yet.</p>}
            {s.requests.map((r) => {
              const l = s.lots.find((x) => x.id === r.lot_id);
              const base = {
                requestId: r.id,
                expectedVersion: r.version,
                lotVersion: l?.version,
              };
              return (
                <article key={r.id}>
                  <h3>
                    #{r.number} · {r.quantity} ties → {r.work_location}
                  </h3>
                  <p>
                    {r.state === "awaiting_supply_chain" ? (s.finance ? "Waiting for Supply Chain authorization" : "Waiting for required authorization") : r.state} · revision {r.revision} · version {r.version}
                  </p>
                  <p>{r.reason}</p>
                  <p>
                    Requester {actorName(r.requester_id)} · verifier{" "}
                    {actorName(r.verifier_id)} · PM {actorName(r.approver_id)}
                  </p>
                  {r.state === "submitted" &&
                    s.assignments?.lead_id === userId &&
                    r.requester_id !== userId && (
                      <button
                        disabled={disabled}
                        onClick={() => act({ action: "verify", ...base })}
                      >
                        Verify quantity & location
                      </button>
                    )}
                  {r.state === "verified" &&
                    s.assignments?.pm_id === userId &&
                    r.requester_id !== userId &&
                    r.verifier_id !== userId && (
                      <button
                        disabled={disabled}
                        onClick={() => act({ action: "authorize", ...base })}
                      >
                        Authorize & post release
                      </button>
                    )}
                  {r.state === "awaiting_supply_chain" && s.finance?.supplyChainAssignment?.actor_id === userId && s.canManage && s.finance.annual?.find(a => a.lotId === r.lot_id)?.evaluation.eligibleSupplyChain && ![r.requester_id,r.verifier_id,r.approver_id].includes(userId) && <button disabled={disabled} onClick={() => act({ action: "supply_chain", ...base })}>Supply Chain authorize & post release</button>}
                  {["submitted", "verified"].includes(r.state) &&
                    [s.assignments?.lead_id, s.assignments?.pm_id].includes(
                      userId,
                    ) && (
                      <button
                        disabled={disabled}
                        onClick={() => {
                          const reason = window.prompt("Reason for rejection");
                          if (reason)
                            act({ action: "reject", ...base, reason });
                        }}
                      >
                        Reject with reason
                      </button>
                    )}
                  {r.requester_id === userId &&
                    !["posted", "cancelled"].includes(r.state) && (
                      <>
                        <button
                          disabled={disabled}
                          onClick={() =>
                            act({ action: "revise", ...base, reason: r.reason })
                          }
                        >
                          Rebase for fresh two-step review
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() =>
                            act({
                              action: "cancel",
                              ...base,
                              reason: "Requester cancelled",
                            })
                          }
                        >
                          Cancel request
                        </button>
                      </>
                    )}
                </article>
              );
            })}
          </section>
          <section>
            <h2>Evidence & conditions</h2>
            {s.revisions?.map((v) => (
              <p key={`${v.request_id}:${v.revision}`}>
                Request {v.request_id} · revision {v.revision}:{" "}
                {v.payload.quantity} ties → {v.payload.workLocation} ·{" "}
                {v.payload.reason} · actor {actorName(v.actor_id)} ·{" "}
                {v.created_at}. Required lead {actorName(v.payload.leadId)}, PM{" "}
                {actorName(v.payload.pmId)}; policy revision{" "}
                {v.payload.policyVersion}.
              </p>
            ))}
            {s.denials.map((e) => (
              <p key={e.id}>
                {e.code.replaceAll("_", " ")} · actor {actorName(e.actor_id)} ·{" "}
                {new Date(e.created_at).toLocaleString()}
              </p>
            ))}
            {s.events.map((e) => (
              <p key={e.id}>
                {e.action} · {e.previous_state ?? "—"} →{" "}
                {e.next_state ?? "recorded"} · revision {e.revision ?? "—"} ·
                actor {actorName(e.actor_id)} ·{" "}
                <time title={e.created_at}>
                  {new Date(e.created_at).toLocaleString()} ({e.created_at})
                </time>
                {e.reason ? ` · ${e.reason}` : ""}
              </p>
            ))}
          </section>
          {s.finance && online && (
            <Finance
              financialInput={financialInput}
              capture={(key, form) =>
                setFinancialInput((old) => ({
                  ...old,
                  [key]: Object.fromEntries(
                    Array.from(new FormData(form).entries()).map(
                      ([key, value]) => [key, String(value)],
                    ),
                  ),
                }))
              }
              finance={s.finance}
              snapshot={s}
              disabled={disabled}
              act={act}
            />
          )}
          {s.canManage && (
            <section>
              <h2>Pilot setup</h2>
              <p>
                Use accepted source records. Local synthetic testing does not
                authorize live pilot setup.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  act({
                    action: "assign",
                    leadId: f.get("leadId"),
                    pmId: f.get("pmId"),
                    expectedVersion: s.assignments?.version ?? 0,
                  });
                }}
              >
                <label>
                  Inventory lead profile UUID
                  <input
                    name="leadId"
                    required
                    defaultValue={s.assignments?.lead_id}
                  />
                </label>
                <label>
                  Distinct PM profile UUID
                  <input
                    name="pmId"
                    required
                    defaultValue={s.assignments?.pm_id}
                  />
                </label>
                <button disabled={disabled}>Record assignments</button>
              </form>
              <details>
                <summary>Accept an opening lot</summary>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    act({
                      action: "opening",
                      materialCode: f.get("code"),
                      material: f.get("material"),
                      yard: f.get("yard"),
                      quantity: Number(f.get("quantity")),
                      source: f.get("source"),
                      receivedAt: f.get("date"),
                      dryingStartedAt: f.get("dryingStartedAt"),
                      dryingCompletedAt: f.get("dryingCompletedAt"),
                      inspectionAccepted: f.get("inspection") === "on",
                      readiness: "ready",
                    });
                  }}
                >
                  {[
                    ["code", "Material code"],
                    ["material", "Material name"],
                    ["yard", "Yard"],
                    ["source", "Acceptance source"],
                  ].map(([n, l]) => (
                    <label key={n}>
                      {l}
                      <input required name={n} />
                    </label>
                  ))}
                  <label>
                    Accepted quantity
                    <input required name="quantity" type="number" min="1" />
                  </label>
                  <label>
                    Receipt date, if known
                    <input name="date" type="date" />
                  </label>
                  <label>
                    Supplier drying start, if known
                    <input name="dryingStartedAt" type="date" />
                  </label>
                  <label>
                    Supplier drying completion, if known
                    <input name="dryingCompletedAt" type="date" />
                  </label>
                  <label>
                    <input type="checkbox" name="inspection" required />
                    Inspection accepted
                  </label>
                  <button disabled={disabled}>Accept opening balance</button>
                </form>
              </details>
            </section>
          )}
        </>
      )}
    </main>
  );
}
function Finance({
  financialInput,
  capture,
  finance: f,
  snapshot: s,
  disabled,
  act,
}: {
  financialInput: Record<string, Record<string, string>>;
  capture: (key: string, form: HTMLFormElement) => void;
  finance: InventoryFinance;
  snapshot: import("@railcommand/domain").InventorySnapshot;
  disabled: boolean;
  act: (c: InventoryCommand) => void;
}) {
  const [example, setExample] = useState<ReturnType<
    typeof basicHoldingExample
  > | null>(null);
  return (
    <section>
      <h2>Material cost & budget review</h2>
      <p className={styles.notice}>
        Remaining cost components may be incomplete. Confirmed organization defaults apply to annual capital costs and contract-year authorization.
      </p>
      <p>
        Base {f.budget.base} · adjusted {f.budget.adjusted} · spent{" "}
        {f.budget.spent} · posted new exposure {f.budget.postedNewExposure}
      </p>
      <ConfirmedRules finance={f} canManage={s.canManage} disabled={disabled} values={financialInput} capture={capture} act={act} />
      {s.lots.map((l) => {
        const c = f.costs.find((c) => c.lot_id === l.id),
          source = f.sources.find((e) => e.id === c?.exposure_id);
        const evaluation = budgetEvaluation(f.budget, source, false);
        const totals = materialCostSummary(c);
        const carrying = operationalCarrying(l,c,f.policy,s.asOf);
        return (
          <article key={l.id}>
            <h3>
              {l.material} · {l.yard}
            </h3>
            <p>
              Cost revision {c?.version ?? "missing"} ·{" "}
              {evaluation.state === "unknown"
                ? "Funding unknown — posting held"
                : evaluation.state === "hold"
                  ? `Budget hold ${evaluation.shortfall}`
                  : `Headroom ${evaluation.headroom}`}
            </p>
            <p>
              Creosote oil quote snapshot:{" "}
              {c?.creosote_oil_reference ?? "Awaiting source"}
            </p>
            <p>
              Landed acquisition:{" "}
              {totals.landed ?? "Incomplete — source/value missing"}. Installed
              subtotal excluding carrying:{" "}
              {totals.installedExcludingCarrying ?? "Incomplete"}. Total
              incomplete until all components are sourced. Annual capital component (ACT/365; remaining quantity at opening acquisition value): {carrying.annual === null ? "incomplete: valuation or receipt age unknown" : carrying.annual.toFixed(2)} · {carrying.days ?? "unknown"} days · rate {carrying.rate ?? "unknown"} per year. Storage is separate and never counted twice.
            </p>
            <dl>
              {COST_BUCKETS.map((k) => (
                <div key={k}>
                  <dt>{k.replaceAll("_", " ")}</dt>
                  <dd>
                    {c?.components[k].amount ?? "Awaiting Wendy"} ·{" "}
                    {c?.components[k].status ?? "incomplete"} ·{" "}
                    {c?.components[k].source || "Source missing"}
                  </dd>
                </div>
              ))}
            </dl>
            {s.canManage && c && (
              <details>
                <summary>Record a new manual cost/source revision</summary>
                <form
                  onChange={(e) => capture(l.id, e.currentTarget)}
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const components = Object.fromEntries(
                      COST_BUCKETS.map((k) => [
                        k,
                        {
                          amount:
                            k === "carrying_cost" || form.get(k) === ""
                              ? null
                              : Number(form.get(k)),
                          status: form.get(`${k}:status`) ?? "awaiting_wendy",
                          source: String(form.get(`${k}:source`) ?? ""),
                        },
                      ]),
                    );
                    act({
                      action: "cost",
                      lotId: l.id,
                      lotVersion: l.version,
                      costVersion: Number(form.get("costVersion")),
                      components,
                      creosoteOilReference: form.get("oil"),
                      exposureId: form.get("exposureId") || null,
                      contractId: form.get("contractId"),
                      periodYear: form.get("periodYear"),
                      currency: form.get("currency"),
                      annualRateOverride: form.get("annualRateOverride"),
                      sourceKey: form.get("sourceKey"),
                      source: form.get("source"),
                      funding: form.get("funding"),
                      incrementalAmount: form.get("incrementalAmount"),
                      milestoneId: form.get("milestoneId"),
                      changeOrderId: form.get("changeOrderId"),
                    });
                  }}
                >
                  <input
                    type="hidden"
                    name="costVersion"
                    defaultValue={
                      financialInput[l.id]?.costVersion ?? c.version
                    }
                  />
                  <p>
                    Entered cost baseline{" "}
                    {financialInput[l.id]?.costVersion ?? c.version}; current
                    revision {c.version}. A changed revision requires explicit
                    review.
                  </p>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={(event) => {
                      const form = event.currentTarget.form!;
                      (
                        form.elements.namedItem(
                          "costVersion",
                        ) as HTMLInputElement
                      ).value = String(c.version);
                      capture(l.id, form);
                    }}
                  >
                    Review current cost revision and rebase entered values
                  </button>
                  {COST_BUCKETS.filter((k) => k !== "carrying_cost").map(
                    (k) => (
                      <fieldset key={k}>
                        <legend>{k.replaceAll("_", " ")}</legend>
                        <label>
                          Amount (blank = unknown)
                          <input
                            name={k}
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              financialInput[l.id]?.[k] ??
                              c.components[k].amount ??
                              ""
                            }
                          />
                        </label>
                        <label>
                          Source / quote
                          <input
                            name={`${k}:source`}
                            defaultValue={
                              financialInput[l.id]?.[`${k}:source`] ??
                              c.components[k].source
                            }
                          />
                        </label>
                        <label>
                          Status
                          <select
                            name={`${k}:status`}
                            defaultValue={
                              financialInput[l.id]?.[`${k}:status`] ??
                              c.components[k].status
                            }
                          >
                            {[
                              "awaiting_wendy",
                              "estimate",
                              "actual",
                              "commitment",
                            ].map((status) => (
                              <option key={status} value={status}>
                                {status.replaceAll("_", " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                      </fieldset>
                    ),
                  )}
                  <label>
                    Creosote oil-linked quote/reference snapshot
                    <input
                      name="oil"
                      defaultValue={
                        financialInput[l.id]?.oil ??
                        c.creosote_oil_reference ??
                        ""
                      }
                    />
                  </label>
                  <label>
                    Reuse existing reconciliation source
                    <select
                      name="exposureId"
                      defaultValue={financialInput[l.id]?.exposureId}
                    >
                      <option value="">Create distinct source</option>
                      {f.sources.map((e) => (
                        <option value={e.id} key={e.id}>
                          {e.source_key}
                        </option>
                      ))}
                    </select>
                  </label>
                  {[["contractId","Shared contract UUID (required for new spending)"],["periodYear","Contract period start year"],["currency","Source currency (ISO 4217)"],["annualRateOverride","Annual carrying override (fraction/year; blank uses organization default)"]].map(([name,label]) => <label key={name}>{label}<input name={name} defaultValue={financialInput[l.id]?.[name]} /></label>)}
                  <label>
                    New source identity
                    <input
                      defaultValue={financialInput[l.id]?.sourceKey}
                      name="sourceKey"
                    />
                  </label>
                  <label>
                    Source evidence
                    <input
                      defaultValue={financialInput[l.id]?.source}
                      name="source"
                    />
                  </label>
                  <label>
                    Funding treatment
                    <select
                      name="funding"
                      defaultValue={financialInput[l.id]?.funding}
                    >
                      <option value="unknown">Unknown — hold</option>
                      <option value="funded">Already funded</option>
                      <option value="committed">
                        Already committed in baseline
                      </option>
                      <option value="new">New contractual exposure</option>
                    </select>
                  </label>
                  <label>
                    Distinct incremental exposure
                    <input
                      defaultValue={financialInput[l.id]?.incrementalAmount}
                      name="incrementalAmount"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </label>
                  <label>
                    Optional milestone
                    <select
                      name="milestoneId"
                      defaultValue={financialInput[l.id]?.milestoneId}
                    >
                      <option value="">None</option>
                      {f.milestones.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Existing same-project CO
                    <select
                      name="changeOrderId"
                      defaultValue={financialInput[l.id]?.changeOrderId}
                    >
                      <option value="">None</option>
                      {f.budget.changeOrders.map((co) => (
                        <option key={co.id} value={co.id}>
                          {co.number} · {co.status} ·{" "}
                          {co.signed ? "signed" : "unsigned"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={disabled}>
                    Save revision; require fresh approvals
                  </button>
                </form>
              </details>
            )}
          </article>
        );
      })}
      <details>
        <summary>Pinned approval budget evidence</summary>
        {f.requestSnapshots?.map((v) => (
          <p key={`${v.request_id}:${v.revision}`}>
            Request {v.request_id} · revision {v.revision} · base{" "}
            {v.budget_snapshot.base} · adjusted {v.budget_snapshot.adjusted} ·
            spent {v.budget_snapshot.spent} · cost source{" "}
            {v.cost_revision_id ?? "unconfirmed"} · reconciliation{" "}
            {v.exposure_id ?? "unknown"}.
          </p>
        ))}
      </details>
      <details>
        <summary>Isolated calculation example</summary>
        <p>
          Explicit synthetic inputs only: seven upstream amounts 20000 + 10000 +
          8000 + 6000 + 4000 + 12000 + 8000; storage 30 per day, annual capital
          rate 8%, 60 days; installation/inspection/disposal 42000. This never
          writes stock, configuration, or a budget.
        </p>
        <button
          disabled={disabled}
          onClick={() =>
            setExample(
              basicHoldingExample(
                [20000, 10000, 8000, 6000, 4000, 12000, 8000],
                30,
                0.08,
                60,
                42000,
              ),
            )
          }
        >
          Calculate isolated example
        </button>
        {example && (
          <p>
            Acquisition {example.landed}; holding {example.holding}; acquisition
            plus holding {example.landedAndHolding}; installed basic{" "}
            {example.installedBasic}.
          </p>
        )}
      </details>
      {s.canManage && (
        <details>
          <summary>Unconfirmed configuration proposals</summary>
          <p>
            Proposed values remain unconfirmed and do not affect totals, holding
            costs, or required approval steps.
          </p>
          <form
            onChange={(e) => capture("configuration", e.currentTarget)}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              act({
                action: "configuration",
                expectedVersion: Number(form.get("configurationVersion")),
                annualRate: form.get("annualRate"),
                storageDaily: form.get("storageDaily"),
                thresholdAmount: form.get("thresholdAmount"),
                currency: form.get("currency"),
                source: form.get("source"),
              });
            }}
          >
            <input
              type="hidden"
              name="configurationVersion"
              defaultValue={
                financialInput.configuration?.configurationVersion ??
                f.configuration?.version ??
                0
              }
            />
            <p>
              Entered proposal baseline{" "}
              {financialInput.configuration?.configurationVersion ??
                f.configuration?.version ??
                0}
              ; current {f.configuration?.version ?? 0}. Review before rebasing.
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={(event) => {
                const form = event.currentTarget.form!;
                (
                  form.elements.namedItem(
                    "configurationVersion",
                  ) as HTMLInputElement
                ).value = String(f.configuration?.version ?? 0);
                capture("configuration", form);
              }}
            >
              Review current configuration and rebase proposal
            </button>
            {[
              ["annualRate", "Proposed annual carrying rate"],
              ["storageDaily", "Proposed daily storage amount"],
              ["thresholdAmount", "Proposed threshold amount"],
            ].map(([n, l]) => (
              <label key={n}>
                {l}
                <input
                  name={n}
                  defaultValue={financialInput.configuration?.[n]}
                  type="number"
                  min="0"
                  step="any"
                />
              </label>
            ))}
            <label>
              Proposed currency
              <input
                name="currency"
                defaultValue={financialInput.configuration?.currency}
              />
            </label>
            <label>
              Proposal source
              <input
                defaultValue={financialInput.configuration?.source}
                name="source"
                required
              />
            </label>
            <button disabled={disabled}>Save unconfirmed proposal</button>
          </form>
        </details>
      )}
    </section>
  );
}
