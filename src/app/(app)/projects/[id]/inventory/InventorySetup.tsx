"use client";
import { useEffect, useState } from "react";
import { InventoryImport } from "./InventoryImport";
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
export function InventorySetup({
  snapshot: s,
  view,
  disabled,
  acceptedLotId,
  act,
  acceptedMaterialId,
  acceptedImportResult,
  onClose,
}: {
  snapshot: InventorySnapshot;
  view: "stock" | "catalogue" | "approvers" | null;
  disabled: boolean;
  acceptedLotId?: string;
  acceptedMaterialId?: string;
  acceptedImportResult?: import("@railcommand/domain").InventoryResult;
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
  useEffect(() => {
    if (acceptedMaterialId) {
      setItem({ code: "", name: "", unit: "each", category: "rail_tie" });
      setItemSaved(true);
    }
  }, [acceptedMaterialId]);
  const [inspected, setInspected] = useState(false);
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
      setInspected(false);
    }
  }, [acceptedLotId]);
  const input = (
    name: string,
    label: string,
    type = "text",
    required = false,
  ) => (
    <label key={name}>
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={
          type === "number"
            ? material?.unit === "each"
              ? 1
              : 0.001
            : undefined
        }
        step={
          type === "number"
            ? material?.unit === "each"
              ? 1
              : 0.001
            : undefined
        }
        value={fields[name] ?? ""}
        onInput={
          type === "date"
            ? (e) => {
                const value = e.currentTarget.value;
                setFields((old) => ({ ...old, [name]: value }));
              }
            : undefined
        }
        onChange={(e) => {
          const value = e.currentTarget.value;
          setFields((old) => ({ ...old, [name]: value }));
        }}
      />
    </label>
  );
  const receive = () => {
    if (
      disabled ||
      step !== 3 ||
      !material ||
      !validInventoryQuantity(Number(fields.quantity), material.unit) ||
      !fields.yard?.trim() ||
      !fields.source?.trim() ||
      !inspected
    )
      return;
    act({
      action: "opening",
      materialId: material?.id,
      yard: fields.yard,
      quantity: Number(fields.quantity),
      source: fields.source,
      receivedAt: fields.date ?? "",
      inspectionAccepted: inspected,
      readiness: "ready",
      dryingStartedAt: fields.dryingStartedAt ?? "",
      dryingCompletedAt: fields.dryingCompletedAt ?? "",
    });
  };
  const stale = (s.assignments?.version ?? 0) !== assignment.version;
  return (
    <section hidden={!view} aria-label="Stock setup">
      <button type="button" onClick={onClose}>
        Close setup
      </button>
      <div hidden={view !== "stock"}>
        <h2>Receive stock</h2>
        {created ? (
          <div role="status">
            <p>Stock received. Its receipt and acceptance are recorded.</p>
            {s.canManage && (
              <p>Open Material costs to add its invoice price.</p>
            )}
            <button type="button" onClick={() => setCreated(null)}>
              Receive another delivery
            </button>
          </div>
        ) : (
          <>
            <p>
              Step {step} of 3 ·{" "}
              {step === 1
                ? "Choose material"
                : step === 2
                  ? "Quantity & location"
                  : "Confirm receipt"}
            </p>
            <form onSubmit={(e) => e.preventDefault()}>
              <fieldset disabled={disabled}>
                <div hidden={step !== 1}>
                  <label>
                    Search approved materials
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <label>
                    Approved material
                    <select
                      value={fields.materialId ?? ""}
                      onChange={(e) =>
                        setFields((old) => ({
                          ...old,
                          materialId: e.target.value,
                          quantity: "",
                        }))
                      }
                    >
                      <option value="">Choose a material</option>
                      {(s.catalogue ?? [])
                        .filter(
                          (m) =>
                            m.id === fields.materialId ||
                            inventoryMatchesSearch(
                              search,
                              m.code,
                              m.name,
                              m.unit,
                            ),
                        )
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.code} · {m.name} · {inventoryUnitLabel(m.unit)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <p>
                    Missing an item? Ask your project manager/admin to add it to
                    the approved catalogue.
                  </p>
                </div>
                <div hidden={step !== 2}>
                  <p>
                    {material?.code} · {material?.name}
                  </p>
                  {input(
                    "quantity",
                    `Quantity (${inventoryUnitLabel(material?.unit)})`,
                    "number",
                  )}
                  {input("yard", "Yard or storage location")}
                  <p>
                    Unit is fixed by the catalogue. No automatic conversions.
                  </p>
                </div>
                <div hidden={step !== 3}>
                  <p>
                    {material?.name} · {fields.quantity}{" "}
                    {inventoryUnitLabel(material?.unit)} · {fields.yard}
                  </p>
                  {input("source", "Receipt / inspection reference")}
                  {input(
                    "date",
                    "Date received (leave blank if unknown)",
                    "date",
                  )}
                  <label>
                    <input
                      type="checkbox"
                      checked={inspected}
                      onChange={(e) => setInspected(e.target.checked)}
                    />
                    Inspection accepted
                  </label>
                  {material?.category === "rail_tie" && (
                    <details>
                      <summary>Optional supplier drying dates</summary>
                      {input(
                        "dryingStartedAt",
                        "Supplier drying start",
                        "date",
                      )}
                      {input(
                        "dryingCompletedAt",
                        "Supplier drying completion",
                        "date",
                      )}
                    </details>
                  )}
                </div>
                {step > 1 && (
                  <button type="button" onClick={() => setStep((n) => n - 1)}>
                    Back
                  </button>
                )}
                {step < 3 ? (
                  <button
                    type="button"
                    disabled={
                      step === 1
                        ? !material
                        : !validInventoryQuantity(
                            Number(fields.quantity),
                            material?.unit,
                          ) || !fields.yard?.trim()
                    }
                    onClick={() => setStep((n) => n + 1)}
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={receive}
                    disabled={
                      !material ||
                      !validInventoryQuantity(
                        Number(fields.quantity),
                        material?.unit,
                      ) ||
                      !fields.yard?.trim() ||
                      !fields.source?.trim() ||
                      !inspected
                    }
                  >
                    Receive stock online
                  </button>
                )}
              </fieldset>
            </form>
            <p>
              Online only. Entries stay on this screen during connection loss.
              Save before closing.
            </p>
          </>
        )}
      </div>
      {s.canManage && (
        <div hidden={view !== "catalogue"}>
          <h2>Approved project catalogue</h2>
          <p>
            Add a specific material and fixed unit once. Receiving staff select
            it for every delivery.
          </p>
          {itemSaved && (
            <p role="status">Material approved and available for receiving.</p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setItemSaved(false);
              act({ action: "catalogue_add", ...item });
            }}
          >
            <fieldset disabled={disabled}>
              <label>
                Material code
                <input
                  required
                  maxLength={64}
                  value={item.code}
                  onChange={(e) =>
                    setItem((v) => ({ ...v, code: e.target.value }))
                  }
                />
              </label>
              <label>
                Name and specification
                <input
                  required
                  minLength={2}
                  maxLength={200}
                  value={item.name}
                  onChange={(e) =>
                    setItem((v) => ({ ...v, name: e.target.value }))
                  }
                />
              </label>
              <label>
                Category
                <select
                  value={item.category}
                  onChange={(e) =>
                    setItem((v) => ({ ...v, category: e.target.value }))
                  }
                >
                  {INVENTORY_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Fixed stock unit
                <select
                  value={item.unit}
                  onChange={(e) =>
                    setItem((v) => ({ ...v, unit: e.target.value }))
                  }
                >
                  {INVENTORY_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </label>
              <button>Approve material online</button>
            </fieldset>
          </form>
          <InventoryImport
            disabled={disabled}
            act={act}
            acceptedImportResult={acceptedImportResult}
          />
          <details>
            <summary>
              View approved materials ({s.catalogue?.length ?? 0})
            </summary>
            <ul>
              {s.catalogue?.map((m) => (
                <li key={m.id}>
                  {m.code} · {m.name} · {inventoryUnitLabel(m.unit)}
                </li>
              ))}
            </ul>
          </details>
          <p>
            Online only. Save before closing. Existing materials and units
            cannot be overwritten here.
          </p>
        </div>
      )}
      <div hidden={view !== "approvers"}>
        <h2>Choose approvers</h2>
        <p>
          Choose different invited project members for stock verification and PM
          approval.
        </p>
        {stale && (
          <p role="status">
            Assignments changed. Review the current people before saving.
          </p>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            setAssignment({
              lead: s.assignments?.lead_id ?? "",
              pm: s.assignments?.pm_id ?? "",
              version: s.assignments?.version ?? 0,
            })
          }
        >
          Review current assignments
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            act({
              action: "assign",
              leadId: assignment.lead,
              pmId: assignment.pm,
              expectedVersion: assignment.version,
            });
          }}
        >
          <label>
            Inventory lead
            <select
              required
              disabled={disabled}
              value={assignment.lead}
              onChange={(e) =>
                setAssignment((a) => ({ ...a, lead: e.target.value }))
              }
            >
              <option value="">Choose a project member</option>
              {inventoryMemberOptions(s.actors, "lead", [assignment.pm]).map(
                (o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            Project manager
            <select
              required
              disabled={disabled}
              value={assignment.pm}
              onChange={(e) =>
                setAssignment((a) => ({ ...a, pm: e.target.value }))
              }
            >
              <option value="">Choose a project manager</option>
              {inventoryMemberOptions(s.actors, "pm", [assignment.lead]).map(
                (o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ),
              )}
            </select>
          </label>
          <button disabled={disabled || stale}>Save approvers online</button>
        </form>
      </div>
    </section>
  );
}
