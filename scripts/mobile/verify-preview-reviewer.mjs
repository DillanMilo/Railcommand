// Dated, staging-only API acceptance. No password reset, account/admin operation,
// device access, deployment, or cleanup of existing/synthetic records is performed.
import { access, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseEnv } from 'node:util';
import { spawn } from 'node:child_process';
import { emitKeypressEvents } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

export const PREVIEW = 'https://railcommand-mobile-staging-92syl0mro-dillans-projects-f662840b.vercel.app';
const SUPABASE = 'https://rxuvchdqbzvovqijvfhx.supabase.co';
const REVIEWER = 'app-review@railcommand.io';
const USER = 'ee8dee3d-d28e-4f0b-a40e-25f55a3dc4b0';
const PROJECT = '20000000-0000-4000-8000-000000000001';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLI = '/Users/dillanmilosevich/.npm/_npx/dcc2f77f288137c2/node_modules/vercel/dist/index.js';
const CURL_DIRECTORY = fileURLToPath(new URL('./preview-curl/', import.meta.url));
const RESULT = new URL('../../.vercel/phase5-signed-in-result.json', import.meta.url);

export function safeAuthDiagnostic(error) {
  // Only known machine codes, never server messages, URLs, tokens, or payloads.
  const codes = new Set(['invalid_credentials', 'email_not_confirmed', 'user_banned',
    'captcha_failed', 'over_request_rate_limit', 'request_timeout', 'unexpected_failure',
    'validation_failed', 'email_provider_disabled', 'provider_disabled', 'bad_jwt',
    'no_authorization', 'session_expired', 'refresh_token_not_found']);
  const types = new Set(['AuthApiError', 'AuthRetryableFetchError', 'AuthUnknownError',
    'AuthInvalidCredentialsError', 'AuthSessionMissingError']);
  return {
    code: codes.has(error?.code) ? error.code : 'unclassified',
    status: Number.isInteger(error?.status) && error.status >= 0 && error.status <= 599 ? error.status : null,
    type: types.has(error?.name) ? error.name : 'unclassified',
  };
}

export function safeApiDiagnostic(data) {
  const messages = new Set(['Not authenticated', 'Could not verify project access',
    'Could not list projects', 'Project membership required', 'Could not load project field data',
    'Access is restricted to users located within the United States.',
    'Access is restricted because this network appears to use a VPN, proxy, Tor, or blocked hosting provider.']);
  return messages.has(data?.error) ? data.error : 'Unclassified API error; response body withheld';
}

export function safeDatabaseDiagnostic(result) {
  const code = result.error?.code;
  return {
    status: Number.isInteger(result.status) ? result.status : null,
    code: typeof code === 'string' && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(code) ? code : result.error ? 'unclassified' : null,
  };
}

// Match the app's existing single 401 refresh/replay. No retry of permission
// denials, expected negative checks, transport failures, or a second 401.
export async function requestWithSessionRecovery(execute, refresh, enabled) {
  const response = await execute();
  if (!enabled || response.status !== 401 || !await refresh()) return response;
  return execute();
}

export function curlConfig(body, token, headers = {}) {
  const lines = ['silent', 'show-error', 'include', 'max-time = 25', 'proto = "=https"'];
  // curl's config syntax accepts JSON-style string escaping. All secrets and
  // request data go through stdin, never command arguments, files, or shell text.
  const quote = (value) => JSON.stringify(String(value));
  if (token) lines.push(`header = ${quote(`Authorization: Bearer ${token}`)}`);
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== 'idempotency-key' || !/^[a-f0-9-]{36}$/i.test(value)) throw new Error('Unsupported QA request header');
    lines.push(`header = ${quote(`${key}: ${value}`)}`);
  }
  if (body !== undefined) lines.push('header = "Content-Type: application/json"', 'request = "POST"', `data-binary = ${quote(JSON.stringify(body))}`);
  return lines.join('\n') + '\n';
}

