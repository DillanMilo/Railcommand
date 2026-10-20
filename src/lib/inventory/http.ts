import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { executeInventory, inventoryReceipt, readInventory } from "./service";
const uuid = z.uuid();
const input = z.object({
  projectId: uuid,
  operationId: uuid,
  command: z
    .object({
      action: z.enum([
        "settle",
        "assign",
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
      const operationId = q.get("operationId");
      return response(
        operationId
          ? {
              receipt: await inventoryReceipt(
                db,
                projectId,
                uuid.parse(operationId),
              ),
            }
          : await readInventory(db, projectId),
      );
    }
    const body = await request.text();
    if (body.length > 64000) return response({ error: "Input too large" }, 413);
    const v = input.parse(JSON.parse(body));
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
function response(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      Vary: "Cookie, Authorization",
    },
  });
}
