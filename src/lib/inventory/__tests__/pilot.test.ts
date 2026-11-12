import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inventoryHttp } from "../http";

const projectId = "94ab552b-9220-4c67-8362-4155c764ab8e";
const operationId = "fcaa989a-4a6a-4387-baae-dd0b948164b0";

describe("Inventory project membership HTTP boundary", () => {
  for (const pathname of ["/api/inventory", "/api/mobile/v1/inventory"]) {
    it(`closes reads, CSV, receipts, writes and settlement without project membership: ${pathname}`, async () => {
      const calls: string[] = [];
      const db = { rpc: async (name: string, args: unknown) => {
        calls.push(name);
        assert.deepEqual(args, { p_project_id: projectId });
        return { data: false, error: null };
      } } as unknown as SupabaseClient;
      const urls = [
        `${pathname}?projectId=${projectId}`,
        `${pathname}?projectId=${projectId}&format=csv`,
        `${pathname}?projectId=${projectId}&operationId=${operationId}`,
      ];
      const requests = urls.map((url) => new Request(`https://railcommand.io${url}`));
      for (const action of ["submit", "settle"])
        requests.push(new Request(`https://railcommand.io${pathname}`, {
          method: "POST", body: JSON.stringify({ projectId, operationId, command: { action } }),
        }));
      for (const request of requests) {
        const result = await inventoryHttp(request, db);
        assert.equal(result.status, 403);
        assert.match(result.headers.get("cache-control")!, /no-store/);
        const message = (await result.json()).error;
        assert.match(message, /access to this project/);
        assert.match(message, /Saved work/);
      }
      assert.deepEqual(calls, requests.map(() => "inventory_beta_access"));
    });
  }
  it("fails closed if membership cannot be checked, without calling business operations", async () => {
    const calls: string[] = [];
    const db = { rpc: async (name: string) => {
      calls.push(name); return { data: null, error: { message: "unavailable" } };
    } } as unknown as SupabaseClient;
    const result = await inventoryHttp(new Request(`https://railcommand.io/api/inventory?projectId=${projectId}`), db);
    assert.equal(result.status, 503);
    assert.match((await result.json()).error, /Saved work/);
    assert.deepEqual(calls, ["inventory_beta_access"]);
  });
});
