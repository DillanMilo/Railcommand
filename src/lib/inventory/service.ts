import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  InventoryCommand,
  InventoryResult,
  InventorySnapshot,
} from "@railcommand/domain";
export async function readInventory(
  db: SupabaseClient,
  projectId: string,
): Promise<InventorySnapshot> {
  const { data, error } = await db.rpc("inventory_read", {
    p_project_id: projectId,
  });
  if (error)
    throw new Error(
      "Inventory could not be loaded. Check access and migration availability.",
    );
  if (data?.error) throw new Error(data.error);
  return data as InventorySnapshot;
}
export async function executeInventory(
  db: SupabaseClient,
  projectId: string,
  operationId: string,
  command: InventoryCommand,
): Promise<InventoryResult> {
  const { data, error } = await db.rpc("inventory_execute", {
    p_project_id: projectId,
    p_operation_id: operationId,
    p_command: command,
  });
  if (error)
    throw new Error(
      "Operation not confirmed. Keep this operation identity and check its receipt before retrying.",
    );
  return data as InventoryResult;
}
export async function inventoryReceipt(
  db: SupabaseClient,
  projectId: string,
  operationId: string,
): Promise<InventoryResult | null> {
  const { data, error } = await db.rpc("inventory_receipt", {
    p_project_id: projectId,
    p_operation_id: operationId,
  });
  if (error) throw new Error("Receipt check failed. Saved work is preserved.");
  return data;
}
