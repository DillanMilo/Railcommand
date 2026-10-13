import assert from 'node:assert/strict';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { provisionBetaAccount } from './beta-accounts';
import { getGateSignature, isDashboardSession } from '../app/client/gate';

type Row = Record<string, unknown>;
type Result = { data: Row[] | Row | null; error: { message: string; code?: string } | null };

class Fixture {
  rows: Record<string, Row[]> = { profiles: [], organizations: [], project_members: [], projects: [] };
  users: User[] = [];
  invitations = 0;
  failOrgInsert = false;
  moveProfileDuringLink = false;
  admin = {
    from: (table: string) => new Query(this, table),
    auth: { admin: {
      getUserById: async (id: string) => ({ data: { user: this.users.find(u => u.id === id) }, error: null }),
      createUser: async (input: { email: string; app_metadata: Row; user_metadata: Row }) => {
        if (this.users.some(u => u.email === input.email)) return { data: { user: null }, error: { message: 'Duplicate email' } };
        const user = { ...input, id: 'test-user', aud: 'authenticated', created_at: '2026-10-13T00:00:00Z' } as User;
        this.users.push(user);
        this.rows.profiles.push({ id: user.id, email: user.email, role: 'member', organization_id: null });
        return { data: { user }, error: null };
      },
      generateLink: async (input: { email: string }) => {
        this.invitations++;
        return { data: { user: this.users.find(u => u.email === input.email), properties: { hashed_token: 'private-token' } }, error: null };
      },
    } },
  } as unknown as SupabaseClient;
}

