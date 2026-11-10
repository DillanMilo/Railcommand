"use client";
import { useEffect, useMemo, useReducer, useState, useRef } from "react";
import {
  InventoryController,
  inventoryMatchesSearch,
  inventoryUnitLabel,
  inventoryMoney,
  inventoryLatestCost,
  inventoryRequestStatus,
  inventoryNextApproval,
  inventoryPerTie,
  INVENTORY_COST_LABELS,
  inventoryCostStatus,
  inventoryCostFormValues,
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
import { InventoryCsvExportButton } from "./InventoryCsvExportButton";
import { InventorySetup } from "./InventorySetup";
import { InventoryHistory } from "./InventoryHistory";
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
  const navigationRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState<"stock" | "requests" | "costs">(
    "stock",
  );
  const [stockSearch, setStockSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [setupView, setSetupView] = useState<
    "stock" | "catalogue" | "approvers" | null
  >(null);
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
              `/api/inventory?${new URLSearchParams({ projectId, costEntryVersion: "2", inventoryVersion: "3" })}`,
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
  const shownSection =
    section === "costs" && (!s?.finance || !online) ? "stock" : section;
  const navigate = (next: typeof section) => {
    setSection(next);
    navigationRef.current?.scrollIntoView({
      block: "start",
      behavior: "instant",
    });
  };
  const act = (command: InventoryCommand) => void controller.act(command);
  return (
    <main className={styles.page}>
      <header>
        <div>
          <small>FIELD / MATERIAL CONTROL</small>
          <h1>
            Inventory <span className={styles.beta}>Beta</span>
          </h1>
          <p>Stock, requests and approvals</p>
        </div>
        <button
          onClick={() => void controller.refresh()}
          disabled={!online || controller.busy}
        >
          Refresh
        </button>
      </header>
      <nav
        ref={navigationRef}
        className={styles.sectionLinks}
        aria-label="Inventory sections"
      >
        <button
          type="button"
          aria-pressed={shownSection === "stock"}
          onClick={() => navigate("stock")}
        >
          Stock
        </button>
        <button
          type="button"
          aria-pressed={shownSection === "requests"}
          onClick={() => navigate("requests")}
        >
          Requests &amp; approvals
        </button>
        {s?.finance && online && (
          <button
            type="button"
            aria-pressed={shownSection === "costs"}
            onClick={() => navigate("costs")}
          >
            Material costs
          </button>
        )}
      </nav>
      {(s?.canReceive || s?.canManage) && (
        <div className={styles.sectionLinks}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              navigate("stock");
              setSetupView("stock");
            }}
          >
            Receive stock
          </button>
          {s.canManage && (
            <details>
              <summary>Manage inventory</summary>
              <button
                type="button"
                onClick={() => {
                  navigate("stock");
                  setSetupView("catalogue");
                }}
              >
                Approved catalogue / import
              </button>
              <button
                type="button"
                onClick={() => {
                  navigate("requests");
                  setSetupView("approvers");
                }}
              >
                Choose approvers
              </button>
            </details>
          )}
        </div>
      )}
      {!!d?.lotId && shownSection !== "requests" && (
        <button type="button" onClick={() => navigate("requests")}>
          Resume saved request
        </button>
      )}
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
            current session. Resolve online to return an accepted receipt or
            durably close a never-applied operation, without replaying private
            input.
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
            disabled={
              !online ||
              controller.busy ||
              !!controller.draft?.pending?.command.receiptOnly
            }
            onClick={() => void controller.act()}
          >
            Retry saved operation
          </button>
        </section>
      )}
      {!s && !controller.loaded && <p>Loading inventory…</p>}
      {s && (
        <>
          {(s.canReceive || s.canManage) && (
            <div
              hidden={
                setupView !== "approvers"
                  ? shownSection !== "stock"
                  : shownSection !== "requests"
              }
            >
              <InventorySetup
                snapshot={s}
                view={setupView}
                onClose={() => setSetupView(null)}
                disabled={disabled}
                act={act}
                acceptedMaterialId={
                  controller.lastConfirmed?.action === "catalogue_add"
                    ? controller.lastConfirmed.result.materialId
                    : undefined
                }
                acceptedImportResult={
                  controller.lastConfirmed?.action === "catalogue_import"
                    ? controller.lastConfirmed.result
                    : undefined
                }
                acceptedLotId={
                  controller.lastConfirmed?.action === "opening"
                    ? controller.lastConfirmed.result.lotId
                    : undefined
                }
              />
            </div>
          )}
          <section hidden={shownSection !== "stock"}>
            <h2>Stock by lot</h2>
            <label>
              Search stock by material or yard
              <input
                type="search"
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
              />
            </label>
            {stockSearch && (
              <button type="button" onClick={() => setStockSearch("")}>
                Clear stock search
              </button>
            )}
            {!!s.lots.length &&
              !s.lots.some((l) =>
                inventoryMatchesSearch(
                  stockSearch,
                  l.material_code,
                  l.material,
                  l.yard,
                  inventoryUnitLabel(l.unit),
                ),
              ) && <p role="status">No stock matches your search.</p>}
            {!s.lots.length && (
              <p>
                No accepted stock yet. Your inventory lead or manager can
                receive stock; field crews can request it after acceptance.
              </p>
            )}
            <div className={styles.grid}>
              {s.lots.map((l) => (
                <article
                  key={l.id}
                  hidden={
                    !inventoryMatchesSearch(
                      stockSearch,
                      l.material_code,
                      l.material,
                      l.yard,
                      inventoryUnitLabel(l.unit),
                    )
                  }
                >
                  <h3>
                    {l.material} · {l.yard}
                  </h3>
                  <strong className={styles.balance}>
                    {l.balance.toLocaleString(undefined, {
                      maximumFractionDigits: 3,
                    })}{" "}
                    {inventoryUnitLabel(l.unit)} available
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
                  <details>
                    <summary>Stock details</summary>
                    <p>Age source: {l.age_source}</p>
                    <p hidden={l.category != null && l.category !== "rail_tie"}>
                      Supplier drying dates ·{" "}
                      {l.drying_started_at ?? "start unknown"} →{" "}
                      {l.drying_completed_at ?? "completion unknown"}
                    </p>
                    <p hidden={l.category != null && l.category !== "rail_tie"}>
                      Supplier dates are reference information; inspection
                      confirms acceptance.
                    </p>
                  </details>
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
                    onClick={() => {
                      void controller.edit({
                        lotId: l.id,
                        lotVersion: l.version,
                      });
                      navigate("requests");
                    }}
                  >
                    Request from this lot
                  </button>
                  {(s.assignments?.lead_id === userId || s.canManage) && (
                    <details>
                      <summary>Record a count</summary>
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
                          <input
                            name="quantity"
                            type="number"
                            step={l.unit === "each" || !l.unit ? 1 : 0.001}
                            min="0"
                            required
                          />
                        </label>
                        <label>
                          Recount / verification evidence
                          <input name="reason" required maxLength={2000} />
                        </label>
                        <button disabled={disabled}>Record observation</button>
                      </form>
                    </details>
                  )}
                </article>
              ))}
            </div>
          </section>
          <div hidden={shownSection !== "requests"}>
            <section>
              <h2>Request stock</h2>
              <p>
                Offline input stays on this device. Submission and approval are
                online-only. No physical release before every required
                authorization.
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
                        {l.material} · {l.yard} · {l.balance}{" "}
                        {inventoryUnitLabel(l.unit)}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity (
                  {inventoryUnitLabel(
                    s.lots.find((l) => l.id === d?.lotId)?.unit,
                  )}
                  )
                  <input
                    required
                    type="number"
                    min={
                      s.lots.find((l) => l.id === d?.lotId)?.unit === "each" ||
                      !s.lots.find((l) => l.id === d?.lotId)?.unit
                        ? 1
                        : 0.001
                    }
                    step={
                      s.lots.find((l) => l.id === d?.lotId)?.unit === "each" ||
                      !s.lots.find((l) => l.id === d?.lotId)?.unit
                        ? 1
                        : 0.001
                    }
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
              <label>
                Search requests by number, material, yard, location or reason
                <input
                  type="search"
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                />
              </label>
              {requestSearch && (
                <button type="button" onClick={() => setRequestSearch("")}>
                  Clear request search
                </button>
              )}
              {!!s.requests.length &&
                !s.requests.some((r) => {
                  const l = s.lots.find((x) => x.id === r.lot_id);
                  return inventoryMatchesSearch(
                    requestSearch,
                    `#${r.number}`,
                    l?.material,
                    l?.yard,
                    r.work_location,
                    r.reason,
                  );
                }) && <p role="status">No requests match your search.</p>}
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
                  <article
                    key={r.id}
                    hidden={
                      !inventoryMatchesSearch(
                        requestSearch,
                        `#${r.number}`,
                        l?.material,
                        l?.yard,
                        r.work_location,
                        r.reason,
                      )
                    }
                  >
                    <p className={styles.status}>
                      {inventoryNextApproval(s, r)}
                    </p>
                    <h3>
                      #{r.number} · {r.quantity}{" "}
                      {inventoryUnitLabel(
                        s.lots.find((l) => l.id === r.lot_id)?.unit,
                      )}{" "}
                      → {r.work_location}
                    </h3>
                    <p>
                      {inventoryRequestStatus(r)} · revision {r.revision} ·
                      version {r.version}
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
                    {r.state === "awaiting_supply_chain" &&
                      s.finance?.supplyChainAssignment?.actor_id === userId &&
                      s.finance.canApproveSupplyChain === true &&
                      s.finance.annual?.find((a) => a.lotId === r.lot_id)
                        ?.evaluation.eligibleSupplyChain &&
                      ![r.requester_id, r.verifier_id, r.approver_id].includes(
                        userId,
                      ) && (
                        <button
                          disabled={disabled}
                          onClick={() =>
                            act({ action: "supply_chain", ...base })
                          }
                        >
                          Supply Chain authorize & post release
                        </button>
                      )}
                    {["submitted", "verified"].includes(r.state) &&
                      [s.assignments?.lead_id, s.assignments?.pm_id].includes(
                        userId,
                      ) && (
                        <button
                          disabled={disabled}
                          onClick={() => {
                            const reason = window.prompt(
                              "Reason for rejection",
                            );
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
                              act({
                                action: "revise",
                                ...base,
                                reason: r.reason,
                              })
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
            <details>
              <summary>Approval history &amp; evidence</summary>
              <InventoryHistory snapshot={s} />
            </details>
          </div>
          <div hidden={shownSection !== "costs"}>
            {s.finance && online && (
              <Finance
                userId={userId}
                search={stockSearch}
                setSearch={setStockSearch}
                financialInput={financialInput}
                capture={(key, form) =>
                  setFinancialInput((old) => ({
                    ...old,
                    [key]: {
                      ...old[key],
                      ...Object.fromEntries(
                        Array.from(new FormData(form).entries()).map(
                          ([key, value]) => [key, String(value)],
                        ),
                      ),
                    },
                  }))
                }
                finance={s.finance}
                snapshot={s}
                disabled={disabled}
                act={act}
              />
            )}
          </div>
        </>
      )}
    </main>
  );
}
function Finance({
  userId,
  search,
  setSearch,
  financialInput,
  capture,
  finance: f,
  snapshot: s,
  disabled,
  act,
}: {
  search: string;
  setSearch: (value: string) => void;
  financialInput: Record<string, Record<string, string>>;
  capture: (key: string, form: HTMLFormElement) => void;
  finance: InventoryFinance;
  userId: string;
  snapshot: import("@railcommand/domain").InventorySnapshot;
  disabled: boolean;
  act: (c: InventoryCommand) => void;
}) {
  const [example, setExample] = useState<ReturnType<
    typeof basicHoldingExample
  > | null>(null);
  return (
    <section>
      <h2 id="material-costs">Material cost & budget review</h2>
      <InventoryCsvExportButton
        userId={userId}
        projectId={s.projectId}
        online={!disabled}
      />
      <p>
        Prices are entered per opening lot, with a source and an estimate,
        actual or commitment status. Use <strong>Edit material costs</strong>{" "}
        below each lot.
      </p>
      <label>
        Search costs by material or yard
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {search && (
        <button type="button" onClick={() => setSearch("")}>
          Clear cost search
        </button>
      )}
      {!!s.lots.length &&
        !s.lots.some((l) =>
          inventoryMatchesSearch(search, l.material, l.yard),
        ) && <p role="status">No material costs match your search.</p>}
      <details>
        <summary>Project budget</summary>
        <div className={styles.metrics}>
          <div>
            <span>Approved project budget</span>
            <strong>{inventoryMoney(f.budget.adjusted)}</strong>
            <small>Original budget {inventoryMoney(f.budget.base)}</small>
          </div>
          <div>
            <span>Recorded budget spend</span>
            <strong>{inventoryMoney(f.budget.spent)}</strong>
            <small>Existing project spend record</small>
          </div>
          <div>
            <span>Approved new material commitments</span>
            <strong>{inventoryMoney(f.budget.postedNewExposure)}</strong>
            <small>Counted once per source; not paid invoices</small>
          </div>
          <div>
            <span>Budget left before pending requests</span>
            <strong>
              {inventoryMoney(
                Number(f.budget.adjusted) -
                  Number(f.budget.spent) -
                  Number(f.budget.postedNewExposure),
              )}
            </strong>
            <small>Budget less recorded spend and new commitments</small>
          </div>
        </div>
        <p className={styles.subtle}>
          Budget currency needs confirmation before comparing these figures with
          material prices. Recorded spend and commitments are separate; invoice
          payments are not automatically imported.
        </p>
      </details>
      {s.lots.map((l) => {
        const c = inventoryLatestCost(f, l.id),
          source = f.sources.find((e) => e.id === c?.exposure_id);
        const evaluation = budgetEvaluation(f.budget, source, false);
        const totals = materialCostSummary(c);
        const carrying = operationalCarrying(l, c, f.policy, s.asOf);
        const formValues = {
          ...(c ? inventoryCostFormValues(c, f) : {}),
          ...financialInput[l.id],
        };
        const delivered = formValues.pricingMode === "delivered";
        const currency =
          f.contractSources?.find((x) => x.id === c?.exposure_id)?.currency ??
          f.annual?.find((a) => a.lotId === l.id)?.evaluation.currency ??
          f.policy?.currency;
        return (
          <article
            key={l.id}
            hidden={!inventoryMatchesSearch(search, l.material, l.yard)}
          >
            <h3>
              {l.material} · {l.yard}
            </h3>
            <details>
              <summary>View costs &amp; add prices</summary>
              <p className={styles.status}>
                {evaluation.state === "unknown"
                  ? "Funding needs review — release held"
                  : evaluation.state === "hold"
                    ? `Over budget by ${inventoryMoney(evaluation.shortfall)} — release held`
                    : `${inventoryMoney(evaluation.headroom)} budget headroom after this source`}
              </p>
              <div className={styles.metrics}>
                <div>
                  <span>Acquisition cost · original lot</span>
                  <strong>{inventoryMoney(totals.landed, currency)}</strong>
                  <small>
                    {inventoryMoney(
                      inventoryPerTie(totals.landed, l.opening_quantity),
                      currency,
                    )}{" "}
                    per {inventoryUnitLabel(l.unit)}
                  </small>
                </div>
                <div>
                  <span>Installed subtotal · original lot</span>
                  <strong>
                    {inventoryMoney(
                      totals.installedExcludingCarrying,
                      currency,
                    )}
                  </strong>
                  <small>
                    Acquisition + installation + inspection; excludes disposal
                    and carrying
                  </small>
                </div>
                <div>
                  <span>Future disposal · original lot</span>
                  <strong>{inventoryMoney(totals.disposal, currency)}</strong>
                  <small>Separate lifecycle input</small>
                </div>
                <div>
                  <span>Accrued carrying · remaining stock</span>
                  <strong>{inventoryMoney(carrying.annual, currency)}</strong>
                  <small>
                    {carrying.rate == null
                      ? "Rate not confirmed"
                      : `${carrying.rate * 100}% / year`}{" "}
                    · {carrying.days ?? "Unknown"} days held
                  </small>
                </div>
              </div>
              <p className={styles.subtle}>
                Original opening lot: {l.opening_quantity ?? "unknown"}{" "}
                {inventoryUnitLabel(l.unit)} · current stock: {l.balance}{" "}
                {inventoryUnitLabel(l.unit)}. Full true cost remains incomplete
                until all components are sourced. Carrying uses remaining
                acquisition value × annual rate × days / 365. Storage is
                separate.
              </p>
              {s.canManage && c && (
                <details>
                  <summary className={styles.editAction}>
                    Edit material costs
                  </summary>
                  <p>
                    Enter total amounts for the original opening lot, not a
                    per-unit price. Leave unknown amounts blank. Saving creates
                    a new revision and requires fresh approvals. Cost edits stay
                    in this session only; save online before closing the app.
                  </p>
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
                        ...(f.costEntryVersion === 2
                          ? {
                              pricingMode: form.get("pricingMode"),
                              purchasePrice:
                                form.get("pricingMode") === "delivered"
                                  ? {
                                      amount: Number(
                                        form.get("purchaseAmount"),
                                      ),
                                      source: String(
                                        form.get("purchaseSource") ?? "",
                                      ),
                                      status: form.get("purchaseStatus"),
                                    }
                                  : null,
                            }
                          : {}),
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
                      defaultValue={formValues.costVersion ?? c.version}
                    />
                    <p>
                      Entered cost baseline{" "}
                      {formValues.costVersion ?? c.version}; current revision{" "}
                      {c.version}. A changed revision requires explicit review.
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
                    {f.costEntryVersion === 2 && (
                      <>
                        <label>
                          Acquisition price method
                          <select
                            name="pricingMode"
                            defaultValue={formValues.pricingMode}
                          >
                            <option value="delivered">
                              Delivered invoice / quote (simplest)
                            </option>
                            <option
                              value="breakdown"
                              disabled={
                                l.category != null && l.category !== "rail_tie"
                              }
                            >
                              Manufacturing breakdown
                            </option>
                          </select>
                        </label>
                        <fieldset hidden={!delivered} disabled={!delivered}>
                          <legend>
                            Delivered price · original opening lot
                          </legend>
                          <p>
                            Include treatment and delivery already in the
                            invoice. Manufacturing amounts below are not added
                            again.
                          </p>
                          <label>
                            Total delivered amount
                            <input
                              name="purchaseAmount"
                              type="number"
                              min="0"
                              step="0.01"
                              required={delivered}
                              defaultValue={formValues.purchaseAmount}
                            />
                          </label>
                          <label>
                            Invoice / quote evidence
                            <input
                              name="purchaseSource"
                              required={delivered}
                              maxLength={2000}
                              defaultValue={formValues.purchaseSource}
                            />
                          </label>
                          <label>
                            Basis
                            <select
                              name="purchaseStatus"
                              defaultValue={formValues.purchaseStatus}
                            >
                              {["estimate", "actual", "commitment"].map(
                                (status) => (
                                  <option key={status} value={status}>
                                    {inventoryCostStatus(status)}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </fieldset>
                      </>
                    )}
                    {!delivered && (
                      <p>
                        Enter the seven acquisition buckets. Leave unknown
                        amounts blank.
                      </p>
                    )}
                    {COST_BUCKETS.filter((k) => k !== "carrying_cost").map(
                      (k) => (
                        <fieldset
                          key={k}
                          hidden={
                            delivered &&
                            COST_BUCKETS.slice(0, 7).includes(
                              k as (typeof COST_BUCKETS)[0],
                            )
                          }
                        >
                          <legend>{INVENTORY_COST_LABELS[k]}</legend>
                          <label>
                            Total for opening lot (blank = unknown)
                            <input
                              name={k}
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={
                                formValues[k] ?? c.components[k].amount ?? ""
                              }
                            />
                          </label>
                          <label>
                            Source / quote
                            <input
                              name={`${k}:source`}
                              defaultValue={
                                formValues[`${k}:source`] ??
                                c.components[k].source
                              }
                            />
                          </label>
                          <label>
                            Status
                            <select
                              name={`${k}:status`}
                              defaultValue={
                                formValues[`${k}:status`] ??
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
                                  {inventoryCostStatus(status)}
                                </option>
                              ))}
                            </select>
                          </label>
                        </fieldset>
                      ),
                    )}
                    <label
                      hidden={l.category != null && l.category !== "rail_tie"}
                    >
                      Creosote oil-linked quote/reference snapshot
                      <input
                        name="oil"
                        defaultValue={
                          formValues.oil ?? c.creosote_oil_reference ?? ""
                        }
                      />
                    </label>
                    <label>
                      Reuse existing reconciliation source
                      <select
                        name="exposureId"
                        defaultValue={formValues.exposureId}
                      >
                        <option value="">Create distinct source</option>
                        {f.sources.map((e) => (
                          <option value={e.id} key={e.id}>
                            {e.source_key}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Contract
                      <select
                        name="contractId"
                        defaultValue={formValues.contractId}
                      >
                        <option value="">
                          Choose contract for new spending
                        </option>
                        {f.contracts?.map((contract) => (
                          <option key={contract.id} value={contract.id}>
                            {contract.contract_key} · {contract.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {[
                      ["periodYear", "Contract period start year"],
                      ["currency", "Source currency (ISO 4217)"],
                      [
                        "annualRateOverride",
                        "Annual carrying override (fraction/year; blank uses organization default)",
                      ],
                    ]
                      .filter(
                        ([name]) =>
                          name !== "annualRateOverride" || f.canConfigurePolicy,
                      )
                      .map(([name, label]) => (
                        <label key={name}>
                          {label}
                          <input name={name} defaultValue={formValues[name]} />
                        </label>
                      ))}
                    <label>
                      Purchase reference (invoice / PO number)
                      <input
                        defaultValue={formValues.sourceKey}
                        name="sourceKey"
                      />
                    </label>
                    <label>
                      Source evidence
                      <input defaultValue={formValues.source} name="source" />
                    </label>
                    <label>
                      Funding treatment
                      <select name="funding" defaultValue={formValues.funding}>
                        <option value="unknown">Unknown — hold</option>
                        <option value="funded">Already funded</option>
                        <option value="committed">
                          Already committed in baseline
                        </option>
                        <option value="new">New contractual exposure</option>
                      </select>
                    </label>
                    <label>
                      New purchase / commitment amount
                      <input
                        defaultValue={formValues.incrementalAmount}
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
                        defaultValue={formValues.milestoneId}
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
                        defaultValue={formValues.changeOrderId}
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
              <div className={styles.tableScroll}>
                <table className={styles.costTable}>
                  <caption>
                    Material prices · totals for the original opening lot
                    {currency ? ` · ${currency}` : " · currency unconfirmed"}
                  </caption>
                  <thead>
                    <tr>
                      <th>Cost item</th>
                      <th>Lot amount</th>
                      <th>Per {inventoryUnitLabel(l.unit)}</th>
                      <th>Basis / source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c?.purchase_price && (
                      <tr>
                        <th scope="row">Delivered invoice / quote</th>
                        <td>
                          {inventoryMoney(c.purchase_price.amount, currency)}
                        </td>
                        <td>
                          {inventoryMoney(
                            inventoryPerTie(
                              c.purchase_price.amount,
                              l.opening_quantity,
                            ),
                            currency,
                          )}
                        </td>
                        <td>
                          {inventoryCostStatus(c.purchase_price.status)} ·{" "}
                          {c.purchase_price.source}
                        </td>
                      </tr>
                    )}
                    {COST_BUCKETS.filter(
                      (k) =>
                        k !== "carrying_cost" &&
                        (!c?.purchase_price ||
                          !COST_BUCKETS.slice(0, 7).includes(
                            k as (typeof COST_BUCKETS)[0],
                          )),
                    ).map((k) => (
                      <tr key={k}>
                        <th scope="row">{INVENTORY_COST_LABELS[k]}</th>
                        <td>
                          {inventoryMoney(c?.components[k].amount, currency)}
                        </td>
                        <td>
                          {inventoryMoney(
                            inventoryPerTie(
                              c?.components[k].amount,
                              l.opening_quantity,
                            ),
                            currency,
                          )}
                        </td>
                        <td>
                          <span className={styles.tag}>
                            {inventoryCostStatus(c?.components[k].status)}
                          </span>
                          <div>
                            {c?.components[k].source || "Source needed"}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p
                className={styles.subtle}
                hidden={l.category != null && l.category !== "rail_tie"}
              >
                Creosote oil-linked quote:{" "}
                {c?.creosote_oil_reference || "Source needed"} · cost revision{" "}
                {c?.version ?? "not recorded"}.
              </p>
            </details>
          </article>
        );
      })}
      <details>
        <summary>Organization rules &amp; contracts</summary>
        <ConfirmedRules
          finance={f}
          lots={s.lots}
          actors={s.actors}
          assignments={s.assignments}
          canManage={s.canManage}
          disabled={disabled}
          values={financialInput}
          capture={capture}
          act={act}
        />
      </details>
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
