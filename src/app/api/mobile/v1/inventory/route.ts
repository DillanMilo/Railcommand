import {
  authenticateMobileRequest,
  mobileOptions,
  mobileJson,
} from "@/lib/mobile-api/auth";
import { inventoryHttp } from "@/lib/inventory/http";
export const dynamic = "force-dynamic";
export const OPTIONS = mobileOptions;
async function handler(request: Request) {
  const context = await authenticateMobileRequest(request);
  if (!context) return mobileJson({ error: "Not authenticated" }, 401);
  const result = await inventoryHttp(request, context.supabase);
  return mobileJson(await result.json(), result.status);
}
export const GET = handler;
export const POST = handler;
