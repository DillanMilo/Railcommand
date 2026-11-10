import { useEffect, useMemo, useReducer, useState, useRef } from "react";
import {
  AppState,
  Text,
  TextInput,
  ScrollView,
  View,
  StyleSheet,
} from "react-native";
import * as Crypto from "expo-crypto";
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
import { InventoryCsvExportButton } from "@/components/inventory-csv-export-button";
import { InventorySetup } from "@/components/inventory-setup";
import { InventoryField as Field } from "@/components/inventory-field";
import { InventoryChoice } from "@/components/inventory-choice";
import { InventoryHistory } from "@/components/inventory-history";
import { InventoryDisclosure } from "@/components/inventory-disclosure";
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
          title="Inventory Beta"
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
  const scrollRef = useRef<ScrollView>(null);
  const [section, setSection] = useState<"stock" | "requests" | "costs">(
    "stock",
  );
  const [stockSearch, setStockSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [setupView, setSetupView] = useState<
    "stock" | "catalogue" | "approvers" | null
  >(null);
  const [ruleInput, setRuleInput] = useState<
    Record<string, Record<string, string>>
  >({});
  const [financialEditor, setFinancialEditor] = useState<{
    editLot: string | null;
    proposal: boolean;
    values: Record<string, Record<string, string>>;
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
  const shownSection =
    section === "costs" && (!s?.finance || !online) ? "stock" : section;
  const navigate = (next: typeof section) => {
    setSection(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };
  const setupVisible = !!setupView && !!(s?.canReceive || s?.canManage);
  const act = (c: InventoryCommand) => void controller.act(c);
  return (
    <Screen scrollRef={scrollRef}>
      {(s?.canReceive || s?.canManage) && (
        <InventorySetup
          snapshot={s}
          view={setupView}
          disabled={disabled}
          act={act}
          notice={controller.message}
          onClose={() => {
            setSetupView(null);
            scrollRef.current?.scrollTo({ y: 0, animated: false });
          }}
          acceptedMaterialId={
            controller.lastConfirmed?.action === "catalogue_add"
              ? controller.lastConfirmed.result.materialId
              : undefined
          }
          acceptedLotId={
            controller.lastConfirmed?.action === "opening"
              ? controller.lastConfirmed.result.lotId
              : undefined
          }
        />
      )}
      <InventoryPanel visible={!setupVisible}>
        <PageHeading
          eyebrow="FIELD / MATERIAL CONTROL"
          title="Inventory Beta"
          detail="Stock, requests and approvals"
        />
        <SecondaryButton
          title="Refresh inventory"
          disabled={!online || controller.busy}
          onPress={() => void controller.refresh()}
        />
        <InventoryChoice
          disabled={false}
          label="Inventory section"
          value={shownSection}
          options={[
            { value: "stock", label: "Stock" },
            { value: "requests", label: "Requests & approvals" },
            ...(s?.finance && online
              ? [{ value: "costs", label: "Material costs" }]
              : []),
          ]}
          onChange={(value) => navigate(value as typeof section)}
        />
        {!!d?.lotId && shownSection !== "requests" && (
          <SecondaryButton
            title="Resume saved request"
            onPress={() => navigate("requests")}
          />
        )}
        {(s?.canReceive || s?.canManage) && (
          <View style={{ gap: 8 }}>
            <SecondaryButton
              title="Receive stock"
              disabled={disabled}
              onPress={() => {
                navigate("stock");
                setSetupView("stock");
              }}
            />
            {s.canManage && (
              <InventoryDisclosure title="Manage inventory">
                <SecondaryButton
                  title="Approved catalogue"
                  onPress={() => {
                    navigate("stock");
                    setSetupView("catalogue");
                  }}
                />
                <SecondaryButton
                  title="Choose approvers"
                  onPress={() => {
                    navigate("requests");
                    setSetupView("approvers");
                  }}
                />
              </InventoryDisclosure>
            )}
          </View>
        )}
      </InventoryPanel>
      {!setupVisible && (
        <>
          <StatusBanner
            tone={online ? "neutral" : "warning"}
            title={
              online ? "Server review required" : "Offline · device drafts"
            }
            detail={controller.message}
          />
          {s && (
            <Text style={uiStyles.muted}>
              As of {new Date(s.asOf).toLocaleString()}.{" "}
              {online
                ? "Refresh before decisions."
                : "Cached quantities are read-only."}
            </Text>
          )}
        </>
      )}
      {locked && (
        <Card>
          <SectionTitle>Unconfirmed operation</SectionTitle>
          <Text style={styles.body}>
            {controller.draft?.pending?.operationId}
          </Text>
          <Text style={uiStyles.muted}>
            Field input stays saved. Private decision input stays only in the
            current session. Resolve online to return an accepted receipt or
            durably close a never-applied operation without replaying private
            input.
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
            disabled={
              !online ||
              controller.busy ||
              !!controller.draft?.pending?.command.receiptOnly
            }
            onPress={() => void controller.act()}
          />
        </Card>
      )}
      <InventoryPanel visible={!setupVisible}>
        {s && (
          <>
            <InventoryPanel visible={shownSection === "stock"}>
              <Card>
                <SectionTitle>Stock by lot</SectionTitle>
                <InventorySearch
                  label="Search stock by material or yard"
                  value={stockSearch}
                  onChange={setStockSearch}
                />
                {!!s.lots.length &&
                  !s.lots.some((l) =>
                    inventoryMatchesSearch(
                      stockSearch,
                      l.material_code,
                      l.material,
                      l.yard,
                      inventoryUnitLabel(l.unit),
                    ),
                  ) && <Text>No stock matches your search.</Text>}
                {!s.lots.length && (
                  <Text style={uiStyles.muted}>
                    No accepted opening stock. An authorized manager must record
                    the acceptance source.
                  </Text>
                )}
                {s.lots.map((l) => (
                  <InventoryPanel
                    key={l.id}
                    visible={inventoryMatchesSearch(
                      stockSearch,
                      l.material,
                      l.yard,
                    )}
                  >
                    <View style={styles.record}>
                      <Text style={styles.heading}>
                        {l.material} · {l.yard}
                      </Text>
                      <Text style={styles.quantity}>
                        {l.balance} {inventoryUnitLabel(l.unit)} available
                      </Text>
                      <Text style={styles.body}>
                        {l.readiness} · inspection{" "}
                        {l.inspection_accepted ? "accepted" : "pending"}
                      </Text>
                      <InventoryDisclosure title="stock details">
                        <Text style={uiStyles.muted}>
                          {l.received_at ?? "Receipt date unknown"} ·{" "}
                          {l.condition.replaceAll("_", " ")} · {l.age_source}
                        </Text>
                        <Text
                          style={[
                            uiStyles.muted,
                            l.category != null && l.category !== "rail_tie"
                              ? { display: "none" }
                              : {},
                          ]}
                        >
                          Supplier drying dates (reference only) ·{" "}
                          {l.drying_started_at ?? "start unknown"} →{" "}
                          {l.drying_completed_at ?? "completion unknown"}
                        </Text>
                      </InventoryDisclosure>
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
                        onPress={() => {
                          void controller.edit({
                            lotId: l.id,
                            lotVersion: l.version,
                          });
                          navigate("requests");
                        }}
                      />
                      {(s.canManage || s.assignments?.lead_id === userId) && (
                        <InventoryDisclosure title="record a count">
                          <Observation
                            unit={l.unit}
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
                        </InventoryDisclosure>
                      )}
                    </View>
                  </InventoryPanel>
                ))}
              </Card>
            </InventoryPanel>
            <InventoryPanel visible={shownSection === "requests"}>
              <Card>
                <SectionTitle>Request stock</SectionTitle>
                <SecondaryButton
                  title="Choose stock"
                  onPress={() => navigate("stock")}
                />
                <Text style={uiStyles.muted}>
                  Selected lot:{" "}
                  {s.lots.find((l) => l.id === d?.lotId)?.yard ??
                    "Choose stock"}
                  . Input saves on this device. Submission and approval require
                  a connection.
                </Text>
                <Field
                  label={`Quantity (${inventoryUnitLabel(s.lots.find((l) => l.id === d?.lotId)?.unit)})`}
                  value={String(d?.quantity ?? "")}
                  disabled={locked}
                  numeric
                  onChange={(v) =>
                    void controller.edit({
                      quantity: v === "" ? "" : Number(v),
                    })
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
                <InventorySearch
                  label="Search requests by number, material, yard, location or reason"
                  value={requestSearch}
                  onChange={setRequestSearch}
                />
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
                  }) && <Text>No requests match your search.</Text>}
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
                    <InventoryPanel
                      key={r.id}
                      visible={inventoryMatchesSearch(
                        requestSearch,
                        `#${r.number}`,
                        lot?.material,
                        lot?.yard,
                        r.work_location,
                        r.reason,
                      )}
                    >
                      <View style={styles.record}>
                        <Text style={styles.heading}>
                          #{r.number} · {r.quantity}{" "}
                          {inventoryUnitLabel(
                            s.lots.find((l) => l.id === r.lot_id)?.unit,
                          )}{" "}
                          → {r.work_location}
                        </Text>
                        <Text style={styles.body}>
                          {inventoryRequestStatus(r)} · revision {r.revision} ·
                          version {r.version}
                        </Text>
                        <Text style={styles.body}>
                          {inventoryNextApproval(s, r)}
                        </Text>
                        <Text style={styles.body}>{r.reason}</Text>
                        <Text style={uiStyles.muted}>
                          Requester {actorName(r.requester_id)} · verifier{" "}
                          {actorName(r.verifier_id)} · PM{" "}
                          {actorName(r.approver_id)}
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
                              onPress={() =>
                                act({ action: "authorize", ...base })
                              }
                            />
                          )}
                        {r.state === "awaiting_supply_chain" &&
                          s.finance?.supplyChainAssignment?.actor_id ===
                            userId &&
                          s.finance.canApproveSupplyChain === true &&
                          s.finance.annual?.find((a) => a.lotId === r.lot_id)
                            ?.evaluation.eligibleSupplyChain &&
                          ![
                            r.requester_id,
                            r.verifier_id,
                            r.approver_id,
                          ].includes(userId) && (
                            <PrimaryButton
                              title="Supply Chain authorize & post release"
                              disabled={disabled}
                              onPress={() =>
                                act({ action: "supply_chain", ...base })
                              }
                            />
                          )}
                        {["submitted", "verified"].includes(r.state) &&
                          [
                            s.assignments?.lead_id,
                            s.assignments?.pm_id,
                          ].includes(userId) && (
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
                                  act({
                                    action: "revise",
                                    ...base,
                                    reason: r.reason,
                                  })
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
                    </InventoryPanel>
                  );
                })}
              </Card>
              <InventoryDisclosure title="approval history and evidence">
                <InventoryHistory snapshot={s} />
              </InventoryDisclosure>
            </InventoryPanel>
            <InventoryPanel visible={shownSection === "costs"}>
              {s.finance && online && (
                <InventoryDisclosure title="organization rules and contracts">
                  <InventoryConfirmedRules
                    finance={s.finance}
                    lots={s.lots}
                    actors={s.actors}
                    assignments={s.assignments}
                    canManage={s.canManage}
                    disabled={disabled}
                    values={ruleInput}
                    setValues={setRuleInput}
                    act={act}
                  />
                </InventoryDisclosure>
              )}
              {s.finance && online && (
                <Finance
                  search={stockSearch}
                  setSearch={setStockSearch}
                  editor={financialEditor}
                  setEditor={setFinancialEditor}
                  snapshot={s}
                  finance={s.finance}
                  disabled={disabled}
                  act={act}
                />
              )}
            </InventoryPanel>
          </>
        )}
      </InventoryPanel>
    </Screen>
  );
}
function Observation({
  unit,
  disabled,
  onSave,
}: {
  disabled: boolean;
  unit?: string;
  onSave: (quantity: number, reason: string) => void;
}) {
  const [q, setQ] = useState(""),
    [r, setR] = useState("");
  return (
    <View>
      <Field
        label={`Observed count (${inventoryUnitLabel(unit)})`}
        value={q}
        onChange={setQ}
        numeric
      />
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
  search,
  setSearch,
  editor,
  setEditor,
  snapshot: s,
  finance: f,
  disabled,
  act,
}: {
  search: string;
  setSearch: (value: string) => void;
  editor: {
    editLot: string | null;
    proposal: boolean;
    values: Record<string, Record<string, string>>;
  };
  setEditor: import("react").Dispatch<
    import("react").SetStateAction<{
      editLot: string | null;
      proposal: boolean;
      values: Record<string, Record<string, string>>;
    }>
  >;
  snapshot: InventorySnapshot;
  finance: InventoryFinance;
  disabled: boolean;
  act: (c: InventoryCommand) => void;
}) {
  const { editLot, proposal } = editor;
  const editorKey = proposal ? "configuration" : (editLot ?? "");
  const values = editor.values[editorKey] ?? {};
  const [example, setExample] = useState<ReturnType<
    typeof basicHoldingExample
  > | null>(null);
  const setValues = (
    update:
      | Record<string, string>
      | ((old: Record<string, string>) => Record<string, string>),
  ) =>
    setEditor((old) => ({
      ...old,
      values: {
        ...old.values,
        [editorKey]:
          typeof update === "function"
            ? update(old.values[editorKey] ?? {})
            : update,
      },
    }));
  const field = (key: string, label: string, numeric = false) => (
    <Field
      key={key}
      label={label}
      numeric={numeric}
      disabled={disabled}
      value={values[key] ?? ""}
      onChange={(v) => setValues((x) => ({ ...x, [key]: v }))}
    />
  );
  return (
    <Card>
      <SectionTitle>Material cost & budget review</SectionTitle>
      <InventoryCsvExportButton projectId={s.projectId} online={!disabled} />
      <Text style={styles.body}>
        Enter prices per opening lot using Edit material costs. Estimates,
        commitments and recorded spend are shown separately.
      </Text>
      <InventorySearch
        label="Search costs by material or yard"
        value={search}
        onChange={setSearch}
      />
      {!!s.lots.length &&
        !s.lots.some((l) =>
          inventoryMatchesSearch(search, l.material, l.yard),
        ) && <Text>No material costs match your search.</Text>}
      <InventoryDisclosure title="project budget">
        <View style={styles.record}>
          <Text>Approved project budget</Text>
          <Text style={styles.quantity}>
            {inventoryMoney(f.budget.adjusted)}
          </Text>
          <Text>Recorded budget spend</Text>
          <Text style={styles.quantity}>{inventoryMoney(f.budget.spent)}</Text>
          <Text>Approved new material commitments</Text>
          <Text style={styles.quantity}>
            {inventoryMoney(f.budget.postedNewExposure)}
          </Text>
          <Text>Budget left before pending requests</Text>
          <Text style={styles.quantity}>
            {inventoryMoney(
              Number(f.budget.adjusted) -
                Number(f.budget.spent) -
                Number(f.budget.postedNewExposure),
            )}
          </Text>
        </View>
        <Text style={uiStyles.muted}>
          Budget currency needs confirmation before comparing these figures with
          material prices. Recorded spend and commitments are separate; invoice
          payments are not automatically imported.
        </Text>
      </InventoryDisclosure>
      {s.lots.map((l) => {
        const c = inventoryLatestCost(f, l.id),
          e = budgetEvaluation(
            f.budget,
            f.sources.find((x) => x.id === c?.exposure_id),
            false,
          );
        const totals = materialCostSummary(c),
          carrying = operationalCarrying(l, c, f.policy, s.asOf);
        const delivered =
          (editLot === l.id ? values : c ? inventoryCostFormValues(c, f) : {})
            .pricingMode === "delivered";
        const currency =
          f.contractSources?.find((x) => x.id === c?.exposure_id)?.currency ??
          f.annual?.find((a) => a.lotId === l.id)?.evaluation.currency ??
          f.policy?.currency;
        return (
          <InventoryPanel
            key={l.id}
            visible={inventoryMatchesSearch(search, l.material, l.yard)}
          >
            <View style={styles.record}>
              <SectionTitle>
                {l.material} · {l.yard}
              </SectionTitle>
              <InventoryDisclosure title="costs and add prices">
                <Text style={styles.body}>
                  {e.state === "unknown"
                    ? "Funding needs review — release held"
                    : e.state === "hold"
                      ? `Over budget by ${inventoryMoney(e.shortfall)} — release held`
                      : `${inventoryMoney(e.headroom)} headroom after this source`}
                </Text>
                <Text>Acquisition cost · original lot</Text>
                <Text style={styles.quantity}>
                  {inventoryMoney(totals.landed, currency)}
                </Text>
                <Text>
                  {inventoryMoney(
                    inventoryPerTie(totals.landed, l.opening_quantity),
                    currency,
                  )}{" "}
                  per {inventoryUnitLabel(l.unit)}
                </Text>
                <Text>Installed subtotal · original lot</Text>
                <Text style={styles.quantity}>
                  {inventoryMoney(totals.installedExcludingCarrying, currency)}
                </Text>
                <Text style={uiStyles.muted}>
                  Acquisition + installation + inspection; excludes disposal and
                  carrying.
                </Text>
                <Text>Future disposal · original lot</Text>
                <Text style={styles.quantity}>
                  {inventoryMoney(totals.disposal, currency)}
                </Text>
                <Text>Accrued carrying · remaining stock</Text>
                <Text style={styles.quantity}>
                  {inventoryMoney(carrying.annual, currency)}
                </Text>
                <Text>
                  {carrying.rate == null
                    ? "Rate unconfirmed"
                    : `${carrying.rate * 100}% per year`}{" "}
                  · {carrying.days ?? "Unknown"} days held
                </Text>
                <Text style={uiStyles.muted}>
                  Original lot {l.opening_quantity ?? "unknown"}{" "}
                  {inventoryUnitLabel(l.unit)}; on hand {l.balance}. Full true
                  cost stays incomplete until all sources are confirmed. Storage
                  is separate from capital carrying.
                </Text>
                {s.canManage && c && (
                  <>
                    <SecondaryButton
                      title="Edit material costs"
                      disabled={disabled}
                      onPress={() => {
                        setEditor((old) => ({
                          ...old,
                          editLot: l.id,
                          proposal: false,
                          values: {
                            ...old.values,
                            [l.id]:
                              old.values[l.id] ?? inventoryCostFormValues(c, f),
                          },
                        }));
                      }}
                    />
                    {editLot === l.id && !proposal && (
                      <View>
                        <Text style={styles.body}>
                          Enter total amounts for the original opening lot, not
                          per-unit prices. Leave unknown amounts blank. Saving
                          creates a new revision with fresh approvals. Cost
                          edits stay in this session only; save online before
                          closing the app.
                        </Text>
                        <Text style={styles.body}>
                          Entered cost baseline{" "}
                          {values.costVersion ?? c.version}; current {c.version}
                          . Review changed values before rebasing.
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
                        {f.costEntryVersion === 2 && (
                          <InventoryChoice
                            label="Acquisition price method"
                            value={values.pricingMode ?? "breakdown"}
                            disabled={disabled}
                            options={[
                              {
                                value: "delivered",
                                label: "Delivered invoice / quote (simplest)",
                              },
                              ...(l.category == null ||
                              l.category === "rail_tie"
                                ? [
                                    {
                                      value: "breakdown",
                                      label: "Manufacturing breakdown",
                                    },
                                  ]
                                : []),
                            ]}
                            onChange={(pricingMode) =>
                              setValues((old) => ({ ...old, pricingMode }))
                            }
                          />
                        )}
                        {delivered && (
                          <>
                            <Text>
                              Treatment and delivery already invoiced are
                              included once. Manufacturing amounts are not added
                              again.
                            </Text>
                            {field(
                              "purchaseAmount",
                              "Total delivered amount · original opening lot",
                              true,
                            )}
                            {field(
                              "purchaseSource",
                              "Invoice / quote evidence",
                            )}
                            <InventoryChoice
                              label="Delivered price basis"
                              value={values.purchaseStatus ?? "estimate"}
                              disabled={disabled}
                              options={["estimate", "actual", "commitment"].map(
                                (status) => ({
                                  value: status,
                                  label: inventoryCostStatus(status),
                                }),
                              )}
                              onChange={(purchaseStatus) =>
                                setValues((old) => ({ ...old, purchaseStatus }))
                              }
                            />
                          </>
                        )}
                        {COST_BUCKETS.filter(
                          (k) =>
                            k !== "carrying_cost" &&
                            (!delivered ||
                              !COST_BUCKETS.slice(0, 7).includes(
                                k as (typeof COST_BUCKETS)[0],
                              )),
                        ).map((k) => (
                          <View key={k}>
                            {field(
                              k,
                              `${INVENTORY_COST_LABELS[k]} total for opening lot (blank = unknown)`,
                              true,
                            )}
                            {field(
                              `${k}:source`,
                              `${INVENTORY_COST_LABELS[k]} source`,
                            )}
                            <InventoryChoice
                              label={`${INVENTORY_COST_LABELS[k]} basis`}
                              value={values[`${k}:status`] ?? "awaiting_wendy"}
                              disabled={disabled}
                              options={[
                                "awaiting_wendy",
                                "estimate",
                                "actual",
                                "commitment",
                              ].map((status) => ({
                                value: status,
                                label: inventoryCostStatus(status),
                              }))}
                              onChange={(value) =>
                                setValues((old) => ({
                                  ...old,
                                  [`${k}:status`]: value,
                                }))
                              }
                            />
                          </View>
                        ))}
                        {(l.category == null || l.category === "rail_tie") &&
                          field("oil", "Creosote oil-linked quote/reference")}
                        <InventoryChoice
                          label="Contract"
                          value={values.contractId ?? ""}
                          disabled={disabled}
                          options={[
                            { value: "", label: "Choose a contract" },
                            ...(f.contracts ?? []).map((c) => ({
                              value: c.id,
                              label: `${c.contract_key} · ${c.name}`,
                            })),
                          ]}
                          onChange={(value) =>
                            setValues((old) => ({ ...old, contractId: value }))
                          }
                        />
                        {field("periodYear", "Contract period start year")}
                        {field("currency", "Source currency (ISO 4217)")}
                        {f.canConfigurePolicy &&
                          field(
                            "annualRateOverride",
                            "Annual carrying override (fraction/year; blank uses organization default)",
                          )}
                        {field(
                          "sourceKey",
                          "Purchase reference (invoice / PO number)",
                        )}
                        {field("source", "Source evidence")}
                        <InventoryChoice
                          label="Purchase source"
                          value={values.exposureId ?? ""}
                          disabled={disabled}
                          options={[
                            { value: "", label: "New distinct source" },
                            ...f.sources.map((source) => ({
                              value: source.id,
                              label: source.source_key,
                            })),
                          ]}
                          onChange={(value) =>
                            setValues((old) => ({ ...old, exposureId: value }))
                          }
                        />
                        <InventoryChoice
                          label="Funding treatment"
                          value={values.funding ?? "unknown"}
                          disabled={disabled}
                          options={[
                            { value: "unknown", label: "Unknown — hold" },
                            { value: "new", label: "New commitment" },
                            { value: "funded", label: "Already funded" },
                            { value: "committed", label: "Already committed" },
                          ]}
                          onChange={(value) =>
                            setValues((old) => ({ ...old, funding: value }))
                          }
                        />
                        {field(
                          "incrementalAmount",
                          "New purchase / commitment amount",
                          true,
                        )}
                        <InventoryChoice
                          label="Milestone"
                          value={values.milestoneId ?? ""}
                          disabled={disabled}
                          options={[
                            { value: "", label: "None" },
                            ...f.milestones.map((m) => ({
                              value: m.id,
                              label: m.name,
                            })),
                          ]}
                          onChange={(value) =>
                            setValues((old) => ({ ...old, milestoneId: value }))
                          }
                        />
                        <InventoryChoice
                          label="Change order"
                          value={values.changeOrderId ?? ""}
                          disabled={disabled}
                          options={[
                            { value: "", label: "None" },
                            ...f.budget.changeOrders.map((co) => ({
                              value: co.id,
                              label: `${co.number} · ${co.status} · ${co.signed ? "signed" : "unsigned"}`,
                            })),
                          ]}
                          onChange={(value) =>
                            setValues((old) => ({
                              ...old,
                              changeOrderId: value,
                            }))
                          }
                        />
                        <PrimaryButton
                          title="Save revision; fresh approvals required"
                          disabled={disabled}
                          onPress={() =>
                            act({
                              action: "cost",
                              lotId: l.id,
                              lotVersion: l.version,
                              costVersion: Number(
                                values.costVersion ?? c.version,
                              ),
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
                              ...(f.costEntryVersion === 2
                                ? {
                                    pricingMode:
                                      values.pricingMode ?? "breakdown",
                                    purchasePrice:
                                      values.pricingMode === "delivered"
                                        ? {
                                            amount:
                                              values.purchaseAmount === ""
                                                ? null
                                                : Number(values.purchaseAmount),
                                            source: values.purchaseSource ?? "",
                                            status:
                                              values.purchaseStatus ??
                                              "estimate",
                                          }
                                        : null,
                                  }
                                : {}),
                              creosoteOilReference: values.oil ?? "",
                              sourceKey: values.sourceKey,
                              source: values.source,
                              funding: values.funding ?? "unknown",
                              exposureId: values.exposureId || null,
                              contractId: values.contractId ?? "",
                              periodYear: values.periodYear ?? "",
                              currency: values.currency ?? "",
                              annualRateOverride:
                                values.annualRateOverride ?? "",
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
                <InventoryDisclosure title="itemized prices and sources">
                  {c?.purchase_price && (
                    <View style={styles.record}>
                      <Text style={styles.heading}>
                        Delivered invoice / quote
                      </Text>
                      <Text>
                        {inventoryMoney(c.purchase_price.amount, currency)} for
                        original lot ·{" "}
                        {inventoryMoney(
                          inventoryPerTie(
                            c.purchase_price.amount,
                            l.opening_quantity,
                          ),
                          currency,
                        )}{" "}
                        per {inventoryUnitLabel(l.unit)}
                      </Text>
                      <Text>
                        {inventoryCostStatus(c.purchase_price.status)} ·{" "}
                        {c.purchase_price.source}
                      </Text>
                    </View>
                  )}
                  {COST_BUCKETS.filter(
                    (k) =>
                      k !== "carrying_cost" &&
                      (!c?.purchase_price ||
                        !COST_BUCKETS.slice(0, 7).includes(
                          k as (typeof COST_BUCKETS)[0],
                        )),
                  ).map((k) => (
                    <View key={k} style={styles.record}>
                      <Text style={styles.heading}>
                        {INVENTORY_COST_LABELS[k]}
                      </Text>
                      <Text>
                        {inventoryMoney(c?.components[k].amount, currency)} for
                        original lot ·{" "}
                        {inventoryMoney(
                          inventoryPerTie(
                            c?.components[k].amount,
                            l.opening_quantity,
                          ),
                          currency,
                        )}{" "}
                        per {inventoryUnitLabel(l.unit)}
                      </Text>
                      <Text>
                        {inventoryCostStatus(c?.components[k].status)} ·{" "}
                        {c?.components[k].source || "Source needed"}
                      </Text>
                    </View>
                  ))}
                  <Text
                    style={
                      l.category != null && l.category !== "rail_tie"
                        ? { display: "none" }
                        : {}
                    }
                  >
                    Creosote oil-linked quote:{" "}
                    {c?.creosote_oil_reference || "Source needed"} · cost
                    revision {c?.version ?? "not recorded"}
                  </Text>
                </InventoryDisclosure>
              </InventoryDisclosure>
            </View>
          </InventoryPanel>
        );
      })}
      <InventoryDisclosure title="supporting cost evidence and examples">
        <Text style={styles.body}>
          Existing sources:{" "}
          {f.sources.map((e) => `${e.source_key}: ${e.id}`).join(" · ") ||
            "none"}
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
            {v.budget_snapshot.base}; adjusted {v.budget_snapshot.adjusted};
            spent {v.budget_snapshot.spent}; cost source{" "}
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
      </InventoryDisclosure>
      {s.canManage && (
        <>
          <SecondaryButton
            title="Unconfirmed configuration proposal"
            disabled={disabled}
            onPress={() => {
              setEditor((old) => ({
                ...old,
                proposal: !old.proposal,
                values: {
                  ...old.values,
                  configuration: old.values.configuration ?? {
                    configurationVersion: String(f.configuration?.version ?? 0),
                  },
                },
              }));
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

/** Hide without unmounting input, including filtered rows. */
function InventoryPanel({
  visible,
  children,
}: {
  visible: boolean;
  children: import("react").ReactNode;
}) {
  return (
    <View
      style={{ display: visible ? "flex" : "none", gap: 12 }}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? "auto" : "no-hide-descendants"}
    >
      {children}
    </View>
  );
}
function InventorySearch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholder="Search…"
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: colors.controlLine,
          borderRadius: 8,
          padding: 12,
          color: colors.ink,
        }}
      />
      {!!value && (
        <SecondaryButton title="Clear search" onPress={() => onChange("")} />
      )}
    </View>
  );
}
