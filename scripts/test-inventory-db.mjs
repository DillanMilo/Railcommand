// Real disposable PostgreSQL. No hosted URL, secrets, production data, or exposed port.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
const name = `railcommand-inventory-${randomUUID()}`;
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim();
const endpoint =
  process.env.DOCKER_HOST ||
  JSON.parse(docker(["context", "inspect"]))[0].Endpoints.docker.Host;
assert.match(endpoint, /^(unix:\/\/|npipe:\/\/)/);
function sql(s) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-X",
      "-h",
      "127.0.0.1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: s, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
}
const ids = Object.fromEntries(
  [
    "org",
    "project",
    "foreign",
    "foreman",
    "lead",
    "pm",
    "owner",
    "outsider",
    "admin",
  ].map((k) => [k, randomUUID()]),
);
const as = (user, s) =>
  sql(
    `set role authenticated; set request.jwt.claim.sub='${ids[user] ?? user}'; ${s}`,
  );
function command(user, command, operation = randomUUID()) {
  return JSON.parse(
    as(
      user,
      `select public.inventory_execute('${ids.project}','${operation}','${JSON.stringify(command).replaceAll("'", "''")}'::jsonb)`,
    ),
  );
}
const read = (user) =>
  JSON.parse(as(user, `select public.inventory_read('${ids.project}')`));
const snapshot = readFileSync(
  new URL("../supabase/schema_snapshot.sql", import.meta.url),
  "utf8",
);
const ddl = (table) =>
  snapshot.match(
    new RegExp(
      'CREATE TABLE IF NOT EXISTS "public"\\."' +
        table +
        '" \\([\\s\\S]+?\\n\\);',
    ),
  )[0];
