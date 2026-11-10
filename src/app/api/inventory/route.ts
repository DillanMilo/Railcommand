import { authenticateMobileRequest } from "@/lib/mobile-api/auth";
import { createClient } from "@/lib/supabase/server";
import { inventoryHttp } from "@/lib/inventory/http";
export const dynamic = "force-dynamic";
async function handler(request: Request) {
  const bearer = request.headers.has("authorization")
    ? await authenticateMobileRequest(request)
    : null;
  const db = bearer?.supabase ?? (await createClient());
  if (request.headers.has("authorization") && !bearer)
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  if (
    request.method === "POST" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return Response.json(
      { error: "Same-origin request required" },
      { status: 403 },
    );
  return inventoryHttp(request, db);
}
export const GET = handler;
export const POST = handler;
