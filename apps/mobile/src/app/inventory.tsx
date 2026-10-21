import { useEffect, useMemo, useReducer, useState } from "react";
import { AppState, Text, TextInput, View, StyleSheet } from "react-native";
import * as Crypto from "expo-crypto";
import {
  InventoryController,
  COST_BUCKETS,
  budgetEvaluation,
  materialCostSummary,
  basicHoldingExample,
  operationalCarrying,
  type InventoryCommand,
  type InventorySnapshot,
  type InventoryFinance,
} from "@railcommand/domain";
import {
  Screen,
  Card,
  PageHeading,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusBanner,
  uiStyles,
} from "@/components/ui";
import { useAuth } from "@/providers/auth-provider";
import { useMobileData } from "@/providers/mobile-data-provider";
import { mobileApiForUser } from "@/lib/api";
import { inventoryStore } from "@/lib/offline-store";
import { InventoryConfirmedRules } from "@/components/inventory-confirmed-rules";
import { colors } from "@/theme";
export default function InventoryScreen() {
  const { session, sessionRevision, isSessionCurrent } = useAuth();
  const { activeProjectId, online } = useMobileData();
  if (!session || !activeProjectId)
    return (
      <Screen>
        <PageHeading
          eyebrow="FIELD / MATERIAL CONTROL"
          title="Inventory"
          detail="Sign in and select an assigned project."
        />
      </Screen>
    );
  return (
    <InventoryWorkspace
      key={`${sessionRevision}:${activeProjectId}`}
      userId={session.user.id}
      projectId={activeProjectId}
      online={online}
      current={() => isSessionCurrent(session.user.id, sessionRevision)}
    />
  );
}
function InventoryWorkspace({
  userId,
  projectId,
  online,
  current,
}: {
  userId: string;
  projectId: string;
  online: boolean;
  current: () => boolean;
}) {
  const [, render] = useReducer((n) => n + 1, 0);
  const [ruleInput, setRuleInput] = useState<Record<string,Record<string,string>>>({});
  const [financialEditor, setFinancialEditor] = useState<{
    editLot: string | null;
    proposal: boolean;
    values: Record<string, string>;
  }>({ editLot: null, proposal: false, values: {} });
  const controller = useMemo(() => {
    const api = mobileApiForUser(userId, current);
    return new InventoryController({
      userId,
      projectId,
      current,
      uuid: Crypto.randomUUID,
      online: () => network.current,
      read: () => api.readInventory(projectId),
      execute: (id, c) => api.executeInventory(projectId, id, c),
      receipt: async (id) =>
        (await api.inventoryReceipt(projectId, id)).receipt,
      readDraft: () => inventoryStore.readDraft(userId, projectId, current),
      saveDraft: (d) => inventoryStore.saveDraft(d, current),
      deleteDraft: () => inventoryStore.deleteDraft(userId, projectId, current),
      cache: (s) => inventoryStore.cache(userId, s, current),
      readCache: () => inventoryStore.readCache(userId, projectId, current),
    });
  }, [userId, projectId]);
  const network = useMemo(() => ({ current: online }), []);
  network.current = online;
  useEffect(() => {
    const unsub = controller.subscribe(render);
    void controller.open();
    const app = AppState.addEventListener("change", (s) => {
      if (s === "active") void controller.refresh();
    });
    return () => {
      unsub();
      controller.dispose();
      app.remove();
    };
  }, [controller]);
  useEffect(() => {
    void controller.refresh();
  }, [controller, online]);
  const s = controller.snapshot,
    d = controller.draft?.command,
    locked = controller.draft?.phase === "unknown";
  const disabled = !online || controller.busy || locked;
  const actorName = (id: string | null | undefined) =>
    s?.actors?.find((a) => a.id === id)?.name ?? id ?? "waiting";
  const act = (c: InventoryCommand) => void controller.act(c);
  return (
    <Screen>
      <PageHeading
        eyebrow="FIELD / MATERIAL CONTROL"
        title="Inventory"
        detail="Request → inventory lead → distinct PM → required authorization → release"
      />
      <StatusBanner
        tone={online ? "neutral" : "warning"}
        title={online ? "Server review required" : "Offline · device drafts"}
        detail={controller.message}
      />
      <SecondaryButton
        title="Refresh inventory"
        disabled={!online || controller.busy}
        onPress={() => void controller.refresh()}
      />
      {s && (
        <Text style={uiStyles.muted}>
          As of {new Date(s.asOf).toLocaleString()}.{" "}
          {online
            ? "Refresh before decisions."
            : "Cached quantities are read-only."}
        </Text>
      )}
      {locked && (
        <Card>
          <SectionTitle>Unconfirmed operation</SectionTitle>
          <Text style={styles.body}>
            {controller.draft?.pending?.operationId}
          </Text>
          <Text style={uiStyles.muted}>
            Field input stays saved. Private decision input stays only in the
            current session. Resolve online to return an accepted receipt or durably
            close a never-applied operation without replaying private input.
          </Text>
          <SecondaryButton
            title="Check receipt"
            disabled={!online || controller.busy}
            onPress={() => void controller.recover()}
          />
          <SecondaryButton
            title="Resolve original operation online"
            disabled={!online || controller.busy}
            onPress={() => void controller.settle()}
          />
          <SecondaryButton
            title="Retry saved operation"
            disabled={!online || controller.busy || !!controller.draft?.pending?.command.receiptOnly}
            onPress={() => void controller.act()}
          />
        </Card>
      )}
      {s && (
        <>
          <Card>
            <SectionTitle>Stock by lot</SectionTitle>
            {!s.lots.length && (
              <Text style={uiStyles.muted}>
                No accepted opening stock. An authorized manager must record the
                acceptance source.
              </Text>
            )}
            {s.lots.map((l) => (
              <View key={l.id} style={styles.record}>
                <Text style={styles.heading}>
                  {l.material} · {l.yard}
                </Text>
                <Text style={styles.quantity}>{l.balance} ties</Text>
                <Text style={styles.body}>
                  {l.readiness} · inspection{" "}
                  {l.inspection_accepted ? "accepted" : "pending"}
                </Text>
                <Text style={uiStyles.muted}>
                  {l.received_at ?? "Receipt date unknown"} ·{" "}
                  {l.condition.replaceAll("_", " ")} · {l.age_source}
                </Text>
                <Text style={uiStyles.muted}>
                  Drying: 4–10 calendar months ·{" "}
                  {l.drying_started_at ?? "start unknown"} →{" "}
                  {l.drying_completed_at ?? "completion unknown"}
                </Text>
                {l.latestCount && (
                  <Text style={styles.body}>
                    Count {l.latestCount.counted} vs ledger {l.balance} ·{" "}
                    {l.latestCount.reason} ·{" "}
                    {l.latestCount.lot_version === l.version
                      ? "current baseline"
                      : "recount required"}
                  </Text>
                )}
                <SecondaryButton
                  title={`Request from ${l.yard}`}
                  disabled={locked}
                  onPress={() =>
                    void controller.edit({ lotId: l.id, lotVersion: l.version })
                  }
                />
                {(s.canManage || s.assignments?.lead_id === userId) && (
                  <Observation
                    disabled={disabled}
                    onSave={(quantity, reason) =>
                      act({
                        action: "count",
                        lotId: l.id,
                        lotVersion: l.version,
                        quantity,
                        reason,
                      })
                    }
                  />
                )}
              </View>
            ))}
          </Card>
          <Card>
            <SectionTitle>Request stock</SectionTitle>
            <Text style={uiStyles.muted}>
              Selected lot:{" "}
              {s.lots.find((l) => l.id === d?.lotId)?.yard ??
                "Choose a lot above"}
              . Input saves on this device. Submission and approval require a
              connection.
            </Text>
            <Field
              label="Quantity of ties"
              value={String(d?.quantity ?? "")}
              disabled={locked}
              numeric
              onChange={(v) =>
                void controller.edit({ quantity: v === "" ? "" : Number(v) })
              }
            />
            <Field
              label="Work location"
              value={String(d?.workLocation ?? "")}
              disabled={locked}
              onChange={(v) => void controller.edit({ workLocation: v })}
            />
            <Field
              label="Reason"
              value={String(d?.reason ?? "")}
              disabled={locked}
              onChange={(v) => void controller.edit({ reason: v })}
            />
            <PrimaryButton
              title="Submit request online"
              disabled={disabled || !d?.lotId}
              onPress={() => void controller.act()}
            />
          </Card>
          <Card>
            <SectionTitle>Requests & assigned approvals</SectionTitle>
            <Text style={uiStyles.muted}>
              Lead {actorName(s.assignments?.lead_id)} · PM{" "}
              {actorName(s.assignments?.pm_id)}
            </Text>
            {!s.requests.length && (
              <Text style={uiStyles.muted}>No requests yet.</Text>
            )}
            {s.requests.map((r) => {
              const lot = s.lots.find((l) => l.id === r.lot_id),
                base = {
                  requestId: r.id,
                  expectedVersion: r.version,
                  lotVersion: lot?.version,
                };
              return (
                <View key={r.id} style={styles.record}>
                  <Text style={styles.heading}>
                    #{r.number} · {r.quantity} ties → {r.work_location}
                  </Text>
                  <Text style={styles.body}>
                    {r.state === "awaiting_supply_chain" ? (s.finance ? "Waiting for Supply Chain authorization" : "Waiting for required authorization") : r.state} · revision {r.revision} · version {r.version}
                  </Text>
                  <Text style={styles.body}>{r.reason}</Text>
                  <Text style={uiStyles.muted}>
                    Requester {actorName(r.requester_id)} · verifier{" "}
                    {actorName(r.verifier_id)} · PM {actorName(r.approver_id)}
                  </Text>
                  {r.state === "submitted" &&
                    s.assignments?.lead_id === userId &&
                    r.requester_id !== userId && (
                      <PrimaryButton
                        title="Verify quantity & location"
                        disabled={disabled}
                        onPress={() => act({ action: "verify", ...base })}
                      />
                    )}
                  {r.state === "verified" &&
                    s.assignments?.pm_id === userId &&
                    r.requester_id !== userId &&
                    r.verifier_id !== userId && (
                      <PrimaryButton
                        title="Authorize & post release"
                        disabled={disabled}
                        onPress={() => act({ action: "authorize", ...base })}
                      />
                    )}
                  {r.state === "awaiting_supply_chain" && s.finance?.supplyChainAssignment?.actor_id === userId && s.canManage && s.finance.annual?.find(a => a.lotId === r.lot_id)?.evaluation.eligibleSupplyChain && ![r.requester_id,r.verifier_id,r.approver_id].includes(userId) && <PrimaryButton title="Supply Chain authorize & post release" disabled={disabled} onPress={() => act({action:"supply_chain",...base})} />}
                  {["submitted", "verified"].includes(r.state) &&
                    [s.assignments?.lead_id, s.assignments?.pm_id].includes(
                      userId,
                    ) && (
                      <Reject
                        disabled={disabled}
                        onSave={(reason) =>
                          act({ action: "reject", ...base, reason })
                        }
                      />
                    )}
                  {r.requester_id === userId &&
                    !["posted", "cancelled"].includes(r.state) && (
                      <>
                        <SecondaryButton
                          title="Rebase for fresh two-step review"
                          disabled={disabled}
                          onPress={() =>
                            act({ action: "revise", ...base, reason: r.reason })
                          }
                        />
                        <SecondaryButton
                          title="Cancel request"
                          disabled={disabled}
                          onPress={() =>
                            act({
                              action: "cancel",
                              ...base,
                              reason: "Requester cancelled",
                            })
                          }
                        />
                      </>
                    )}
                </View>
              );
            })}
          </Card>
          <Card>
            <SectionTitle>Evidence & conditions</SectionTitle>
            {s.revisions?.map((v) => (
              <Text key={`${v.request_id}:${v.revision}`} style={styles.body}>
                Request {v.request_id} · revision {v.revision}:{" "}
                {v.payload.quantity} ties → {v.payload.workLocation} ·{" "}
                {v.payload.reason} · actor {actorName(v.actor_id)} ·{" "}
                {v.created_at}. Required lead {actorName(v.payload.leadId)}, PM{" "}
                {actorName(v.payload.pmId)}; policy revision{" "}
                {v.payload.policyVersion}.
              </Text>
            ))}
            {s.denials.map((e) => (
              <Text key={e.id} style={styles.body}>
                {e.code.replaceAll("_", " ")} · {actorName(e.actor_id)} ·{" "}
                {e.created_at}
              </Text>
            ))}
            {s.events.map((e) => (
              <Text key={e.id} style={styles.body}>
                {e.action} · {e.previous_state ?? "—"} →{" "}
                {e.next_state ?? "recorded"} · revision {e.revision ?? "—"} ·
                actor {actorName(e.actor_id)} · {e.created_at} {e.reason ?? ""}
              </Text>
            ))}
          </Card>
          {s.finance && online && <InventoryConfirmedRules finance={s.finance} canManage={s.canManage} disabled={disabled} values={ruleInput} setValues={setRuleInput} act={act} />}
          {s.finance && online && (
            <Finance
              editor={financialEditor}
              setEditor={setFinancialEditor}
              snapshot={s}
              finance={s.finance}
              disabled={disabled}
              act={act}
            />
          )}
          {s.canManage && <Setup snapshot={s} disabled={disabled} act={act} />}
        </>
      )}
    </Screen>
  );
}
function Field({
  label,
  value,
  onChange,
  numeric,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 6, marginVertical: 6 }}>
      <Text style={styles.body}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        editable={!disabled}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        style={styles.input}
      />
    </View>
  );
}
function Observation({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (quantity: number, reason: string) => void;
}) {
  const [q, setQ] = useState(""),
    [r, setR] = useState("");
  return (
    <View>
      <Field label="Observed count" value={q} onChange={setQ} numeric />
      <Field
        label="Recount / verification evidence"
        value={r}
        onChange={setR}
      />
      <SecondaryButton
        title="Record observation"
        disabled={disabled || !r || q === ""}
        onPress={() => onSave(Number(q), r)}
      />
    </View>
  );
}
function Reject({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (reason: string) => void;
}) {
  const [r, setR] = useState("");
  return (
    <View>
      <Field label="Rejection reason" value={r} onChange={setR} />
      <SecondaryButton
        title="Reject with reason"
        disabled={disabled || !r}
        onPress={() => onSave(r)}
      />
    </View>
  );
}
function Finance({
  editor,
  setEditor,
  snapshot: s,
  finance: f,
  disabled,
  act,
}: {
  editor: {
    editLot: string | null;
    proposal: boolean;
    values: Record<string, string>;
  };
  setEditor: import("react").Dispatch<
    import("react").SetStateAction<{
      editLot: string | null;
      proposal: boolean;
      values: Record<string, string>;
    }>
  >;
  snapshot: InventorySnapshot;
  finance: InventoryFinance;
  disabled: boolean;
  act: (c: InventoryCommand) => void;
}) {
  const { editLot, proposal, values } = editor;
  const [example, setExample] = useState<ReturnType<
    typeof basicHoldingExample
  > | null>(null);
  const setEditLot = (editLot: string | null) =>
    setEditor((old) => ({ ...old, editLot }));
  const setProposal = (proposal: boolean) =>
    setEditor((old) => ({ ...old, proposal }));
  const setValues = (
    update:
      | Record<string, string>
      | ((old: Record<string, string>) => Record<string, string>),
  ) =>
    setEditor((old) => ({
      ...old,
      values: typeof update === "function" ? update(old.values) : update,
    }));
  const field = (key: string, label: string, numeric = false) => (
    <Field
      key={key}
      label={label}
      numeric={numeric}
      value={values[key] ?? ""}
      onChange={(v) => setValues((x) => ({ ...x, [key]: v }))}
    />
  );
  return (
    <Card>
      <SectionTitle>Material cost & budget review</SectionTitle>
      <Text style={styles.body}>
        Remaining manual cost components may be incomplete. Confirmed organization defaults and contract-year authorization apply.
      </Text>
      <Text style={styles.body}>
        Base {f.budget.base} · adjusted {f.budget.adjusted} · spent{" "}
        {f.budget.spent} · posted new exposure {f.budget.postedNewExposure}
      </Text>
      {s.lots.map((l) => {
        const c = f.costs.find((c) => c.lot_id === l.id),
          e = budgetEvaluation(
            f.budget,
            f.sources.find((x) => x.id === c?.exposure_id),
            false,
          );
        return (
          <View key={l.id} style={styles.record}>
            <Text style={styles.body}>
              Landed acquisition {materialCostSummary(c).landed ?? "incomplete"}
              ; installed excluding carrying{" "}
              {materialCostSummary(c).installedExcludingCarrying ??
                "incomplete"}
              . Total remains incomplete until all components are sourced. Annual capital component (ACT/365; remaining quantity at opening acquisition value): {operationalCarrying(l,c,f.policy,s.asOf).annual?.toFixed(2) ?? "incomplete: valuation or receipt age unknown"}. Storage is separate and never counted twice.
            </Text>
            <Text style={styles.heading}>
              {l.material} · {l.yard} · cost revision {c?.version ?? "missing"}
            </Text>
            <Text style={styles.body}>
              {e.state === "unknown"
                ? "Unknown funding — posting held"
                : e.state === "hold"
                  ? `Budget hold ${e.shortfall}`
                  : `Headroom ${e.headroom}`}
            </Text>
            <Text style={styles.body}>
              Creosote oil-linked quote:{" "}
              {c?.creosote_oil_reference ?? "Awaiting source"}
            </Text>
            {COST_BUCKETS.map((k) => (
              <Text key={k} style={styles.body}>
                {k.replaceAll("_", " ")}:{" "}
                {c?.components[k].amount ?? "Awaiting Wendy"} ·{" "}
                {c?.components[k].status ?? "incomplete"} ·{" "}
                {c?.components[k].source || "Source missing"}
              </Text>
            ))}
            {s.canManage && c && (
              <>
                <SecondaryButton
                  title="Record manual cost/source revision"
                  disabled={disabled}
                  onPress={() => {
                    setEditLot(l.id);
                    setValues({ costVersion: String(c.version) });
                  }}
                />
                {editLot === l.id && (
                  <View>
                    <Text style={styles.body}>
                      Entered cost baseline {values.costVersion ?? c.version};
                      current {c.version}. Review changed values before
                      rebasing.
                    </Text>
                    <SecondaryButton
                      title="Review current cost revision and rebase input"
                      disabled={disabled}
                      onPress={() =>
                        setValues((old) => ({
                          ...old,
                          costVersion: String(c.version),
                        }))
                      }
                    />
                    {COST_BUCKETS.filter((k) => k !== "carrying_cost").map(
                      (k) => (
                        <View key={k}>
                          {field(
                            k,
                            `${k.replaceAll("_", " ")} amount (blank = unknown)`,
                            true,
                          )}
                          {field(
                            `${k}:source`,
                            `${k.replaceAll("_", " ")} source`,
                          )}
                          {field(
                            `${k}:status`,
                            `${k.replaceAll("_", " ")} status: awaiting_wendy, estimate, actual or commitment`,
                          )}
                        </View>
                      ),
                    )}
                    {field("oil", "Creosote oil-linked quote/reference")}
                    {field("contractId", "Shared contract UUID (required for new spending)")}
                    {field("periodYear", "Contract period start year")}
                    {field("currency", "Source currency (ISO 4217)")}
                    {field("annualRateOverride", "Annual carrying override (fraction/year; blank uses organization default)")}
                    {field("sourceKey", "Distinct source identity")}
                    {field("source", "Source evidence")}
                    {field(
                      "exposureId",
                      "Existing source UUID (optional; reuse once)",
                    )}
                    {field(
                      "funding",
                      "Funding: funded, committed, new or unknown",
                    )}
                    {field(
                      "incrementalAmount",
                      "New contractual exposure amount",
                      true,
                    )}
                    {field(
                      "milestoneId",
                      "Optional same-project milestone UUID",
                    )}
                    {field(
                      "changeOrderId",
                      "Optional existing same-project CO UUID",
                    )}
                    <PrimaryButton
                      title="Save revision; fresh approvals required"
                      disabled={disabled}
                      onPress={() =>
                        act({
                          action: "cost",
                          lotId: l.id,
                          lotVersion: l.version,
                          costVersion: Number(values.costVersion ?? c.version),
                          components: Object.fromEntries(
                            COST_BUCKETS.map((k) => [
                              k,
                              {
                                amount:
                                  k === "carrying_cost" || !values[k]
                                    ? null
                                    : Number(values[k]),
                                status:
                                  values[`${k}:status`] ?? "awaiting_wendy",
                                source: values[`${k}:source`] ?? "",
                              },
                            ]),
                          ),
                          creosoteOilReference: values.oil ?? "",
                          sourceKey: values.sourceKey,
                          source: values.source,
                          funding: values.funding ?? "unknown",
                          exposureId: values.exposureId || null,
                          contractId: values.contractId ?? "",
                          periodYear: values.periodYear ?? "",
                          currency: values.currency ?? "",
                          annualRateOverride: values.annualRateOverride ?? "",
                          incrementalAmount: values.incrementalAmount ?? "",
                          milestoneId: values.milestoneId ?? "",
                          changeOrderId: values.changeOrderId ?? "",
                        })
                      }
                    />
                  </View>
                )}
              </>
            )}
          </View>
        );
      })}
      <Text style={styles.body}>
        Existing sources:{" "}
        {f.sources.map((e) => `${e.source_key}: ${e.id}`).join(" · ") || "none"}
      </Text>
      <Text style={styles.body}>
        Milestones:{" "}
        {f.milestones.map((e) => `${e.name}: ${e.id}`).join(" · ") || "none"}
      </Text>
      <Text style={styles.body}>
        Existing change orders:{" "}
        {f.budget.changeOrders
          .map(
            (e) =>
              `${e.number}: ${e.id} (${e.status}, ${e.signed ? "signed" : "unsigned"})`,
          )
          .join(" · ") || "none"}
      </Text>
      {f.requestSnapshots?.map((v) => (
        <Text key={`${v.request_id}:${v.revision}`} style={styles.body}>
          Pinned request {v.request_id} · revision {v.revision}: base{" "}
          {v.budget_snapshot.base}; adjusted {v.budget_snapshot.adjusted}; spent{" "}
          {v.budget_snapshot.spent}; cost source{" "}
          {v.cost_revision_id ?? "unconfirmed"}; reconciliation{" "}
          {v.exposure_id ?? "unknown"}.
        </Text>
      ))}
      <Text style={styles.body}>
        Isolated example inputs: 20000 + 10000 + 8000 + 6000 + 4000 + 12000 +
        8000 upstream; storage 30/day, 8% annual, 60 days,
        installation/inspection/disposal 42000. Never written to
        stock/configuration/budget.
      </Text>
      <SecondaryButton
        title="Calculate isolated example"
        disabled={disabled}
        onPress={() =>
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
      />
      {example && (
        <Text style={styles.body}>
          Acquisition {example.landed}; holding {example.holding}; acquisition
          plus holding {example.landedAndHolding}; installed basic{" "}
          {example.installedBasic}.
        </Text>
      )}
      {s.canManage && (
        <>
          <SecondaryButton
            title="Unconfirmed configuration proposal"
            disabled={disabled}
            onPress={() => {
              setProposal(!proposal);
              setValues({
                configurationVersion: String(f.configuration?.version ?? 0),
              });
            }}
          />
          {proposal && (
            <View>
              <Text style={uiStyles.muted}>
                Proposals stay unconfirmed and are excluded from totals and
                approval routing.
              </Text>
              <Text style={styles.body}>
                Entered proposal baseline{" "}
                {values.configurationVersion ?? f.configuration?.version ?? 0};
                current {f.configuration?.version ?? 0}. Review before rebasing.
              </Text>
              <SecondaryButton
                title="Review current configuration and rebase proposal"
                disabled={disabled}
                onPress={() =>
                  setValues((old) => ({
                    ...old,
                    configurationVersion: String(f.configuration?.version ?? 0),
                  }))
                }
              />
              {field("annualRate", "Proposed annual carrying rate", true)}
              {field("storageDaily", "Proposed daily storage amount", true)}
              {field("thresholdAmount", "Proposed threshold amount", true)}
              {field("currency", "Proposed currency")}
              {field("source", "Proposal source")}
              <PrimaryButton
                title="Save unconfirmed proposal"
                disabled={disabled}
                onPress={() =>
                  act({
                    action: "configuration",
                    expectedVersion: Number(
                      values.configurationVersion ??
                        f.configuration?.version ??
                        0,
                    ),
                    ...values,
                  })
                }
              />
            </View>
          )}
        </>
      )}
    </Card>
  );
}
function Setup({
  snapshot: s,
  disabled,
  act,
}: {
  snapshot: InventorySnapshot;
  disabled: boolean;
  act: (c: InventoryCommand) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const f = (key: string, label: string, n = false) => (
    <Field
      key={key}
      label={label}
      value={v[key] ?? ""}
      onChange={(x) => setV((y) => ({ ...y, [key]: x }))}
      numeric={n}
    />
  );
  return (
    <Card>
      <SectionTitle>Pilot setup</SectionTitle>
      <Text style={uiStyles.muted}>
        Use accepted source records. Synthetic local checks do not authorize
        live pilot setup.
      </Text>
      {f("leadId", "Inventory lead profile UUID")}
      {f("pmId", "Distinct PM profile UUID")}
      <SecondaryButton
        title="Record assignments"
        disabled={disabled}
        onPress={() =>
          act({
            action: "assign",
            leadId: v.leadId,
            pmId: v.pmId,
            expectedVersion: s.assignments?.version ?? 0,
          })
        }
      />
      {f("materialCode", "Material code")}
      {f("material", "Material name")}
      {f("yard", "Yard")}
      {f("quantity", "Accepted quantity", true)}
      {f("source", "Acceptance source")}
      {f("receivedAt", "Receipt date YYYY-MM-DD (optional)")}
      {f("dryingStartedAt", "Supplier drying start YYYY-MM-DD (optional)")}
      {f(
        "dryingCompletedAt",
        "Supplier drying completion YYYY-MM-DD (optional)",
      )}
      {f("inspection", "Type ACCEPTED after inspection acceptance")}
      <SecondaryButton
        title="Accept opening lot"
        disabled={disabled || v.inspection !== "ACCEPTED"}
        onPress={() =>
          act({
            action: "opening",
            ...v,
            quantity: Number(v.quantity),
            inspectionAccepted: true,
            readiness: "ready",
          })
        }
      />
    </Card>
  );
}
const styles = StyleSheet.create({
  body: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  record: {
    gap: 8,
    marginVertical: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: colors.controlLine,
  },
  heading: { fontSize: 17, fontWeight: "600", color: colors.ink },
  quantity: { fontSize: 28, fontWeight: "700", color: colors.ink },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.controlLine,
    borderRadius: 8,
    padding: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
});
