"use client";
import {
  CONTRACT_RULE_EXPLANATION,
  annualReviewText,
  allowedInventoryRuleForms,
  inventoryRuleCommand,
  type InventoryCommand,
  type InventoryFinance,
  inventoryMoney,
  inventoryDate,
  inventoryMemberOptions,
  type InventorySnapshot,
  type InventoryLot,
} from "@railcommand/domain";
export function ConfirmedRules({
  finance: f,
  lots,
  actors,
  assignments,
  canManage,
  disabled,
  values,
  capture,
  act,
}: {
  finance: InventoryFinance;
  lots: InventoryLot[];
  actors: InventorySnapshot["actors"];
  assignments: InventorySnapshot["assignments"];
  canManage: boolean;
  disabled: boolean;
  values: Record<string, Record<string, string>>;
  capture: (key: string, form: HTMLFormElement) => void;
  act: (command: InventoryCommand) => void;
}) {
  return (
    <section aria-label="Confirmed contract rules">
      <h3>Contract approvals & organization rules</h3>
      <p>
        {f.policy
          ? `${f.policy.annual_rate * 100}% annual capital carrying · Supply Chain sign-off above ${inventoryMoney(f.policy.threshold_amount, f.policy.currency)} per contract year`
          : "Confirmed policy needed — release held"}
      </p>
      <details>
        <summary>How the contract rule works</summary>
        <p>{CONTRACT_RULE_EXPLANATION}</p>
        {f.contracts?.map((c) => (
          <p key={c.id}>
            <strong>
              {c.contract_key} · {c.name}
            </strong>
            <br />
            Contract anniversary: {inventoryDate(c.start_date)}
          </p>
        ))}
      </details>
      {f.annual?.map(({ lotId, evaluation: a }) => (
        <article key={lotId}>
          <h4>
            {lots.find((l) => l.id === lotId)?.material ?? "Material lot"} ·
            contract-year review
          </h4>
          <p>
            <strong>
              {inventoryMoney(a.forecast, a.currency)} approved commitments +
              request
            </strong>
          </p>
          <p>
            {a.state !== "complete" && a.state !== "already_funded"
              ? "Hold — reconcile the contract period and commitments first."
              : a.requiresSupplyChain
                ? a.eligibleSupplyChain
                  ? "Supply Chain sign-off required before release."
                  : "Hold — assign an eligible Supply Chain approver."
                : a.incremental === 0
                  ? "Already committed source. This request adds no new spending; lead and PM approval still apply."
                  : "Within the configured threshold. Lead and PM approval still apply."}
          </p>
          {a.likelySplit && (
            <p role="note">
              <strong>Likely split purchases — review linked sources.</strong>{" "}
              Splitting to avoid approval is prohibited. A flag calls for
              review, not a finding of fraud.
            </p>
          )}
          <p>
            Contract year: {inventoryDate(a.periodStart)} →{" "}
            {inventoryDate(a.periodEndExclusive)} (end excluded).
          </p>
          <details>
            <summary>Commitment breakdown & source evidence</summary>
            <p>
              External opening commitments:{" "}
              {inventoryMoney(a.baseline?.amount, a.currency)}
              <br />
              Tracked approved commitments:{" "}
              {inventoryMoney(a.committed, a.currency)}
              <br />
              New amount in this request:{" "}
              {inventoryMoney(a.incremental, a.currency)}
            </p>
            <p>{annualReviewText(a)}</p>
            {a.proposedSource && (
              <p>
                Proposed source: {a.proposedSource.sourceKey} ·{" "}
                {inventoryMoney(a.proposedSource.amount, a.currency)}
                <br />
                {a.proposedSource.evidence}
                <br />
                Source {a.proposedSource.sourceId} · project{" "}
                {a.proposedSource.projectId}
              </p>
            )}
            {a.sources?.map((x) => (
              <p key={x.sourceId}>
                <strong>
                  {x.sourceKey} · {inventoryMoney(x.amount, a.currency)}
                </strong>
                <br />
                {x.evidence}
                <br />
                Source {x.sourceId} · project {x.projectId} · request{" "}
                {x.requestId}
              </p>
            ))}
            <p>
              Policy revision {a.policy?.version ?? "missing"} · baseline
              revision {a.baseline?.version ?? "missing"} · lot {lotId}
            </p>
          </details>
        </article>
      ))}
      {allowedInventoryRuleForms(f, canManage).map((form) => (
        <details key={form.action}>
          <summary>{form.title}</summary>
          <form
            onChange={(e) => capture(form.action, e.currentTarget)}
            onSubmit={(e) => {
              e.preventDefault();
              act(
                inventoryRuleCommand(
                  form.action,
                  Object.fromEntries(
                    Array.from(new FormData(e.currentTarget), ([k, v]) => [
                      k,
                      String(v),
                    ]),
                  ),
                ),
              );
            }}
          >
            {form.fields.map(([key, label]) => (
              <label key={key}>
                {label}
                {["supplyChainId", "memberId"].includes(key) ? (
                  <select
                    required
                    name={key}
                    disabled={disabled}
                    defaultValue={
                      values[form.action]?.[key] ??
                      (form.values as Record<string, string>)[key] ??
                      ""
                    }
                  >
                    <option value="">Choose an invited project member</option>
                    {inventoryMemberOptions(
                      actors,
                      key === "supplyChainId" ? "supplyChain" : "costViewer",
                      key === "supplyChainId"
                        ? [assignments?.lead_id, assignments?.pm_id]
                        : [],
                    ).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    disabled={disabled}
                    required
                    name={key}
                    defaultValue={
                      values[form.action]?.[key] ??
                      (form.values as Record<string, string>)[key] ??
                      ""
                    }
                  />
                )}
              </label>
            ))}
            <p>
              {form.action === "cost_access"
                ? "Access changes apply on the next server refresh. Accepted history stays unchanged."
                : "Keep the reviewed version until you explicitly review current history. Changes invalidate pending approvals; requests must be rebased and approved again."}
            </p>
            <button disabled={disabled}>
              Save {form.title.toLowerCase()} online
            </button>
          </form>
        </details>
      ))}
      <details>
        <summary>Policy, reconciliation & approval history</summary>
        {f.costAccess?.map((a) => (
          <p key={`${a.member_id}:${a.version}`}>
            Cost viewing · member {a.member_id} ·{" "}
            {a.can_view ? "allowed" : "removed"} · version {a.version} ·{" "}
            {a.source} · changed {a.actor_id} · {a.created_at}
          </p>
        ))}
        {f.policyHistory?.map((p) => (
          <p key={p.version}>
            Policy {p.version} · {p.annual_rate * 100}% annually · {p.currency}{" "}
            {p.threshold_amount} · {p.source} ·{" "}
            {p.created_by ?? "confirmed initial default"} · {p.created_at}
          </p>
        ))}
        {f.baselines?.map((b) => (
          <p key={b.id}>
            Contract {b.contract_id} · period {b.period_year} · {b.currency}{" "}
            {b.amount} · baseline {b.version} · {b.evidence} · verified{" "}
            {b.verified_by} · {b.verified_at}
          </p>
        ))}
        {f.approvalEvidence?.map((e) => (
          <p key={e.id}>
            {e.action} · request {e.request_id} · revision {e.revision} · actor{" "}
            {e.actor_id} · {e.created_at} · policy {e.snapshot.policy?.version}{" "}
            · baseline {e.snapshot.baseline?.version ?? "not applicable"} ·
            annual total {e.snapshot.forecast ?? "not applicable"} · incremental{" "}
            {e.snapshot.incremental ?? "unknown"}
          </p>
        ))}
      </details>
    </section>
  );
}
