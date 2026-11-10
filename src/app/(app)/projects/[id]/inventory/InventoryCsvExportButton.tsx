"use client";
import { useLayoutEffect, useRef, useState } from "react";
import {
  prepareInventoryCsv,
  type InventoryCsvReport,
} from "@railcommand/domain";
import { createClient } from "@/lib/supabase/client";
import { shareWorkspaceBlob } from "@/lib/native-workspace";

export function InventoryCsvExportButton({
  userId,
  projectId,
  online,
}: {
  userId: string;
  projectId: string;
  online: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const scope = useRef<{ active: boolean } | null>(null);
  const inFlight = useRef(false);
  useLayoutEffect(() => {
    const lifetime = { active: true };
    scope.current = lifetime;
    const {
      data: { subscription },
    } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") lifetime.active = false;
    });
    return () => {
      lifetime.active = false;
      subscription.unsubscribe();
    };
  }, [userId, projectId]);
  const download = async () => {
    if (inFlight.current) return;
    const lifetime = scope.current;
    const current = () =>
      lifetime?.active === true && scope.current === lifetime;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const db = createClient();
      const report = await prepareInventoryCsv(projectId, {
        current,
        online: () => online && navigator.onLine,
        read: async () => {
          const {
            data: { session },
          } = await db.auth.getSession();
          if (session?.user.id !== userId || !current())
            throw new Error("Account changed; export cancelled.");
          const result = await fetch(
            `/api/inventory?${new URLSearchParams({ projectId, format: "csv" })}`,
            {
              cache: "no-store",
              headers: { Authorization: `Bearer ${session.access_token}` },
            },
          );
          const data = await result.json();
          if (!result.ok)
            throw new Error(data.error ?? "Could not export CSV.");
          return data as InventoryCsvReport;
        },
      });
      const {
        data: { session },
      } = await db.auth.getSession();
      if (!current() || !navigator.onLine || session?.user.id !== userId)
        throw new Error("Account or connection changed; export cancelled.");
      const blob = new Blob([report.csv], { type: "text/csv;charset=utf-8" });
      if (await shareWorkspaceBlob(blob, report.fileName, current)) {
        if (current()) setMessage("CSV sent to the app share sheet.");
        return;
      }
      if (!current()) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement("a");
        link.href = url;
        link.download = report.fileName;
        link.click();
        setMessage("CSV downloaded. Open it in Excel.");
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (error) {
      if (current())
        setMessage(
          error instanceof Error
            ? error.message
            : "Export failed. Reconnect and try again; saved work is unchanged.",
        );
    } finally {
      inFlight.current = false;
      if (current()) setBusy(false);
    }
  };
  return (
    <div>
      <button
        type="button"
        disabled={!online || busy}
        onClick={() => void download()}
      >
        {busy ? "Preparing CSV…" : "Export CSV"}
      </button>
      <p>Opens in Excel · online only · current project cost report</p>
      <p role="status">{message}</p>
    </div>
  );
}