export function parseResponse(raw) {
  let rest = raw;
  let status;
  let headers;
  do {
    const end = rest.indexOf('\r\n\r\n');
    if (end < 0) throw new Error('Preview response headers unavailable');
    const block = rest.slice(0, end);
    status = Number(block.match(/^HTTP\/\S+ (\d{3})/)?.[1]);
    headers = block.toLowerCase();
    rest = rest.slice(end + 4);
  } while (rest.startsWith('HTTP/'));
  if (!status) throw new Error('Invalid Preview HTTP status');
  if (!/^cache-control:.*\bno-store\b/m.test(headers)) throw new Error('Preview response is missing no-store');
  if (!/^content-type: application\/json/m.test(headers)) throw new Error('Preview response is not JSON');
  return { status, data: JSON.parse(rest) };
}

async function request(path, body, token, headers) {
  if (!/^\/api\/mobile\/v1\/[a-z0-9/?=&_-]+$/i.test(path)) throw new Error('Request outside mobile API boundary');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI, 'curl', path, '--deployment', PREVIEW,
      '--scope', 'dillans-projects-f662840b', '--', '--config', '-'],
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env,
      PATH: `${CURL_DIRECTORY}:${process.env.PATH ?? '/usr/bin:/bin'}`, VERCEL_TELEMETRY_DISABLED: '1' } });
    let raw = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Preview request timed out')); }, 45_000);
    child.stdout.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 4 * 1024 * 1024) { child.kill(); reject(new Error('Preview response exceeded QA size bound')); }
    });
    child.stderr.resume(); // Never echo CLI debug output or response bodies.
    child.stdin.on('error', () => {});
    child.on('error', () => { clearTimeout(timeout); reject(new Error('Could not start Preview request')); });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) return reject(new Error(`Preview transport failed (${code})`));
      try { resolve(parseResponse(raw)); } catch { reject(new Error('Preview response failed JSON/no-store validation')); }
    });
    child.stdin.end(curlConfig(body, token, headers));
  });
}

export function hiddenPassword() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Run this command in an interactive Terminal; never pipe a password');
  return new Promise((resolve, reject) => {
    let value = '';
    const originalRaw = process.stdin.isRaw;
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdout.write(`Password for ${REVIEWER} (typing hidden; Enter to continue): `);
    const timer = setTimeout(() => finish(new Error('Password prompt expired; no sign-in attempted')), 5 * 60_000);
    function finish(error) {
      clearTimeout(timer);
      process.stdin.removeListener('keypress', onKey);
      process.stdin.setRawMode(originalRaw);
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) { value = ''; reject(error); } else { resolve(value); value = ''; }
    }
    function onKey(text, key) {
      if (key?.ctrl && ['c', 'd'].includes(key.name)) return finish(new Error('Cancelled; no sign-in attempted'));
      if (key?.ctrl && key.name === 'u') { value = ''; return; }
      if (key?.ctrl && key.name === 'w') { value = value.replace(/\S+\s*$/u, ''); return; }
      if (key?.name === 'return' || key?.name === 'enter') return finish(value ? undefined : new Error('Empty password; no sign-in attempted'));
      if (key?.name === 'backspace') { value = [...value].slice(0, -1).join(''); return; }
      if (!key?.ctrl && !key?.meta && text && !/[\x00-\x1f\x7f]/.test(text)) value += text;
    }
    process.stdin.on('keypress', onKey);
    process.stdin.resume();
  });
}

