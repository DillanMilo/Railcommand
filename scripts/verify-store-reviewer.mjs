import { createClient } from '@supabase/supabase-js';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const supabaseUrl = required('NEXT_PUBLIC_SUPABASE_URL');
const publishableKey = required('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const apiBaseUrl = required('NEXT_PUBLIC_APP_URL');
const expectedProjectRef = required('STORE_REVIEW_EXPECTED_SUPABASE_PROJECT_REF').toLowerCase();
const expectedApiHost = required('STORE_REVIEW_EXPECTED_API_HOST').toLowerCase();
const reviewerEmail = required('STORE_REVIEWER_EMAIL').toLowerCase();
const reviewerPassword = required('STORE_REVIEWER_PASSWORD');

if (new URL(supabaseUrl).hostname !== `${expectedProjectRef}.supabase.co`) {
  throw new Error('Refusing to verify reviewer access against an unconfirmed Supabase project');
}
if (new URL(apiBaseUrl).hostname !== expectedApiHost) {
  throw new Error('Refusing to verify reviewer access against an unconfirmed API host');
}
if (reviewerEmail.endsWith('.test') || reviewerEmail.endsWith('.invalid')) {
  throw new Error('The permanent reviewer account must use a real inbox for password recovery');
}

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const signIn = await supabase.auth.signInWithPassword({
  email: reviewerEmail,
  password: reviewerPassword,
});
if (signIn.error || !signIn.data.session) {
  throw signIn.error ?? new Error('Reviewer sign-in did not return a session');
}

const refresh = await supabase.auth.refreshSession({
  refresh_token: signIn.data.session.refresh_token,
});
if (refresh.error || !refresh.data.session) {
  throw refresh.error ?? new Error('Reviewer session could not be refreshed');
}

const bootstrapResponse = await fetch(`${apiBaseUrl}/api/mobile/v1/bootstrap`, {
  headers: { authorization: `Bearer ${refresh.data.session.access_token}` },
});
if (!bootstrapResponse.ok) {
  const detail = (await bootstrapResponse.text()).slice(0, 300).replaceAll(/\s+/g, ' ').trim();
  throw new Error(
    `Reviewer bootstrap failed with ${bootstrapResponse.status}${detail ? `: ${detail}` : ''}`,
  );
}
if (bootstrapResponse.headers.get('cache-control') !== 'no-store, max-age=0') {
  throw new Error('Reviewer bootstrap is not explicitly no-store');
}
const bootstrap = await bootstrapResponse.json();
if (bootstrap.userId !== refresh.data.user.id) throw new Error('Reviewer bootstrap user mismatch');
if (!Array.isArray(bootstrap.projects) || bootstrap.projects.length === 0) {
  throw new Error('Reviewer account has no synthetic project access');
}

let passwordResetRequested = false;
if (process.env.STORE_REVIEW_SEND_PASSWORD_RESET === 'true') {
  const { error } = await supabase.auth.resetPasswordForEmail(reviewerEmail, {
    redirectTo: 'railcommand://reset-password',
  });
  if (error) throw error;
  passwordResetRequested = true;
}

await supabase.auth.signOut({ scope: 'local' });

console.log(JSON.stringify({
  reviewerSignIn: true,
  sessionRefresh: true,
  syntheticProjectCount: bootstrap.projects.length,
  passwordResetRequested,
  nextStep: passwordResetRequested
    ? 'Confirm delivery, link expiry, deep-link opening, and one-use behavior in the real inbox.'
    : 'Set STORE_REVIEW_SEND_PASSWORD_RESET=true only during the final inbox-delivery test.',
}, null, 2));
