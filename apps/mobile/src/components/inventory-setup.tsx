import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import {
  inventoryMemberOptions,
  inventoryMatchesSearch,
  inventoryUnitLabel,
  validInventoryQuantity,
  INVENTORY_UNITS,
  INVENTORY_CATEGORIES,
  type InventoryCommand,
  type InventorySnapshot,
} from "@railcommand/domain";
import { Card, SecondaryButton, SectionTitle, uiStyles } from "./ui";
import { InventoryField } from "./inventory-field";
import { InventoryChoice } from "./inventory-choice";
import { InventoryDisclosure } from "./inventory-disclosure";
export function InventorySetup({
  snapshot: s,
  notice,
  view,
  disabled,
  acceptedLotId,
  act,
  acceptedMaterialId,
  onClose,
}: {
  snapshot: InventorySnapshot;
  notice?: string;
  view: "stock" | "catalogue" | "approvers" | null;
  disabled: boolean;
  acceptedLotId?: string;
  acceptedMaterialId?: string;
  act: (c: InventoryCommand) => void;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [step, setStep] = useState(1);
  const [search, setSearch] = useState("");
  const [item, setItem] = useState({
    code: "",
    name: "",
    unit: "each",
    category: "rail_tie",
  });
  const [itemSaved, setItemSaved] = useState(false);
  const material = s.catalogue?.find((m) => m.id === fields.materialId);
  const matches = (s.catalogue ?? []).filter((m) =>
    inventoryMatchesSearch(search, m.code, m.name, m.unit),
  );
  useEffect(() => {
    if (acceptedMaterialId) {
      setItem({ code: "", name: "", unit: "each", category: "rail_tie" });
      setItemSaved(true);
    }
  }, [acceptedMaterialId]);
  const [created, setCreated] = useState<string | null>(null);
  const [assignment, setAssignment] = useState({
    lead: s.assignments?.lead_id ?? "",
    pm: s.assignments?.pm_id ?? "",
    version: s.assignments?.version ?? 0,
  });
  useEffect(() => {
    if (acceptedLotId) {
      setCreated(acceptedLotId);
      setFields({});
      setStep(1);
    }
  }, [acceptedLotId]);
  const field = (key: string, label: string, numeric = false) => (
    <InventoryField
      key={key}
      label={label}
      disabled={disabled}
      value={fields[key] ?? ""}
      onChange={(value) => setFields((old) => ({ ...old, [key]: value }))}
      numeric={numeric}
    />
  );
  const stale = (s.assignments?.version ?? 0) !== assignment.version;
  return (
    <View
      style={{ display: view ? "flex" : "none" }}
      accessibilityElementsHidden={!view}
      importantForAccessibility={view ? "auto" : "no-hide-descendants"}
    >
      <Card>
        <SecondaryButton title="Close setup" onPress={onClose} />
        {notice && (
          <Text accessibilityRole="alert" style={uiStyles.muted}>
            {notice}
          </Text>
        )}
        <View
          style={{ display: view === "stock" ? "flex" : "none" }}
          accessibilityElementsHidden={view !== "stock"}
          importantForAccessibility={
            view === "stock" ? "auto" : "no-hide-descendants"
          }
        >
          <SectionTitle>Receive stock</SectionTitle>
          {created ? (
            <>
              <Text>
                Stock received. Its receipt and acceptance are recorded.
              </Text>
              {s.canManage && (
                <Text>Open Material costs to add its invoice price.</Text>
              )}
              <SecondaryButton
                title="Receive another delivery"
                onPress={() => setCreated(null)}
              />
            </>
          ) : (
            <>
              <Text>
                Step {step} of 3 ·{" "}
                {step === 1
                  ? "Choose material"
                  : step === 2
                    ? "Quantity & location"
                    : "Confirm receipt"}
              </Text>
              <View
                style={{ display: step === 1 ? "flex" : "none" }}
                accessibilityElementsHidden={step !== 1}
                importantForAccessibility={
                  step === 1 ? "auto" : "no-hide-descendants"
                }
              >
                <InventoryField
                  label="Search approved materials"
                  value={search}
                  onChange={setSearch}
                  disabled={disabled}
                />
                <InventoryChoice
                  label="Approved material"
                  value={fields.materialId ?? ""}
                  disabled={disabled}
                  options={matches.slice(0, 8).map((m) => ({
                    value: m.id,
                    label: `${m.code} · ${m.name} · ${inventoryUnitLabel(m.unit)}`,
                  }))}
                  onChange={(materialId) =>
                    setFields((old) => ({ ...old, materialId, quantity: "" }))
                  }
                />
                {matches.length > 8 && (
                  <Text>
                    Search to narrow the list ({matches.length} matches).
                  </Text>
                )}
                {material && (
                  <Text>
                    Selected: {material.code} · {material.name}
                  </Text>
                )}
                <Text>
                  Missing an item? Ask your project manager/admin to add it to
                  the approved catalogue.
                </Text>
              </View>
              <View
                style={{ display: step === 2 ? "flex" : "none" }}
                accessibilityElementsHidden={step !== 2}
                importantForAccessibility={
                  step === 2 ? "auto" : "no-hide-descendants"
                }
              >
                <Text>
                  {material?.code} · {material?.name}
                </Text>
                {field(
                  "quantity",
                  `Quantity (${inventoryUnitLabel(material?.unit)})`,
                  true,
                )}
                {field("yard", "Yard or storage location")}
                <Text>
                  Unit is fixed by the catalogue. No automatic conversions.
                </Text>
              </View>
              <View
                style={{ display: step === 3 ? "flex" : "none" }}
                accessibilityElementsHidden={step !== 3}
                importantForAccessibility={
                  step === 3 ? "auto" : "no-hide-descendants"
                }
              >
                <Text>
                  {material?.name} · {fields.quantity}{" "}
                  {inventoryUnitLabel(material?.unit)} · {fields.yard}
                </Text>
                {field("source", "Receipt / inspection reference")}
                {field(
                  "receivedAt",
                  "Date received (YYYY-MM-DD, or blank if unknown)",
                )}
                <InventoryChoice
                  label="Inspection accepted"
                  value={fields.inspection ?? "no"}
                  disabled={disabled}
                  options={[
                    { value: "no", label: "Not yet confirmed" },
                    { value: "yes", label: "Yes, inspection accepted" },
                  ]}
                  onChange={(inspection) =>
                    setFields((old) => ({ ...old, inspection }))
                  }
                />
                {material?.category === "rail_tie" && (
                  <InventoryDisclosure title="Optional supplier drying dates">
                    {field(
                      "dryingStartedAt",
                      "Supplier drying start (YYYY-MM-DD)",
                    )}
                    {field(
                      "dryingCompletedAt",
                      "Supplier drying completion (YYYY-MM-DD)",
                    )}
                  </InventoryDisclosure>
                )}
              </View>
              {step > 1 && (
                <SecondaryButton
                  title="Back"
                  disabled={disabled}
                  onPress={() => setStep((n) => n - 1)}
                />
              )}
              {step < 3 ? (
                <SecondaryButton
                  title="Continue"
                  disabled={
                    disabled ||
                    (step === 1
                      ? !material
                      : !validInventoryQuantity(
                          Number(fields.quantity),
                          material?.unit,
                        ) || !fields.yard?.trim())
                  }
                  onPress={() => setStep((n) => n + 1)}
                />
              ) : (
                <SecondaryButton
                  title="Receive stock online"
                  disabled={
                    disabled ||
                    !material ||
                    !validInventoryQuantity(
                      Number(fields.quantity),
                      material?.unit,
                    ) ||
                    !fields.yard?.trim() ||
                    !fields.source?.trim() ||
                    fields.inspection !== "yes"
                  }
                  onPress={() =>
                    act({
                      action: "opening",
                      materialId: material?.id,
                      yard: fields.yard,
                      quantity: Number(fields.quantity),
                      source: fields.source,
                      receivedAt: fields.receivedAt ?? "",
                      inspectionAccepted: true,
                      readiness: "ready",
                      dryingStartedAt: fields.dryingStartedAt ?? "",
                      dryingCompletedAt: fields.dryingCompletedAt ?? "",
                    })
                  }
                />
              )}
              <Text style={uiStyles.muted}>
                Online only. Entries stay on this screen during connection loss.
                Save before closing.
              </Text>
            </>
          )}
        </View>
        {s.canManage && (
          <View
            style={{ display: view === "catalogue" ? "flex" : "none" }}
            accessibilityElementsHidden={view !== "catalogue"}
            importantForAccessibility={
              view === "catalogue" ? "auto" : "no-hide-descendants"
            }
          >
            <SectionTitle>Approved project catalogue</SectionTitle>
            <Text>
              Add a specific material and fixed unit once. Receiving staff
              select it for every delivery.
            </Text>
            {itemSaved && (
              <Text accessibilityRole="alert">
                Material approved and available for receiving.
              </Text>
            )}
            <InventoryField
              label="Material code"
              value={item.code}
              onChange={(code) => setItem((v) => ({ ...v, code }))}
              disabled={disabled}
            />
            <InventoryField
              label="Name and specification"
              value={item.name}
              onChange={(name) => setItem((v) => ({ ...v, name }))}
              disabled={disabled}
            />
            <InventoryDisclosure title="Category and fixed stock unit">
              <InventoryChoice
                label="Category"
                value={item.category}
                options={[...INVENTORY_CATEGORIES]}
                disabled={disabled}
                onChange={(category) => setItem((v) => ({ ...v, category }))}
              />
              <InventoryChoice
                label="Fixed stock unit"
                value={item.unit}
                options={[...INVENTORY_UNITS]}
                disabled={disabled}
                onChange={(unit) => setItem((v) => ({ ...v, unit }))}
              />
            </InventoryDisclosure>
            <Text>
              {
                INVENTORY_CATEGORIES.find((c) => c.value === item.category)
                  ?.label
              }{" "}
              · {inventoryUnitLabel(item.unit)}
            </Text>
            <SecondaryButton
              title="Approve material online"
              disabled={
                disabled || !item.code.trim() || item.name.trim().length < 2
              }
              onPress={() => {
                setItemSaved(false);
                act({ action: "catalogue_add", ...item });
              }}
            />
            <Text>
              For bulk setup, use the CSV import in the web workspace. Save
              Excel as CSV first. Prices are added separately in Material costs.
            </Text>
            <Text style={uiStyles.muted}>
              Online only. Save before closing. Existing materials and units
              cannot be overwritten here.
            </Text>
          </View>
        )}
        <View
          style={{ display: view === "approvers" ? "flex" : "none" }}
          accessibilityElementsHidden={view !== "approvers"}
          importantForAccessibility={
            view === "approvers" ? "auto" : "no-hide-descendants"
          }
        >
          <SectionTitle>Choose approvers</SectionTitle>
          <Text>
            Choose different invited people for stock verification and PM
            approval.
          </Text>
          {stale && (
            <Text>
              Assignments changed. Review the current people before saving.
            </Text>
          )}
          <SecondaryButton
            title="Review current assignments"
            disabled={disabled}
            onPress={() =>
              setAssignment({
                lead: s.assignments?.lead_id ?? "",
                pm: s.assignments?.pm_id ?? "",
                version: s.assignments?.version ?? 0,
              })
            }
          />
          <InventoryChoice
            label="Inventory lead"
            value={assignment.lead}
            disabled={disabled}
            options={inventoryMemberOptions(s.actors, "lead", [assignment.pm])}
            onChange={(lead) => setAssignment((a) => ({ ...a, lead }))}
          />
          <InventoryChoice
            label="Project manager"
            value={assignment.pm}
            disabled={disabled}
            options={inventoryMemberOptions(s.actors, "pm", [assignment.lead])}
            onChange={(pm) => setAssignment((a) => ({ ...a, pm }))}
          />
          <SecondaryButton
            title="Save approvers online"
            disabled={disabled || stale || !assignment.lead || !assignment.pm}
            onPress={() =>
              act({
                action: "assign",
                leadId: assignment.lead,
                pmId: assignment.pm,
                expectedVersion: assignment.version,
              })
            }
          />
        </View>
      </Card>
    </View>
  );
}
