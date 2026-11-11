import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createInventoryCsvReport,
  inventoryForCostEntry,
  inventoryForVersion,
} from "@railcommand/domain";
import { executeInventory, inventoryReceipt, readInventory } from "./service";
const uuid = z.uuid();
const input = z.object({
  projectId: uuid,
  operationId: uuid,
  command: z
    .object({
      action: z.enum([
        "cost_access",
        "policy",
        "contract",
        "baseline",
        "supply_chain_assign",
        "supply_chain",
        "settle",
        "assign",
        "catalogue_add",
        "catalogue_import",
        "opening",
        "configuration",
        "cost",
        "count",
        "submit",
        "revise",
        "cancel",
        "verify",
        "authorize",
        "reject",
      ]),
    })
    .catchall(z.unknown()),
});
export async function inventoryHttp(
  request: Request,
  db: SupabaseClient,
): Promise<Response> {
  try {
    if (request.method === "GET") {
      const q = new URL(request.url).searchParams;
      const projectId = uuid.parse(q.get("projectId"));
      const pilot = await pilotAccess(db, projectId);
      if (pilot) return pilot;
      const operationId = q.get("operationId");
      if (q.get("format") === "csv") {
        if (operationId)
          return response(
            { error: "Export cannot include an operation receipt" },
            400,
          );
        // Re-run the caller's existing authenticated/RLS read for every export.
        // Never serialize a client-provided or cached financial snapshot.
        const snapshot = await readInventory(db, projectId);
        if (!snapshot.finance || snapshot.projectId !== projectId)
          return response(
            { error: "Cost access is required to export this report." },
            403,
          );
        return response(createInventoryCsvReport(snapshot));
      }

      return response(
        operationId
          ? {
              receipt: await inventoryReceipt(
                db,
                projectId,
                uuid.parse(operationId),
              ),
            }
          : inventoryForCostEntry(
              inventoryForVersion(
                await readInventory(db, projectId),
                q.get("inventoryVersion"),
              ),
              q.get("costEntryVersion"),
            ),
      );
    }
    const body = await request.text();
    if (body.length > 64000) return response({ error: "Input too large" }, 413);
    const v = input.parse(JSON.parse(body));
    const pilot = await pilotAccess(db, v.projectId);
    if (pilot) return pilot;
    return response(
      await executeInventory(db, v.projectId, v.operationId, v.command),
    );
  } catch (error) {
    return response(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid inventory input"
            : error instanceof Error
              ? error.message
              : "Inventory unavailable",
      },
      400,
    );
  }
}
async function pilotAccess(db: SupabaseClient, projectId: string): Promise<Response | null> {
  const { data, error } = await db.rpc("inventory_beta_access", {
    p_project_id: projectId,
  });
  if (error)
    return response({ error: "Inventory Beta is temporarily unavailable. Saved work stays on this device." }, 503);
  if (data !== true)
    return response({ error: "Inventory Beta is limited to the invited pilot project and testers. Saved work stays on this device." }, 403);
  return null;
}
function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie, Authorization",
    },
  });
}