let created = false;
try {
  docker([
    "run",
    "--detach",
    "--name",
    name,
    "--network",
    "none",
    "--tmpfs",
    "/var/lib/postgresql/data",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "postgres:17",
  ]);
  created = true;
  for (let i = 0; i < 100; i++) {
    try {
      docker(["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"]);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
 create table public.activity_log(project_id uuid,entity_type text,description text);
 create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon,service_role;
 create table public.profiles(id uuid primary key,organization_id uuid,role text,full_name text,email text);
 ${ddl("projects")}
 alter table public.projects add primary key(id);
 create table public.project_members(project_id uuid,profile_id uuid,project_role text,can_edit boolean);
 ${ddl("milestones")}
 alter table public.milestones add primary key(id);
 ${ddl("change_orders")}
 alter table public.change_orders add primary key(id);
 alter table public.change_orders enable row level security;
 grant select on public.change_orders to authenticated;
 create policy fixture_co_members on public.change_orders for select to authenticated using(true);
 insert into public.projects(id,organization_id,budget_total,budget_spent,name,start_date,target_end_date,created_by) values('${ids.project}','${ids.org}',130000,126000,'Synthetic inventory project',current_date,current_date,'${ids.pm}'),('${ids.foreign}','${randomUUID()}',99999,0,'Foreign synthetic project',current_date,current_date,'${ids.pm}');
 ${["foreman", "lead", "pm", "owner", "outsider", "admin"].map((u) => `insert into public.profiles(id,organization_id,role) values('${ids[u]}','${ids.org}','${u === "admin" ? "admin" : "member"}');`).join("\n")}
 ${["foreman", "lead", "pm", "owner"].map((u) => `insert into public.project_members values('${ids.project}','${ids[u]}','${u === "lead" ? "inspector" : u === "pm" ? "manager" : u}',true);`).join("\n")}`);
  sql(
    `create function auth.role() returns text language sql stable as $$select current_user::text$$;grant select on public.project_members to authenticated;alter table public.projects enable row level security;alter table public.milestones enable row level security;drop policy fixture_co_members on public.change_orders;`,
  );
  sql(
    snapshot.match(
      /CREATE OR REPLACE FUNCTION "public"\."is_project_member"[\s\S]+?\$\$;/,
    )[0],
  );
  for (const name of [
    "projects_select",
    "Project members can read milestones",
    "Members can read change orders",
  ])
    sql(
      snapshot.match(new RegExp('CREATE POLICY "' + name + '"[\\s\\S]+?;'))[0],
    );
  const migration = readdirSync(
    new URL("../supabase/migrations/", import.meta.url),
  ).find((f) => f.endsWith("_inventory_phase_one.sql"));
  sql(
    readFileSync(
      new URL(`../supabase/migrations/${migration}`, import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    command("pm", { action: "assign", leadId: ids.lead, pmId: ids.pm }).ok,
    true,
  );
  const opening = command("pm", {
    action: "opening",
    materialCode: "TIE",
    material: "Ties",
    yard: "Synthetic North yard",
    quantity: 1000,
    source: "Synthetic opening acceptance",
    receivedAt: "2026-07-01",
    inspectionAccepted: true,
  });
  assert.equal(opening.ok, true);
  const lot = opening.lotId;
  assert.equal(read("foreman").finance, undefined);
  assert.equal(read("lead").finance, undefined);
  assert.equal(read("pm").finance.configuration.annual_rate, null);
  assert.equal(read("admin").error, "Project access required");
  const field = JSON.stringify(read("foreman"));
  for (const word of [
    "budget",
    "price",
    "rate",
    "threshold",
    "carrying",
    "creosote",
  ])
    assert.ok(!field.toLowerCase().includes(word), word);
  for (const table of [
    "inventory_lots",
    "inventory_movements",
    "inventory_events",
    "inventory_requests",
    "inventory_receipts",
  ]) {
    assert.throws(
      () => as("foreman", `delete from public.${table}`),
      /permission denied/,
    );
    assert.equal(
      sql(`select has_table_privilege('anon','public.${table}','select')`),
      "f",
    );
  }
  assert.equal(
    as("foreman", `select count(*) from public.inventory_cost_revisions`),
    "0",
  );
  const comp = Object.fromEntries(
    [
      "log",
      "mill",
      "trucking",
      "treating",
      "drying",
      "creosote",
      "rail_car",
      "install_labour",
      "inspection",
      "carrying_cost",
      "disposal",
    ].map((k) => [k, { amount: null, status: "awaiting_wendy", source: "" }]),
  );
  const cost = command("pm", {
    action: "cost",
    lotId: lot,
    lotVersion: 1,
    costVersion: 1,
    components: comp,
    sourceKey: "funded-source",
    funding: "funded",
    source: "Already in spent baseline",
    incrementalAmount: 6800,
  });
  assert.equal(cost.ok, true);
  const op = randomUUID(),
    input = {
      action: "submit",
      lotId: lot,
      lotVersion: 1,
      quantity: 100,
      workLocation: "Milepost 1",
      reason: "Synthetic track maintenance",
    };
  const submitted = command("foreman", input, op);
  assert.equal(submitted.ok, true);
  const request = submitted.requestId;
  assert.deepEqual(command("foreman", input, op), submitted);
  assert.equal(
    command("foreman", { ...input, quantity: 101 }, op).code,
    "operation_conflict",
  );
  assert.equal(
    JSON.parse(
      as(
        "foreman",
        `select public.inventory_receipt('${ids.project}','${op}')`,
      ),
    ).requestId,
    request,
  );
  assert.equal(
    command("foreman", {
      action: "verify",
      requestId: request,
      lotVersion: 1,
      expectedVersion: 1,
    }).code,
    "self_approval_denied",
  );
  assert.equal(
    command("pm", {
      action: "authorize",
      requestId: request,
      lotVersion: 1,
      expectedVersion: 1,
    }).code,
    "authorization_order_or_assignment_denied",
  );
  assert.equal(read("pm").denials.length, 2);
  assert.equal(
    command("lead", {
      action: "count",
      lotId: lot,
      lotVersion: 1,
      quantity: 980,
      reason: "Physical discrepancy",
    }).ok,
    true,
  );
  assert.equal(
    command("lead", {
      action: "verify",
      requestId: request,
      lotVersion: 1,
      expectedVersion: 1,
    }).code,
    "count_review_required",
  );
  assert.equal(
    command("lead", {
      action: "count",
      lotId: lot,
      lotVersion: 1,
      quantity: 1000,
      reason: "Verified recount",
    }).ok,
    true,
  );
  assert.equal(
    command("lead", {
      action: "verify",
      requestId: request,
      lotVersion: 1,
      expectedVersion: 1,
    }).ok,
    true,
  );
  assert.equal(read("foreman").lots[0].balance, 1000);
  const finalOp = randomUUID(),
    finalInput = {
      action: "authorize",
      requestId: request,
      lotVersion: 1,
      expectedVersion: 2,
    };
  assert.equal(command("pm", finalInput, finalOp).ok, true);
  assert.equal(read("foreman").lots[0].balance, 900);
  assert.deepEqual(
    command("pm", finalInput, finalOp),
    command("pm", finalInput, finalOp),
  );
  assert.equal(read("foreman").lots[0].balance, 900);
  assert.equal(read("pm").finance.budget.postedNewExposure, 0);
  assert.throws(
    () => sql(`update public.inventory_movements set quantity=999`),
    /Append-only/,
  );
  assert.equal(
    command("foreman", {
      action: "revise",
      requestId: request,
      lotVersion: 2,
      expectedVersion: 3,
      quantity: 101,
    }).code,
    "immutable_posted_request",
  );

  assert.equal(
    as("foreman", `select name from public.projects where id='${ids.project}'`),
    "Synthetic inventory project",
  );
  assert.equal(as("outsider", "select count(*) from public.projects"), "0");
  assert.equal(
    as(
      "foreman",
      "select has_function_privilege('anon','public.inventory_execute(uuid,uuid,jsonb)','execute')",
    ),
    "f",
  );
  assert.equal(
    as(
      "foreman",
      "select has_function_privilege('authenticated','inventory_private.budget(uuid)','execute')",
    ),
    "f",
  );
  assert.throws(
    () => as("foreman", "select reason from public.inventory_events"),
    /permission denied/,
  );
  // Database-side legacy values are unavailable even with a manually crafted client query.
  assert.throws(
    () => as("foreman", "select budget_total from public.projects"),
    /permission denied/,
  );
  assert.throws(
    () => as("foreman", "select budget_planned from public.milestones"),
    /permission denied/,
  );
  assert.equal(
    as(
      "foreman",
      `select count(*) from public.project_finance('${ids.project}')`,
    ),
    "0",
  );
  assert.equal(
    Number(
      as(
        "pm",
        `select budget_total from public.project_finance('${ids.project}')`,
      ),
    ),
    130000,
  );
  assert.equal(as("foreman", "select count(*) from public.change_orders"), "0");
  const openingLot = () =>
    command("pm", {
      action: "opening",
      materialCode: "TIE",
      material: "Ties",
      yard: "Synthetic North yard",
      quantity: 1000,
      source: "Synthetic acceptance",
      receivedAt: "2026-07-01",
      inspectionAccepted: true,
    }).lotId;
  const setCost = (l, funding = "funded", exposureId = null) =>
    command("pm", {
      action: "cost",
      lotId: l,
      lotVersion: 1,
      costVersion: 1,
      components: comp,
      sourceKey: randomUUID(),
      funding,
      source: "Synthetic source reconciliation",
      incrementalAmount: 6800,
      exposureId,
    });
  const submit = (l, q = 100) =>
    command("foreman", { ...input, lotId: l, quantity: q }).requestId;
  const verify = (r, v = 1, l = 1) =>
    command("lead", {
      action: "verify",
      requestId: r,
      lotVersion: l,
      expectedVersion: v,
    });
  const authorize = (r, v = 2, l = 1) =>
    command("pm", {
      action: "authorize",
      requestId: r,
      lotVersion: l,
      expectedVersion: v,
    });
  const budgetLot = openingLot();
  assert.equal(setCost(budgetLot, "new").ok, true);
  const budgetRequest = submit(budgetLot);
  assert.equal(verify(budgetRequest).ok, true);
  const beforeHold = read("pm");
  assert.equal(authorize(budgetRequest).code, "review_required");
  assert.equal(read("pm").lots.find((l) => l.id === budgetLot).balance, 1000);
  const co = randomUUID();
  sql(
    `insert into public.change_orders(id,project_id,number,title,amount,status) values('${co}','${ids.project}','CO-SYN-1','Synthetic funding',3000,'draft')`,
  );
  assert.equal(read("pm").finance.budget.adjusted, 130000);
  sql(
    `update public.change_orders set status='approved',approved_by='${ids.pm}',approval_date=current_date where id='${co}'`,
  );
  assert.equal(read("pm").finance.budget.adjusted, 133000);
  assert.equal(authorize(budgetRequest).code, "review_changed_rebase_required");
  assert.equal(
    command("foreman", {
      action: "revise",
      requestId: budgetRequest,
      lotVersion: 1,
      expectedVersion: 2,
      reason: "Explicit funding rebase",
    }).ok,
    true,
  );
  assert.equal(verify(budgetRequest, 3).ok, true);
  assert.equal(authorize(budgetRequest, 4).ok, true);
  assert.equal(read("pm").finance.budget.postedNewExposure, 6800);
  assert.equal(
    Number(read("pm").finance.budget.adjusted) -
      Number(read("pm").finance.budget.spent) -
      Number(read("pm").finance.budget.postedNewExposure),
    200,
  );
  const sameExposure = read("pm").finance.sources.find(
    (e) => e.funding === "new",
  ).id;
  const linkedLot = openingLot();
  assert.equal(setCost(linkedLot, "new", sameExposure).ok, true);
  const linkedRequest = submit(linkedLot);
  assert.equal(verify(linkedRequest).ok, true);
  assert.equal(authorize(linkedRequest).ok, true);
  assert.equal(read("pm").finance.budget.adjusted, 133000);
  assert.equal(read("pm").finance.budget.postedNewExposure, 6800);
  assert.equal(
    read("foreman").revisions.filter((r) => r.request_id === budgetRequest)
      .length,
    2,
  );
  assert.equal(
    as("foreman", `select count(*) from public.inventory_request_finance`),
    "0",
  );
  // Later cost revisions cannot rewrite recognized posted exposure.
  const c = read("pm").finance.costs.find((c) => c.lot_id === budgetLot);
  assert.equal(
    command("pm", {
      action: "cost",
      lotId: budgetLot,
      lotVersion: 2,
      costVersion: c.version,
      components: comp,
      sourceKey: randomUUID(),
      funding: "funded",
      source: "Later separate reconciliation",
    }).ok,
    true,
  );
  assert.equal(read("pm").finance.budget.postedNewExposure, 6800);
  // Two independent database connections race to authorize 600 from 1,000.
  const raceLot = openingLot();
  setCost(raceLot);
  const r1 = submit(raceLot, 600),
    r2 = submit(raceLot, 600);
  assert.equal(verify(r1).ok, true);
  assert.equal(verify(r2).ok, true);
  function asyncSql(s) {
    return new Promise((resolve, reject) => {
      const child = spawn("docker", [
        "exec",
        "-i",
        name,
        "psql",
        "-X",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Atq",
        "-v",
        "ON_ERROR_STOP=1",
      ]);
      let out = "",
        err = "";
      child.stdout.on("data", (x) => (out += x));
      child.stderr.on("data", (x) => (err += x));
      child.on("close", (c) => (c ? reject(Error(err)) : resolve(out.trim())));
      child.stdin.end(s);
    });
  }
  const results = await Promise.all(
    [r1, r2].map((r) =>
      asyncSql(
        `set role authenticated;set request.jwt.claim.sub='${ids.pm}';select public.inventory_execute('${ids.project}','${randomUUID()}','${JSON.stringify({ action: "authorize", requestId: r, lotVersion: 1, expectedVersion: 2 })}'::jsonb)`,
      ),
    ),
  );
  assert.equal(results.map(JSON.parse).filter((r) => r.ok).length, 1);
  assert.equal(read("pm").lots.find((l) => l.id === raceLot).balance, 400);
  // Any final-posting error rolls back stock, status, event and receipt together.
  const rollbackLot = openingLot();
  setCost(rollbackLot);
  const rollbackRequest = submit(rollbackLot);
  verify(rollbackRequest);
  sql(
    `create function inventory_private.synthetic_failure() returns trigger language plpgsql as $$begin if new.kind='issue' then raise exception 'Synthetic movement failure';end if;return new;end$$;create trigger synthetic_failure before insert on public.inventory_movements for each row execute function inventory_private.synthetic_failure()`,
  );
  const rollbackOp = randomUUID();
  assert.throws(
    () =>
      command(
        "pm",
        {
          action: "authorize",
          requestId: rollbackRequest,
          lotVersion: 1,
          expectedVersion: 2,
        },
        rollbackOp,
      ),
    /Synthetic movement failure/,
  );
  assert.equal(read("pm").lots.find((l) => l.id === rollbackLot).balance, 1000);
  assert.equal(
    read("pm").requests.find((r) => r.id === rollbackRequest).state,
    "verified",
  );
  assert.equal(
    as(
      "pm",
      `select count(*) from public.inventory_receipts where operation_id='${rollbackOp}'`,
    ),
    "0",
  );
  sql(
    "drop trigger synthetic_failure on public.inventory_movements;drop function inventory_private.synthetic_failure()",
  );
  // Current membership and explicit can_edit are revalidated on every write.
  sql(
    `update public.project_members set can_edit=false where profile_id='${ids.lead}'`,
  );
  assert.equal(verify(rollbackRequest).code, "denied");
  sql(
    `update public.project_members set can_edit=true where profile_id='${ids.lead}'`,
  );
  sql(`delete from public.project_members where profile_id='${ids.pm}'`);
  assert.equal(authorize(rollbackRequest).code, "denied");
  sql(
    `insert into public.project_members values('${ids.project}','${ids.pm}','manager',true)`,
  );
  const deniedBefore = Number(
    sql(
      "select count(*) from public.inventory_denials where code='access_denied' and project_id is null and request_id is null",
    ),
  );
  const foreignProbe = command("foreman", {
    action: "verify",
    requestId: randomUUID(),
    lotVersion: 1,
    expectedVersion: 1,
  });
  assert.equal(foreignProbe.code, "denied");
  assert.equal(
    Number(
      sql(
        `select count(*) from public.inventory_denials where code='access_denied' and project_id is null and request_id is null`,
      ),
    ),
    deniedBefore + 1,
  );
  const dry = command("pm", {
    action: "opening",
    materialCode: "TIE",
    material: "Ties",
    yard: "Synthetic North yard",
    quantity: 1000,
    source: "Synthetic drying stock",
    readiness: "drying",
    inspectionAccepted: true,
  }).lotId;
  assert.equal(
    command("foreman", { ...input, lotId: dry }).code,
    "stock_not_ready",
  );

  const beforeInvalid = read("pm").lots.length;
  assert.equal(
    command("pm", {
      action: "opening",
      materialCode: "BAD",
      material: "Invalid fixture",
      yard: "Synthetic",
      quantity: 1.5,
      source: "Synthetic",
    }).code,
    "invalid_input",
  );
  assert.equal(read("pm").lots.length, beforeInvalid);
  const unknownLot = openingLot(),
    unknownRequest = submit(unknownLot);
  assert.equal(verify(unknownRequest).ok, true);
  assert.equal(authorize(unknownRequest).code, "review_required");
  assert.equal(read("pm").lots.find((l) => l.id === unknownLot).balance, 1000);
  assert.equal(
    command("pm", {
      action: "configuration",
      expectedVersion: 1,
      annualRate: 0.08,
      thresholdAmount: 20000,
      currency: "USD",
      source: "Unconfirmed synthetic proposal",
    }).ok,
    true,
  );
  assert.equal(read("pm").finance.configuration.status, "unconfirmed");
  assert.equal(read("pm").finance.evaluation, "incomplete_awaiting_wendy");
  assert.doesNotMatch(
    JSON.stringify(read("foreman")),
    /budget|carrying|threshold|annual_rate|creosote|configuration/,
  );
  // Private event reasons remain available to authorized online readers only.
  const reasonLot = openingLot(), reasonRequest = submit(reasonLot);
  assert.equal(verify(reasonRequest).ok, true);
  const privateReason = "Budget hold USD 2800; landed value USD 68000";
  const rejectionOperation = randomUUID();
  assert.equal(command("pm", { action: "reject", requestId: reasonRequest,
    lotVersion: 1, expectedVersion: 2, reason: privateReason }, rejectionOperation).ok, true);
  assert.equal(read("pm").events.find((e) => e.request_id === reasonRequest && e.action === "reject").reason, privateReason);
  const fieldEvidence = read("foreman");
  assert.equal("reason" in fieldEvidence.events.find((e) => e.request_id === reasonRequest && e.action === "reject"), false);
  assert.ok(fieldEvidence.events.every((e) => !["cost", "configuration"].includes(e.action)));
  assert.equal(JSON.parse(as("pm", `select public.inventory_receipt('${ids.project}','${rejectionOperation}')`)).ok, true);
  assert.equal(command("pm", { action: "reject", requestId: reasonRequest,
    lotVersion: 1, expectedVersion: 2, reason: "Changed private reason" }, rejectionOperation).code, "operation_conflict");
  console.log(
    "PASS: real budget hold 2800; draft CO zero; signed CO +3000 once; explicit rebase/reapproval; 200 headroom; shared source counted once across material lines; pinned posted exposure; concurrent 600+600 never overspends; transactional rollback; current permissions; generic foreign probe; drying denied; legacy DB finance boundary",
  );
  console.log(
    "PASS: real PostgreSQL grants/RLS, current membership, finance isolation, durable denial, recount hold, distinct approvals, receipt replay, immutable ledger, funded source and 1000 → 900 exactly once",
  );
} finally {
  if (created) docker(["rm", "--force", name]);
}
