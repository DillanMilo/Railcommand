import { Text, TextInput, View } from "react-native";
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
import { InventoryChoice } from "./inventory-choice";
import { InventoryDisclosure } from "./inventory-disclosure";
import { SecondaryButton, SectionTitle, uiStyles } from "@/components/ui";
export function InventoryConfirmedRules({
  finance: f,
  lots,
  actors,
  assignments,
  canManage,
  disabled,
  values,
  setValues,
  act,
}: {
  finance: InventoryFinance;
  lots: InventoryLot[];
  actors: InventorySnapshot["actors"];
  assignments: InventorySnapshot["assignments"];
  canManage: boolean;
  disabled: boolean;
  values: Record<string, Record<string, string>>;
  setValues: import("react").Dispatch<
    import("react").SetStateAction<Record<string, Record<string, string>>>
  >;
  act: (c: InventoryCommand) => void;
}) {
  return (
    <View>
      <SectionTitle>Contract approvals & organization rules</SectionTitle>
      <Text>
        {f.policy
          ? `${f.policy.annual_rate * 100}% annual capital carrying · Supply Chain sign-off above ${inventoryMoney(f.policy.threshold_amount, f.policy.currency)} per contract year`
          : "Confirmed policy needed — release held"}
      </Text>
      <InventoryDisclosure title="contract rules and annual review">
        <Text>{CONTRACT_RULE_EXPLANATION}</Text>
        {f.contracts?.map((c) => (
          <Text key={c.id}>
            {c.contract_key} · {c.name} · anniversary{" "}
            {inventoryDate(c.start_date)}
          </Text>
        ))}
        {f.annual?.map(({ lotId, evaluation: a }) => (
          <View key={lotId} style={{ gap: 10, paddingVertical: 14 }}>
            <SectionTitle>
              {lots.find((l) => l.id === lotId)?.material ?? "Material lot"} ·
              contract-year review
            </SectionTitle>
            <Text style={{ fontSize: 20, fontWeight: "600" }}>
              {inventoryMoney(a.forecast, a.currency)} approved commitments +
              request
            </Text>
            <Text>
              {a.state !== "complete" && a.state !== "already_funded"
                ? "Hold — reconcile the contract period and commitments first."
                : a.requiresSupplyChain
                  ? a.eligibleSupplyChain
                    ? "Supply Chain sign-off required before release."
                    : "Hold — assign an eligible Supply Chain approver."
                  : a.incremental === 0
                    ? "Already committed source. No new spending; lead and PM approval still apply."
                    : "Within the configured threshold. Lead and PM approval still apply."}
            </Text>
            {a.likelySplit && (
              <Text>
                Likely split purchases — review linked sources. Splitting to
                avoid approval is prohibited. A flag is not a finding of fraud.
              </Text>
            )}
            <Text>
              Contract year {inventoryDate(a.periodStart)} →{" "}
              {inventoryDate(a.periodEndExclusive)} (end excluded).
            </Text>
            <InventoryDisclosure title="commitment breakdown and sources">
              <Text>
                External opening{" "}
                {inventoryMoney(a.baseline?.amount, a.currency)} · tracked
                approved {inventoryMoney(a.committed, a.currency)} · new amount{" "}
                {inventoryMoney(a.incremental, a.currency)}
              </Text>
              <Text>{annualReviewText(a)}</Text>
              {a.proposedSource && (
                <Text>
                  Proposed {a.proposedSource.sourceKey} ·{" "}
                  {inventoryMoney(a.proposedSource.amount, a.currency)} ·{" "}
                  {a.proposedSource.evidence} · source{" "}
                  {a.proposedSource.sourceId} · project{" "}
                  {a.proposedSource.projectId}
                </Text>
              )}
              {a.sources?.map((x) => (
                <Text key={x.sourceId}>
                  {x.sourceKey} · {inventoryMoney(x.amount, a.currency)} ·{" "}
                  {x.evidence} · source {x.sourceId} · project {x.projectId} ·
                  request {x.requestId}
                </Text>
              ))}
              <Text>
                Policy revision {a.policy?.version ?? "missing"} · baseline
                revision {a.baseline?.version ?? "missing"} · lot {lotId}
              </Text>
            </InventoryDisclosure>
          </View>
        ))}
      </InventoryDisclosure>
      {allowedInventoryRuleForms(f, canManage).map((form) => (
        <InventoryDisclosure key={form.action} title={form.title}>
          {form.fields.map(([key, label]) => (
            <View key={key}>
              <Text>{label}</Text>
              {["supplyChainId", "memberId"].includes(key) ? (
                <InventoryChoice
                  label={label}
                  value={
                    values[form.action]?.[key] ??
                    (form.values as Record<string, string>)[key] ??
                    ""
                  }
                  disabled={disabled}
                  options={[
                    { value: "", label: "Choose an invited project member" },
                    ...inventoryMemberOptions(
                      actors,
                      key === "supplyChainId" ? "supplyChain" : "costViewer",
                      key === "supplyChainId"
                        ? [assignments?.lead_id, assignments?.pm_id]
                        : [],
                    ),
                  ]}
                  onChange={(value) =>
                    setValues((old) => ({
                      ...old,
                      [form.action]: {
                        ...form.values,
                        ...old[form.action],
                        [key]: value,
                      },
                    }))
                  }
                />
              ) : (
                <TextInput
                  editable={!disabled}
                  accessibilityLabel={label}
                  style={uiStyles.input}
                  value={
                    values[form.action]?.[key] ??
                    (form.values as Record<string, string>)[key] ??
                    ""
                  }
                  onChangeText={(text) =>
                    setValues((old) => ({
                      ...old,
                      [form.action]: {
                        ...form.values,
                        ...old[form.action],
                        [key]: text,
                      },
                    }))
                  }
                />
              )}
            </View>
          ))}
          <Text>
            {form.action === "cost_access"
              ? "Access changes apply on the next server refresh. Accepted history stays unchanged."
              : "Keep the reviewed version until you explicitly review current history. Changes invalidate pending approvals; requests must be rebased and approved again."}
          </Text>
          <SecondaryButton
            title={`Save ${form.title.toLowerCase()} online`}
            disabled={disabled}
            onPress={() =>
              act(
                inventoryRuleCommand(form.action, {
                  ...form.values,
                  ...values[form.action],
                } as Record<string, string>),
              )
            }
          />
        </InventoryDisclosure>
      ))}
      <InventoryDisclosure title="policy, reconciliation & approval history">
        {f.costAccess?.map((a) => (
          <Text key={`${a.member_id}:${a.version}`}>
            Cost viewing · member {a.member_id} ·{" "}
            {a.can_view ? "allowed" : "removed"} · version {a.version} ·{" "}
            {a.source} · changed {a.actor_id} · {a.created_at}
          </Text>
        ))}
        {f.policyHistory?.map((p) => (
          <Text key={p.version}>
            Policy {p.version} · {p.annual_rate * 100}% annually · {p.currency}{" "}
            {p.threshold_amount} · {p.source} ·{" "}
            {p.created_by ?? "confirmed initial default"} · {p.created_at}
          </Text>
        ))}
        {f.baselines?.map((b) => (
          <Text key={b.id}>
            Contract {b.contract_id} · period {b.period_year} · {b.currency}{" "}
            {b.amount} · baseline {b.version} · {b.evidence} · verified{" "}
            {b.verified_by} · {b.verified_at}
          </Text>
        ))}
        {f.approvalEvidence?.map((e) => (
          <Text key={e.id}>
            {e.action} · request {e.request_id} · revision {e.revision} · actor{" "}
            {e.actor_id} · {e.created_at} · policy {e.snapshot.policy?.version}{" "}
            · baseline {e.snapshot.baseline?.version ?? "not applicable"} ·
            annual total {e.snapshot.forecast ?? "not applicable"} · incremental{" "}
            {e.snapshot.incremental ?? "unknown"}
          </Text>
        ))}
      </InventoryDisclosure>
    </View>
  );
}