class Query implements PromiseLike<Result> {
  conditions: Array<(row: Row) => boolean> = [];
  updateValues?: Row;
  insertValues?: Row;
  constructor(private fixture: Fixture, private table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) { this.conditions.push(row => row[key] === value); return this; }
  neq(key: string, value: unknown) { this.conditions.push(row => row[key] !== value); return this; }
  is(key: string, value: unknown) { return this.eq(key, value); }
  limit() { return this; }
  insert(row: Row) { this.insertValues = row; return this; }
  update(row: Row) { this.updateValues = row; return this; }
  execute(): Result {
    const rows = this.fixture.rows[this.table];
    if (!rows) throw new Error('Unexpected table access: ' + this.table);
    if (this.insertValues) {
      if (this.fixture.failOrgInsert) { this.fixture.failOrgInsert = false; return { data: null, error: { message: 'Transient failure' } }; }
      if (rows.some(row => row.id === this.insertValues?.id)) return { data: null, error: { code: '23505', message: 'Duplicate ID' } };
      rows.push({ ...this.insertValues });
    }
    if (this.updateValues && this.fixture.moveProfileDuringLink) rows[0].organization_id = 'another-workspace';
    const matched = rows.filter(row => this.conditions.every(test => test(row)));
    if (this.updateValues) matched.forEach(row => Object.assign(row, this.updateValues));
    return { data: matched.map(row => ({ ...row })), error: null };
  }
  async maybeSingle() {
    const result = this.execute();
    return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
  }
  then<A = Result, B = never>(fulfilled?: ((result: Result) => A | PromiseLike<A>) | null, rejected?: ((reason: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.execute()).then(fulfilled, rejected);
  }
}

const input = { email: '  Person@Example.com ', fullName: 'Person', workspaceName: 'Independent Supply' };
const origin = 'https://railcommand.io';

describe('isolated beta account provisioning', () => {
  it('needs only an email and safely derives a separate workspace name', async () => {
    const f = new Fixture();
    const result = await provisionBetaAccount(f.admin, { email: 'new-person@example.com', fullName: '', workspaceName: '' }, origin);
    assert.equal(result.workspaceName, "new-person's Workspace");
    assert.equal(f.rows.organizations.length, 1);
    assert.deepEqual(f.rows.project_members, []);
  });
  it('creates one real enterprise workspace and a recipient password link without project memberships', async () => {
    const f = new Fixture();
    const result = await provisionBetaAccount(f.admin, input, origin);
    assert.equal(result.email, 'person@example.com');
    assert.equal(result.workspaceName, 'Independent Supply');
    assert.equal(f.users.length, 1);
    assert.equal(f.rows.organizations.length, 1);
    assert.equal(f.rows.organizations[0].tier, 'enterprise');
    assert.equal(f.rows.organizations[0].is_demo, false);
    assert.equal(f.rows.profiles[0].role, 'manager');
    assert.equal(f.rows.profiles[0].organization_id, f.rows.organizations[0].id);
    assert.deepEqual(f.rows.project_members, []);
    assert.deepEqual(f.rows.projects, []);
    const url = new URL(result.activationUrl);
    assert.equal(url.origin, origin);
    assert.equal(url.pathname, '/auth/callback');
    assert.equal(url.searchParams.get('type'), 'invite');
    assert.equal(url.searchParams.get('next'), '/reset-password');
  });
  it('repeated submissions reuse the pending account and workspace without changing its name', async () => {
    const f = new Fixture();
    await provisionBetaAccount(f.admin, input, origin);
    const result = await provisionBetaAccount(f.admin, { ...input, workspaceName: 'Different company' }, origin);
    assert.equal(result.reused, true);
    assert.equal(result.workspaceName, 'Independent Supply');
    assert.equal(f.users.length, 1);
    assert.equal(f.rows.organizations.length, 1);
  });
  it('recovers a partial workspace failure with the same durable Auth identity', async () => {
    const f = new Fixture(); f.failOrgInsert = true;
    await assert.rejects(provisionBetaAccount(f.admin, input, origin), /Retry with the same email/);
    assert.equal(f.invitations, 0);
    await provisionBetaAccount(f.admin, input, origin);
    assert.equal(f.users.length, 1);
    assert.equal(f.rows.organizations.length, 1);
  });
  it('concurrent submissions cannot create multiple accounts or workspaces', async () => {
    const f = new Fixture();
    const results = await Promise.allSettled([provisionBetaAccount(f.admin, input, origin), provisionBetaAccount(f.admin, input, origin)]);
    assert.ok(results.some(r => r.status === 'fulfilled'));
    assert.equal(f.users.length, 1);
    assert.equal(f.rows.organizations.length, 1);
    assert.deepEqual(f.rows.project_members, []);
  });
  it('rejects an activated account without creating a new workspace or resetting access', async () => {
    const f = new Fixture(); await provisionBetaAccount(f.admin, input, origin);
    f.users[0].email_confirmed_at = '2026-10-13T00:00:00Z'; f.invitations = 0;
    await assert.rejects(provisionBetaAccount(f.admin, input, origin), /already has an account/);
    assert.equal(f.invitations, 0);
    assert.equal(f.rows.organizations.length, 1);
  });
  it('rejects unrelated pending users even when user_metadata imitates the provisioning marker', async () => {
    const f = new Fixture(); await provisionBetaAccount(f.admin, input, origin);
    f.users[0].user_metadata = { ...f.users[0].app_metadata }; f.users[0].app_metadata = {}; f.invitations = 0;
    await assert.rejects(provisionBetaAccount(f.admin, input, origin), /already has an account/);
    assert.equal(f.invitations, 0);
  });
  for (const scope of ['different organization', 'project membership', 'owned project', 'other workspace user', 'workspace project', 'admin role']) {
    it('refuses existing access scope: ' + scope, async () => {
      const f = new Fixture(); await provisionBetaAccount(f.admin, input, origin); f.invitations = 0;
      const org = f.rows.organizations[0].id;
      if (scope === 'different organization') f.rows.profiles[0].organization_id = 'foreign-org';
      if (scope === 'project membership') f.rows.project_members.push({ profile_id: 'test-user', project_id: 'foreign-project' });
      if (scope === 'owned project') f.rows.projects.push({ id: 'project', created_by: 'test-user' });
      if (scope === 'other workspace user') f.rows.profiles.push({ id: 'other-user', organization_id: org });
      if (scope === 'workspace project') f.rows.projects.push({ id: 'project', organization_id: org });
      if (scope === 'admin role') f.rows.profiles[0].role = 'admin';
      const before = structuredClone(f.rows);
      await assert.rejects(provisionBetaAccount(f.admin, input, origin), /already has an account/);
      assert.deepEqual(f.rows, before);
      assert.equal(f.invitations, 0);
    });
  }
  it('does not overwrite a concurrent profile assignment or issue its activation link', async () => {
    const f = new Fixture(); f.moveProfileDuringLink = true;
    await assert.rejects(provisionBetaAccount(f.admin, input, origin), /account changed/);
    assert.equal(f.rows.profiles[0].organization_id, 'another-workspace');
    assert.equal(f.invitations, 0);
  });
  it('validates fields and trusted callback origin before any creation', async () => {
    const f = new Fixture();
    await assert.rejects(provisionBetaAccount(f.admin, { ...input, email: 'bad' }, origin));
    await assert.rejects(provisionBetaAccount(f.admin, input, 'http://foreign.example'));
    assert.equal(f.users.length, 0);
  });
});

describe('owner console invitation authorization', () => {
  it('accepts only the current dashboard signature and fails closed when unconfigured', () => {
    const previous = process.env.ADMIN_DASHBOARD_PASSWORD;
    try {
      process.env.ADMIN_DASHBOARD_PASSWORD = 'synthetic-console-password';
      assert.equal(isDashboardSession(getGateSignature() ?? undefined), true);
      assert.equal(isDashboardSession(undefined), false);
      assert.equal(isDashboardSession('forged-cookie'), false);
      delete process.env.ADMIN_DASHBOARD_PASSWORD;
      assert.equal(isDashboardSession('forged-cookie'), false);
    } finally {
      if (previous === undefined) delete process.env.ADMIN_DASHBOARD_PASSWORD;
      else process.env.ADMIN_DASHBOARD_PASSWORD = previous;
    }
  });
});
