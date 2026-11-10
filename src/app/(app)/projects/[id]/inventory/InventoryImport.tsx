"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./inventory.module.css";
import {
  INVENTORY_IMPORT_TEMPLATE,
  INVENTORY_UNITS,
  INVENTORY_CATEGORIES,
  parseInventoryImport,
  inventoryUnitLabel,
  type InventoryCommand,
  type InventoryImportRow,
} from "@railcommand/domain";
export function InventoryImport({
  disabled,
  act,
  acceptedImportResult,
}: {
  disabled: boolean;
  act: (c: InventoryCommand) => void;
  acceptedImportResult?: import("@railcommand/domain").InventoryResult;
}) {
  const [rows, setRows] = useState<InventoryImportRow[]>([]),
    [reference, setReference] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (acceptedImportResult?.importHash) {
      setRows([]);
      setSaved(true);
      setReference("");
      if (input.current) input.current.value = "";
    }
  }, [acceptedImportResult]);
  return (
    <details>
      <summary>Import catalogue / opening stock from CSV</summary>
      <p>
        Save Excel as CSV. Up to 100 materials per batch; one row per code.
        Prices are entered separately in Material costs.
      </p>
      <a
        download="railcommand-inventory-template.csv"
        href={`data:text/csv;charset=utf-8,${encodeURIComponent(INVENTORY_IMPORT_TEMPLATE)}`}
      >
        Download CSV template
      </a>
      <p>
        Categories: {INVENTORY_CATEGORIES.map((c) => c.value).join(", ")}.
        Units:{" "}
        {INVENTORY_UNITS.map((u) => `${u.value} (${u.label})`).join(", ")}. No
        unit conversions.
      </p>
      <p>
        For catalogue only, leave stock columns blank. Opening stock requires
        quantity, yard, receipt_reference and inspection_accepted=true. Received
        date is YYYY-MM-DD or blank if unknown.
      </p>
      <label>
        Choose CSV file
        <input
          ref={input}
          disabled={disabled}
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            setError("");
            setRows([]);
            setSaved(false);
            if (!file) return;
            try {
              if (file.size > 50000)
                throw new Error("Use a CSV smaller than 50 KB.");
              setRows(parseInventoryImport(await file.text()));
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "CSV could not be read.",
              );
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {saved && (
        <p role="status">
          Import confirmed. Approved materials and opening stock are available.
        </p>
      )}
      {!!rows.length && (
        <>
          <p>
            Preview · {rows.length} materials. Existing matching codes are
            reused; conflicting specifications reject the entire import.
          </p>
          <div
            className={styles.tableScroll}
            tabIndex={0}
            role="region"
            aria-label="Inventory import preview"
          >
            <table className={styles.costTable}>
              <thead>
                <tr>
                  <th>Code / material</th>
                  <th>Unit</th>
                  <th>Opening stock</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.code}>
                    <td>
                      {r.code}
                      <br />
                      {r.name}
                    </td>
                    <td>{inventoryUnitLabel(r.unit)}</td>
                    <td>
                      {r.quantity == null
                        ? "Catalogue only"
                        : `${r.quantity} · ${r.yard}`}
                    </td>
                    <td>{r.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <label>
            Unique import reference
            <input
              disabled={disabled}
              maxLength={200}
              placeholder="e.g. PROJECT-OPENING-001"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={disabled || !reference.trim()}
            onClick={() =>
              act({
                action: "catalogue_import",
                importReference: reference.trim(),
                rows,
              })
            }
          >
            Confirm import online
          </button>
        </>
      )}
      <p>
        Repeated batches are recognized and do not add stock twice. Review the
        receipt before retrying an unconfirmed import. Preview stays in this
        session only.
      </p>
    </details>
  );
}
