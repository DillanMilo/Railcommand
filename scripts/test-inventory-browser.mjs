// Actual production UI component + actual browser IndexedDB. The HTTP/session
// transport below is isolated SYNTHETIC data, not Supabase/RLS evidence (see DB suite).
import assert from "node:assert/strict";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
const root = process.cwd(),
  dir = mkdtempSync(join(tmpdir(), "tia-browser-"));
const actors = {
  foreman: randomUUID(),
  lead: randomUUID(),
  pm: randomUUID(),
  other: randomUUID(),
};
const projectId = randomUUID(),
  lotId = randomUUID(),
  receipts = new Map();
let drop = true;
const requests = [],
  events = [];
let balance = 1000,
  lotVersion = 1;
const snapshot = (actor) => ({
  projectId,
  asOf: new Date().toISOString(),
  canManage: false,
  assignments: { lead_id: actors.lead, pm_id: actors.pm, version: 1 },
  lots: [
    {
      id: lotId,
      project_id: projectId,
      material: "Synthetic ties",
      yard: "Synthetic North yard",
      balance,
      version: lotVersion,
      readiness: "ready",
      inspection_accepted: true,
      received_at: "2026-07-01",
      age_source: "Synthetic acceptance",
      drying_started_at: "2026-01-01",
      drying_completed_at: "2026-08-01",
      drying_min_months: 4,
      drying_max_months: 10,
      condition: "aged",
      latestCount: null,
    },
  ],
  requests,
  events,
  denials: [],
});
function execute(actor, id, command) {
  const key = `${actor}:${id}`,
    digest = JSON.stringify(command);
  if (receipts.has(key)) {
    const old = receipts.get(key);
    return old.digest === digest
      ? old.result
      : { error: "Operation conflict", code: "operation_conflict" };
  }
  let result;
  if (command.action === "submit") {
    const r = {
      id: randomUUID(),
      number: requests.length + 1,
      lot_id: lotId,
      requester_id: actors[actor],
      quantity: Number(command.quantity),
      work_location: command.workLocation,
      reason: command.reason,
      state: "submitted",
      version: 1,
      revision: 1,
      verifier_id: null,
      approver_id: null,
      created_at: new Date().toISOString(),
    };
    requests.push(r);
    result = { ok: true, requestId: r.id, version: 1 };
  } else {
    const r = requests.find((r) => r.id === command.requestId);
    if (!r || r.version !== command.expectedVersion)
      result = { error: "Stale request", code: "stale_request" };
    else if (
      command.action === "verify" &&
      actor === "lead" &&
      r.state === "submitted"
    ) {
      r.state = "verified";
      r.verifier_id = actors.lead;
      r.version++;
      result = { ok: true, requestId: r.id, version: r.version };
    } else if (
      command.action === "authorize" &&
      actor === "pm" &&
      r.state === "verified"
    ) {
      r.state = "posted";
      r.approver_id = actors.pm;
      r.version++;
      balance -= r.quantity;
      lotVersion++;
      result = { ok: true, requestId: r.id, version: r.version, balance };
    } else result = { error: "Denied", code: "denied" };
  }
  receipts.set(key, { digest, result });
  events.push({
    id: randomUUID(),
    request_id: result.requestId ?? null,
    action: command.action,
    actor_id: actors[actor],
    revision: 1,
    previous_state: null,
    next_state: requests.find((r) => r.id === result.requestId)?.state ?? null,
    reason: null,
    created_at: new Date().toISOString(),
  });
  return result;
}
const harness = `import React from 'react';import {createRoot} from 'react-dom/client';
import {InventoryWorkspace} from '${root}/src/app/(app)/projects/[id]/inventory/InventoryWorkspace';
import * as drafts from '${root}/src/lib/inventory/drafts';
import {openOfflineDatabase} from '${root}/src/lib/offline/storage';
const actor=new URL(location.href).searchParams.get('actor')||'foreman';const userId=${JSON.stringify(actors)}[actor];const projectId=${JSON.stringify(projectId)};
const call=async(params,body)=>{const r=await fetch('/synthetic-inventory?actor='+actor+'&projectId='+projectId+params,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const value=await r.json();if(value.syntheticDroppedResponse)throw Error('Synthetic lost response after server commit');return value;};
const transport={read:()=>call(''),execute:(operationId,command)=>call('',{operationId,command}),receipt:async id=>(await call('&operationId='+id)).receipt};
window.inventoryTest={userId,projectId,drafts,openOfflineDatabase};
createRoot(document.getElementById('root')).render(<InventoryWorkspace userId={userId} projectId={projectId} transport={transport}/>);`;
await build({
  stdin: {
    contents: harness,
    resolveDir: root,
    sourcefile: "inventory-synthetic-harness.tsx",
    loader: "tsx",
  },
  bundle: true,
  platform: "browser",
  format: "iife",
  outfile: join(dir, "ui.js"),
  tsconfig: join(root, "tsconfig.json"),
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '"https://synthetic.invalid"',
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": '"synthetic-public-key"',
  },
  loader: { ".css": "css" },
  logLevel: "silent",
});
const html =
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"><style>:root{--background:#f8fafc;--foreground:#0f172a}body{margin:0;font-family:system-ui}*{box-sizing:border-box}</style></head><body><div id="root"></div><script src="/ui.js"></script></body></html>';
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1"),
    actor =
      url.searchParams.get("actor") ??
      req.headers.authorization?.replace("Bearer synthetic-", "") ??
      "foreman";
  if (
    url.pathname === "/synthetic-inventory" ||
    url.pathname === "/api/mobile/v1/inventory"
  ) {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "POST") {
      const b = JSON.parse(body);
      const result = execute(actor, b.operationId, b.command);
      if (drop && actor === "foreman" && b.command.action === "submit") {
        drop = false;
        res.end(JSON.stringify({ syntheticDroppedResponse: true }));
        return;
      }
      res.end(JSON.stringify(result));
    } else
      res.end(
        JSON.stringify(
          url.searchParams.has("operationId")
            ? {
                receipt:
                  receipts.get(
                    `${actor}:${url.searchParams.get("operationId")}`,
                  )?.result ?? null,
              }
            : snapshot(actor),
        ),
      );
    return;
  }
  if (
    url.pathname === "/offline.html" ||
    url.pathname === "/offline-inventory.js" ||
    [
      "/sw.js",
      "/favicon-16x16.png",
      "/favicon-32x32.png",
      "/icon-192.png",
      "/icon-512.png",
      "/apple-touch-icon.png",
      "/manifest.json",
    ].includes(url.pathname)
  ) {
    res.setHeader(
      "Content-Type",
      url.pathname.endsWith(".js")
        ? "text/javascript"
        : url.pathname.endsWith(".png")
          ? "image/png"
          : url.pathname.endsWith(".json")
            ? "application/json"
            : "text/html",
    );
    res.end(readFileSync(join(root, "public", url.pathname)));
    return;
  }
  if (url.pathname === "/ui.js" || url.pathname === "/ui.css") {
    res.setHeader(
      "Content-Type",
      url.pathname.endsWith(".js") ? "text/javascript" : "text/css",
    );
    res.end(readFileSync(join(dir, url.pathname)));
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome =
  process.env.TIA_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const profile = join(dir, "profile");
let context;
const launch = () =>
  chromium.launchPersistentContext(profile, {
    headless: true,
    ...(existsSync(chrome) ? { executablePath: chrome } : {}),
    viewport: { width: 390, height: 844 },
  });
try {
  context = await launch();
  let page = context.pages()[0];
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}/?actor=foreman`);
  await page.getByRole("heading", { name: "Stock by lot" }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.getByRole("heading", { name: "Stock by lot" }).waitFor();
  await page.getByRole("button", { name: "Request from this lot" }).click();
  await page.getByLabel("Quantity of ties").fill("100");
  await page.getByLabel("Work location", { exact: true }).fill("Milepost 1");
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic track maintenance");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on this device" })
    .waitFor();
  const original = await page.evaluate(() =>
    window.inventoryTest.drafts.readInventoryDraft(
      window.inventoryTest.userId,
      window.inventoryTest.projectId,
    ),
  );
  assert.equal(original.command.quantity, 100);
  assert.equal(original.command.lotVersion, 1);
  await page.evaluate(async () => {
    const t = window.inventoryTest,
      db = await t.openOfflineDatabase(t.userId);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["outbox", "blobs", "records"], "readwrite");
      tx.objectStore("outbox").put({
        operationId: "old-log-identity",
        kind: "daily_log",
        projectId: t.projectId,
        status: "conflicted",
      });
      tx.objectStore("blobs").put({
        id: "old-photo-identity",
        blob: new Blob(["synthetic-photo"]),
      });
      tx.objectStore("records").put({
        key: "legacy-project",
        entityType: "project",
        projectId: t.projectId,
        value: {
          id: t.projectId,
          budget_total: 99999,
          budget_spent: 88888,
          name: "Synthetic",
        },
      });
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    await t.drafts.sanitizeOfflineFinance(t.userId);
  });
  assert.ok(
    (await page.evaluate(() =>
      window.inventoryTest.drafts.inspectWebDeviceWork(
        window.inventoryTest.userId,
      ),
    )) >= 2,
  );
  // Save failure is injected into the actual browser transaction; prior IndexedDB data remains.
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException("Synthetic quota full", "QuotaExceededError");
    };
  });
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Changed but quota rejected");
  await page
    .getByRole("status")
    .filter({ hasText: "Synthetic quota full" })
    .waitFor();
  assert.equal(
    (
      await page.evaluate(() =>
        window.inventoryTest.drafts.readInventoryDraft(
          window.inventoryTest.userId,
          window.inventoryTest.projectId,
        ),
      )
    ).command.reason,
    "Synthetic track maintenance",
  );
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = window.originalPut;
  });
  await page
    .getByLabel("Reason", { exact: true })
    .fill("Synthetic track maintenance");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on this device" })
    .waitFor();
  await context.setOffline(true);
  await page
    .getByLabel("Work location", { exact: true })
    .fill("Milepost offline");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on this device" })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Submit request online" })
      .isDisabled(),
    true,
  );
  await context.setOffline(false);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Submit request online" }).click();
  await page.getByRole("heading", { name: "Unconfirmed operation" }).waitFor();
  assert.equal(requests.length, 1);
  const unknown = await page.evaluate(() =>
    window.inventoryTest.drafts.readInventoryDraft(
      window.inventoryTest.userId,
      window.inventoryTest.projectId,
    ),
  );
  assert.equal(unknown.pending.operationId, original.operationId);
  // Close Chromium completely, then reopen the same synthetic profile: real disk persistence.
  await context.close();
  context = await launch();
  page = context.pages()[0];
  await page.goto(`${base}/?actor=other`);
  await page.getByRole("heading", { name: "Stock by lot" }).waitFor();
  assert.equal(
    await page.getByLabel("Reason", { exact: true }).inputValue(),
    "",
  );
  await page.goto(`${base}/?actor=foreman`);
  await page.getByRole("heading", { name: "Unconfirmed operation" }).waitFor();
  assert.equal(
    await page.getByLabel("Work location", { exact: true }).inputValue(),
    "Milepost offline",
  );
  await page.getByRole("button", { name: "Check receipt" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Confirmed by server" })
    .waitFor();
  assert.equal(requests.length, 1);
  await page.goto(`${base}/?actor=lead`);
  await page
    .getByRole("button", { name: "Verify quantity & location" })
    .click();
  await page
    .getByText("verified · revision 1 · version 2", { exact: true })
    .waitFor();
  assert.equal(balance, 1000);
  await page.goto(`${base}/?actor=pm`);
  await page.getByRole("button", { name: "Authorize & post release" }).click();
  await page
    .getByText("posted · revision 1 · version 3", { exact: true })
    .waitFor();
  assert.equal(balance, 900);
  // Actual typed mobile client sees the web-created record and creates another record
  // for the rendered web lead/PM screens to refresh and process.
  const { MobileApiClient } = await import(
    "../packages/api-client/src/index.ts"
  );
  const native = new MobileApiClient({
    baseUrl: base,
    getAccessToken: async () => "synthetic-foreman",
  });
  const nativeView = await native.readInventory(projectId);
  assert.equal(nativeView.requests[0].id, requests[0].id);
  const nativeRequest = await native.executeInventory(projectId, randomUUID(), {
    action: "submit",
    lotId,
    lotVersion: 2,
    quantity: 100,
    workLocation: "Native fixture milepost",
    reason: "Synthetic native typed-client request",
  });
  assert.equal(nativeRequest.ok, true);
  await page.goto(`${base}/?actor=lead`);
  await page
    .getByRole("button", { name: "Verify quantity & location" })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Confirmed by server" })
    .waitFor();
  await page.goto(`${base}/?actor=pm`);
  await page.getByRole("button", { name: "Authorize & post release" }).click();
  await page
    .getByRole("status")
    .filter({ hasText: "Confirmed by server" })
    .waitFor();
  assert.equal((await native.readInventory(projectId)).lots[0].balance, 800);
  await page.goto(`${base}/?actor=foreman`);
  await page.getByRole("heading", { name: "Stock by lot" }).waitFor();
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /budget|carrying|threshold|creosote|\$/i,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await page.screenshot({
    path: "/tmp/tia-inventory-phone.png",
    fullPage: true,
  });
  // Neutral shell reveals no user/project before explicit device-draft access.
  await page.getByRole("button", { name: "Request from this lot" }).click();
  await page.getByLabel("Quantity of ties").fill("25");
  await page.getByLabel("Work location", { exact: true }).fill("Restart test");
  await page.getByLabel("Reason", { exact: true }).fill("Saved offline");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on this device" })
    .waitFor();
  await context.setOffline(true);
  await page.goto(`${base}/network-offline-restart`);
  assert.doesNotMatch(
    await page.locator("body").innerText(),
    /Synthetic North|Milepost|Restart test/,
  );
  await page
    .getByRole("button", { name: "Open saved inventory drafts" })
    .click();
  await page.getByLabel("Work location", { exact: true }).fill("Fallback edit");
  await page
    .getByRole("status")
    .filter({ hasText: "Saved on this device" })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Open saved inventory drafts" })
    .click();
  assert.equal(
    await page.getByLabel("Work location", { exact: true }).inputValue(),
    "Fallback edit",
  );
  const cacheUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls = [];
    for (const name of names) {
      for (const r of await (await caches.open(name)).keys())
        urls.push(new URL(r.url).pathname);
    }
    return urls;
  });
  assert.ok(cacheUrls.includes("/offline.html"));
  assert.ok(
    cacheUrls.every(
      (p) =>
        [
          "/offline.html",
          "/offline-inventory.js",
          "/favicon-16x16.png",
          "/favicon-32x32.png",
          "/icon-192.png",
          "/icon-512.png",
          "/apple-touch-icon.png",
          "/manifest.json",
        ].includes(p) || p.startsWith("/_next/static/"),
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: actual rendered phone-width UI; real IndexedDB commit/quota preservation/full Chromium restart; A→B→A; offline input and disabled submission; dropped-response receipt recovery; preserved old outbox/blob; selective legacy finance removal; web→typed mobile and typed mobile→web synthetic transport; lead→PM; no field financial DOM; neutral fallback restart/edit. Screenshot /tmp/tia-inventory-phone.png. Synthetic session/HTTP transport; RLS/transactions established separately by test-inventory-db.mjs.",
  );
} catch (error) {
  if (context) {
    const p = context.pages()[0];
    console.error(
      "Browser failure evidence:",
      await p.locator("body").innerText(),
    );
    await p.screenshot({
      path: "/tmp/tia-inventory-browser-failure.png",
      fullPage: true,
    });
  }
  throw error;
} finally {
  await context?.close();
  await new Promise((r) => server.close(r));
  rmSync(dir, { recursive: true, force: true });
}