async function main() {
  const results = { startedAt: new Date().toISOString(), preview: PREVIEW, projectId: PROJECT,
    classification: 'Online-only API acceptance; not native offline/device evidence', checks: [], status: 'incomplete' };
  const report = (label, details) => {
    // Callers may report only synthetic IDs/counts and static assertion labels.
    results.checks.push({ label, ...(details === undefined ? {} : { details }) });
    console.log(label, details === undefined ? '' : JSON.stringify(details));
  };
  let client;
  let sessionCreated = false;
  let token;
  let stage = 'preflight';
  try {
    const env = parseEnv(await readFile(new URL('../../.vercel/.env.preview.local', import.meta.url), 'utf8'));
    const link = JSON.parse(await readFile(new URL('../../.vercel/project.json', import.meta.url), 'utf8'));
    if (env.NEXT_PUBLIC_SUPABASE_URL !== SUPABASE || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || link.projectId !== 'prj_JWLbG1P1z06rCpN1bDI2DuugVpCy' || link.orgId !== 'team_s16JIS0pr4dx8WxpQZ6jAD2R') throw new Error('Staging configuration mismatch');
    const publicKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!publicKey.startsWith('sb_publishable_')) {
      const claim = JSON.parse(Buffer.from(publicKey.split('.')[1] ?? '', 'base64url').toString());
      if (claim.role !== 'anon' || claim.ref !== 'rxuvchdqbzvovqijvfhx') throw new Error('Refusing a non-public staging API key');
    }
    await access(`${CURL_DIRECTORY}/curl`, constants.X_OK);
    const workflowModule = await import('./verify-preview-workflows.ts');
    const verifyPreviewWorkflows = workflowModule.verifyPreviewWorkflows
      ?? workflowModule.default?.verifyPreviewWorkflows;
    if (typeof verifyPreviewWorkflows !== 'function') throw new Error('Preview workflow verifier unavailable');
    const api = async (path, body, expectedStatus = 200, headers = {}) => {
      stage = `${body === undefined ? 'GET' : 'POST'} ${path.split('?')[0]} (expected ${expectedStatus})`;
      const response = await requestWithSessionRecovery(
        () => request(path, body, token, headers),
        async () => {
          if (!client || !token) return false;
          const renewed = await client.auth.refreshSession();
          if (renewed.error || renewed.data.user?.id !== USER || !renewed.data.session) {
            report('API session recovery did not succeed; no repeated retry');
            return false;
          }
          token = renewed.data.session.access_token;
          report('API session recovery: one refresh and same-request retry');
          return true;
        },
        Boolean(token) && expectedStatus !== 401,
      );
      if (response.status !== expectedStatus) {
        report('API rejection diagnostic (allowlisted message only)', { status: response.status, reason: safeApiDiagnostic(response.data) });
        throw new Error(`Unexpected HTTP ${response.status}`);
      }
      return response.data;
    };
    await api('/api/mobile/v1/bootstrap', undefined, 401);
    report('PASS exact Preview transport, no-store, and unauthenticated rejection');
    if (process.argv.includes('--check')) { console.log('Preflight only: no password or signed-in mutation used.'); return; }
    const diagnoseOnly = process.argv.length === 3 && process.argv[2] === '--diagnose';
    if (process.argv.length > 2 && !diagnoseOnly) throw new Error('No password or custom targets are accepted as command arguments');
    console.log(diagnoseOnly ? 'Staging access diagnostics only: no records will be created.'
      : 'Staging only. Creates 1 synthetic daily log, 1 photo, 1 RFI, and 1 Submittal; retains their IDs.');
    console.log('No production/device changes, password reset, account changes, or deletion.');
    stage = 'reviewer sign-in';
    client = createClient(SUPABASE, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(25_000) }) },
    });
    let password = await hiddenPassword();
    let signIn;
    try { signIn = await client.auth.signInWithPassword({ email: REVIEWER, password }); } finally { password = ''; }
    sessionCreated = Boolean(signIn.data.session);
    if (signIn.error || !signIn.data.session) {
      report('Sign-in diagnostic (no secrets)', safeAuthDiagnostic(signIn.error));
      throw new Error('Reviewer sign-in unsuccessful; no reset or retry attempted');
    }
    if (signIn.data.user.id !== USER) throw new Error('Reviewer identity mismatch');
    stage = 'reviewer session refresh';
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error || refreshed.data.user?.id !== USER || !refreshed.data.session) {
      report('Session-refresh diagnostic (no secrets)', safeAuthDiagnostic(refreshed.error));
      throw new Error('Reviewer refresh failed');
    }
    token = refreshed.data.session.access_token;
    report('PASS existing staging reviewer sign-in and session refresh');
    if (diagnoseOnly) {
      stage = 'read-only staging access diagnostics';
      const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      const identity = { authenticatedRole: claims.role === 'authenticated', reviewerSubject: claims.sub === USER,
        stagingIssuer: claims.iss === `${SUPABASE}/auth/v1` };
      report('Access token identity checks (booleans only)', identity);
      if (!Object.values(identity).every(Boolean)) throw new Error('Preview QA: access token identity mismatch');
      // Match the stateless server client, not the password client's session state.
      const reader = createClient(SUPABASE, publicKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${token}` },
          fetch: (url, options) => fetch(url, { ...options, signal: AbortSignal.timeout(25_000) }) },
      });
      const profile = await reader.from('profiles').select('role').eq('id', USER).single();
      report('Direct Data API profile query', { ...safeDatabaseDiagnostic(profile), managerRole: profile.data?.role === 'manager' });
      const memberships = await reader.from('project_members')
        .select('project_id, project_role, can_edit, project:projects(id, name, status, location, client, start_date, target_end_date, budget_total, budget_spent, created_at)')
        .eq('profile_id', USER);
      const member = memberships.data?.find((row) => row.project_id === PROJECT);
      report('Direct Data API exact bootstrap membership query', { ...safeDatabaseDiagnostic(memberships),
        syntheticMembership: Boolean(member), managerRole: member?.project_role === 'manager', canEdit: member?.can_edit === true,
        projectVisible: Boolean(member?.project) });
      const bootstrap = await api(`/api/mobile/v1/bootstrap?projectId=${PROJECT}`);
      if (bootstrap.userId !== USER || bootstrap.activeProjectId !== PROJECT) throw new Error('Preview QA: diagnostic bootstrap identity mismatch');
      if (profile.error || memberships.error) throw new Error('Preview QA: direct Data API query failed');
      report('PASS read-only diagnostic bootstrap; no workflow records created');
      results.status = 'diagnostics-passed';
      return;
    }
    await verifyPreviewWorkflows({ api, supabase: client, userId: USER, projectId: PROJECT, report });
    results.status = 'passed';
  } catch (error) {
    results.status = 'failed';
    // Never serialize exception objects, API bodies, passwords, or tokens.
    results.failure = { stage, message: error instanceof Error && /^(Unexpected HTTP \d+|Preview QA: [a-zA-Z0-9/; ._-]+|Reviewer sign-in unsuccessful; no reset or retry attempted|Cancelled; no sign-in attempted|Empty password; no sign-in attempted|Password prompt expired; no sign-in attempted)$/.test(error.message)
      ? error.message : 'Check failed; inspect the last safe check and source assertion. Raw error withheld.' };
    console.error('STOP', JSON.stringify(results.failure));
    process.exitCode = 1;
  } finally {
    token = undefined;
    if (client && sessionCreated) {
      const { error } = await client.auth.signOut({ scope: 'local' }).catch(() => ({ error: true }));
      report(error ? 'WARNING could not revoke this temporary QA session' : 'Temporary QA session ended; other device sessions unchanged');
    } else if (!process.argv.includes('--check')) {
      report('No signed-in QA session was created; other device sessions unchanged');
    }
    if (!process.argv.includes('--check')) {
      results.finishedAt = new Date().toISOString();
      await writeFile(RESULT, JSON.stringify(results, null, 2) + '\n', { mode: 0o600 });
      console.log(`Sanitized results: ${fileURLToPath(RESULT)}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
