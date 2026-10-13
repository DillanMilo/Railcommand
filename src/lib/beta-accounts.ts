import { randomUUID } from 'node:crypto';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { z } from 'zod';

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email('Enter a valid email address.'),
  fullName: z.string().trim().max(120).default(''),
  workspaceName: z.string().trim().max(120).default(''),
});
const markerSchema = z.object({
  version: z.literal(1),
  organizationId: z.string().uuid(),
  workspaceName: z.string().min(1).max(140),
});
const MARKER = 'railcommand_beta_account';
const EXISTING_ACCOUNT = 'This email already has an account. Use sign-in or Forgot password; its workspace and permissions have not been changed.';

export type BetaAccountInput = z.infer<typeof inputSchema>;
export type BetaAccountResult = {
  email: string;
  workspaceName: string;
  activationUrl: string;
  reused: boolean;
};

type Profile = { id: string; email: string; role: string; organization_id: string | null };

function check(error: { message: string } | null, message: string): void {
  // Provider errors may contain private details. Return only the operation context.
  if (error) throw new Error(message);
}

function getMarker(user: User) {
  const marker = markerSchema.safeParse(user.app_metadata?.[MARKER]);
  if (!marker.success || user.email_confirmed_at) throw new Error(EXISTING_ACCOUNT);
  return marker.data;
}

function callbackOrigin(siteUrl: string): string {
  const url = new URL(siteUrl);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
    throw new Error('The invitation site URL is not configured securely.');
  }
  if (url.username || url.password) throw new Error('Invalid invitation site URL.');
  return url.origin;
}

/** Server-only provisioning. No existing-project membership is ever added here. */
export async function provisionBetaAccount(
  admin: SupabaseClient,
  rawInput: BetaAccountInput,
  siteUrl: string,
): Promise<BetaAccountResult> {
  const input = inputSchema.parse(rawInput);
  const origin = callbackOrigin(siteUrl);
  const findProfile = () => admin.from('profiles')
    .select('id,email,role,organization_id').eq('email', input.email).maybeSingle<Profile>();
  const existing = await findProfile();
  check(existing.error, 'Could not check the existing account. Try again.');
  let profile = existing.data;
  let user: User;
  let reused = !!profile;

  if (profile) {
    const found = await admin.auth.admin.getUserById(profile.id);
    check(found.error, 'Could not verify the existing account. Try again.');
    if (!found.data.user) throw new Error(EXISTING_ACCOUNT);
    user = found.data.user;
    getMarker(user); // Never attach an unrelated or activated account to a new workspace.
  } else {
    const workspaceName = input.workspaceName || `${input.fullName || input.email.split('@')[0].slice(0, 120)}'s Workspace`;
    const created = await admin.auth.admin.createUser({
      email: input.email,
      email_confirm: false,
      user_metadata: { full_name: input.fullName },
      // Saved atomically with Auth identity: retries use one stable organization UUID.
      app_metadata: { [MARKER]: { version: 1, organizationId: randomUUID(), workspaceName } },
    });
    if (created.error || !created.data.user) {
      // Another request may have won the Auth email uniqueness constraint.
      const winner = await findProfile();
      check(winner.error, 'Could not verify the account. Try again.');
      if (!winner.data) throw new Error('Could not create the account. Try again with the same email.');
      const found = await admin.auth.admin.getUserById(winner.data.id);
      check(found.error, 'Could not verify the account. Try again.');
      if (!found.data.user) throw new Error(EXISTING_ACCOUNT);
      user = found.data.user;
      getMarker(user);
      profile = winner.data;
      reused = true;
    } else {
      user = created.data.user;
      const fresh = await findProfile();
      check(fresh.error, 'Account started. Retry with the same email to finish its workspace.');
      profile = fresh.data;
    }
  }

  const marker = getMarker(user);
  if (user.email?.toLowerCase() !== input.email || !profile || profile.id !== user.id) {
    throw new Error('Could not verify the account profile. Retry with the same email.');
  }
  if (profile.organization_id && profile.organization_id !== marker.organizationId) throw new Error(EXISTING_ACCOUNT);
  if (!['member', 'manager'].includes(profile.role)) throw new Error(EXISTING_ACCOUNT);

  const members = await admin.from('project_members').select('project_id').eq('profile_id', user.id).limit(1);
  check(members.error, 'Could not verify project isolation. Try again.');
  if (members.data?.length) throw new Error(EXISTING_ACCOUNT);

  const owned = await admin.from('projects').select('id').eq('created_by', user.id).limit(1);
  check(owned.error, 'Could not verify the empty workspace. Try again.');
  if (owned.data?.length) throw new Error(EXISTING_ACCOUNT);

  const otherProfiles = await admin.from('profiles').select('id')
    .eq('organization_id', marker.organizationId).neq('id', user.id).limit(1);
  check(otherProfiles.error, 'Could not verify workspace isolation. Try again.');
  if (otherProfiles.data?.length) throw new Error(EXISTING_ACCOUNT);

  const getOrganization = () => admin.from('organizations').select('id,name,tier,is_demo')
    .eq('id', marker.organizationId).maybeSingle<{ id: string; name: string; tier: string; is_demo: boolean }>();
  let organization = await getOrganization();
  check(organization.error, 'Could not verify the workspace. Try again.');
  if (!organization.data) {
    const inserted = await admin.from('organizations').insert({
      id: marker.organizationId, name: marker.workspaceName, type: 'contractor', tier: 'enterprise', is_demo: false,
    });
    if (inserted.error && inserted.error.code !== '23505') {
      throw new Error('Account started. Retry with the same email to finish its workspace.');
    }
    organization = await getOrganization();
    check(organization.error, 'Could not verify the workspace. Try again.');
  }
  if (!organization.data || organization.data.is_demo !== false || organization.data.tier !== 'enterprise') {
    throw new Error('Workspace verification failed. No activation link was issued.');
  }

  const orgProjects = await admin.from('projects').select('id').eq('organization_id', marker.organizationId).limit(1);
  check(orgProjects.error, 'Could not verify the empty workspace. Try again.');
  if (orgProjects.data?.length) throw new Error(EXISTING_ACCOUNT);

  // Compare-and-set protects against another workflow moving this profile meanwhile.
  let update = admin.from('profiles').update({ organization_id: marker.organizationId, role: 'manager' }).eq('id', user.id);
  update = profile.organization_id === null ? update.is('organization_id', null) : update.eq('organization_id', marker.organizationId);
  const linked = await update.select('id,email,role,organization_id').maybeSingle<Profile>();
  check(linked.error, 'Account started. Retry with the same email to finish its workspace.');
  if (!linked.data || linked.data.organization_id !== marker.organizationId || linked.data.role !== 'manager') {
    throw new Error('The account changed while being set up. No activation link was issued.');
  }

  const invitation = await admin.auth.admin.generateLink({ type: 'invite', email: input.email,
    options: { redirectTo: `${origin}/auth/callback?next=%2Freset-password` } });
  check(invitation.error, 'Workspace ready. Retry with the same email to generate its activation link.');
  if (invitation.data.user?.id !== user.id || !invitation.data.properties?.hashed_token) {
    throw new Error('Could not verify the activation link. Try again.');
  }
  const activation = new URL('/auth/callback', origin);
  activation.searchParams.set('token_hash', invitation.data.properties.hashed_token);
  activation.searchParams.set('type', 'invite');
  activation.searchParams.set('next', '/reset-password');
  return { email: input.email, workspaceName: organization.data.name, activationUrl: activation.toString(), reused };
}
