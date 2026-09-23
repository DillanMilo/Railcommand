import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, it } from 'mocha';
import {
  evaluateMobilePilotAccess,
  isMobileMutation,
  isProductionMobileBackend,
  readUnverifiedBearerSubject,
} from './pilot-gate';

const productionUrl = 'https://gwvftrrknusdfdgiwuij.supabase.co';
const stagingUrl = 'https://rxuvchdqbzvovqijvfhx.supabase.co';
const allowedUser = '10000000-0000-4000-8000-000000000001';
const otherUser = '20000000-0000-4000-8000-000000000002';
const mobileRouteRoot = resolve('src/app/api/mobile/v1');

const expectedRouteMethods = [
  'account/deletion-request#GET',
  'account/deletion-request#POST',
  'account/deletion-request/cancel#POST',
  'bootstrap#GET',
  'daily-logs/photos/finalize#POST',
  'daily-logs/photos/prepare#POST',
  'daily-logs/sync#POST',
  'devices/push-token#POST',
  'earthcam/embeds#POST',
  'earthcam/embeds/delete#POST',
  'invitations/[token]#GET',
  'invitations/[token]#POST',
  'railbot#POST',
  'railbot/confirm#POST',
  'railbot/conversations#GET',
  'railbot/conversations/[id]#DELETE',
  'railbot/conversations/[id]#GET',
  'railbot/transcribe#POST',
  'records/attachment#GET',
  'records/create#POST',
  'records/detail#GET',
  'records/options#GET',
  'reports/pdf#POST',
  'web-session#POST',
].sort();

function actualRouteMethods(directory = mobileRouteRoot): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return actualRouteMethods(path);
    if (entry.name !== 'route.ts') return [];
    const route = relative(mobileRouteRoot, directory).replaceAll('\\', '/');
    const methods = [...readFileSync(path, 'utf8').matchAll(
      /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
    )].map((match) => match[1]).filter((method) => method !== 'OPTIONS');
    return methods.map((method) => `${route}#${method}`);
  });
}

function bearer(subject: string) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `Bearer ${encode({ alg: 'none' })}.${encode({ sub: subject })}.synthetic`;
}

function decide(options: {
  url?: string;
  mode?: string;
  users?: string;
  user?: string;
  method?: string;
  path?: string;
  backend?: string;
} = {}) {
  return evaluateMobilePilotAccess({
    authorization: bearer(options.user ?? allowedUser),
    env: {
      MOBILE_BACKEND_ENV: options.backend,
      MOBILE_PILOT_MODE: options.mode,
      MOBILE_PILOT_USER_IDS: options.users,
      NEXT_PUBLIC_SUPABASE_URL: options.url ?? productionUrl,
    },
    method: options.method ?? 'GET',
    pathname: options.path ?? '/api/mobile/v1/bootstrap',
  });
}

describe('production mobile pilot gate', () => {
  it('recognizes the existing production project and explicit production backend', () => {
    assert.equal(isProductionMobileBackend({ NEXT_PUBLIC_SUPABASE_URL: productionUrl }), true);
    assert.equal(isProductionMobileBackend({ NEXT_PUBLIC_SUPABASE_URL: stagingUrl }), false);
    assert.equal(isProductionMobileBackend({ MOBILE_BACKEND_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: 'https://db.example.com' }), true);
  });

  it('leaves staging unchanged and lets route authentication handle missing credentials', () => {
    assert.deepEqual(decide({ url: stagingUrl }), { allowed: true });
    assert.deepEqual(evaluateMobilePilotAccess({
      authorization: null,
      env: { NEXT_PUBLIC_SUPABASE_URL: productionUrl, MOBILE_PILOT_MODE: 'read-only', MOBILE_PILOT_USER_IDS: allowedUser },
      method: 'GET',
      pathname: '/api/mobile/v1/bootstrap',
    }), { allowed: true });
  });

  it('fails closed when production mode or the UUID allowlist is absent or malformed', () => {
    assert.deepEqual(decide(), { allowed: false, reason: 'configuration' });
    assert.deepEqual(decide({ mode: 'disabled', users: allowedUser }), { allowed: false, reason: 'disabled' });
    assert.deepEqual(decide({ mode: 'read-only', users: 'not-an-email-or-uuid' }), { allowed: false, reason: 'configuration' });
  });

  it('allows only listed users and blocks writes during the read-only pilot', () => {
    assert.deepEqual(decide({ mode: 'read-only', users: allowedUser }), { allowed: true });
    assert.deepEqual(decide({ mode: 'read-only', users: allowedUser, user: otherUser }), { allowed: false, reason: 'user' });
    assert.deepEqual(decide({ mode: 'read-only', users: allowedUser, method: 'POST', path: '/api/mobile/v1/daily-logs/sync' }), { allowed: false, reason: 'read-only' });
    assert.deepEqual(decide({ mode: 'read-write', users: allowedUser, method: 'POST', path: '/api/mobile/v1/daily-logs/sync' }), { allowed: true });
  });

  it('classifies report generation as read-only and unknown non-GET routes as mutations', () => {
    assert.equal(isMobileMutation('/api/mobile/v1/reports/pdf', 'POST'), false);
    assert.equal(isMobileMutation('/api/mobile/v1/future-route', 'POST'), true);
    assert.equal(isMobileMutation('/api/mobile/v1/web-session', 'POST'), true);
    assert.deepEqual(decide({ mode: 'read-only', users: allowedUser, method: 'POST', path: '/api/mobile/v1/reports/pdf' }), { allowed: true });
  });

  it('keeps the complete mobile route inventory explicitly classified', () => {
    assert.deepEqual(actualRouteMethods().sort(), expectedRouteMethods);

    const readOnly = [
      ['/api/mobile/v1/railbot/conversations', 'GET'],
      ['/api/mobile/v1/railbot/conversations/id', 'GET'],
      ['/api/mobile/v1/bootstrap', 'GET'],
      ['/api/mobile/v1/records/options', 'GET'],
      ['/api/mobile/v1/records/detail', 'GET'],
      ['/api/mobile/v1/records/attachment', 'GET'],
      ['/api/mobile/v1/account/deletion-request', 'GET'],
      ['/api/mobile/v1/invitations/synthetic-token', 'GET'],
      ['/api/mobile/v1/reports/pdf', 'POST'],
    ] as const;
    const mutations = [
      ['/api/mobile/v1/railbot', 'POST'],
      ['/api/mobile/v1/railbot/confirm', 'POST'],
      ['/api/mobile/v1/railbot/transcribe', 'POST'],
      ['/api/mobile/v1/railbot/conversations/id', 'DELETE'],
      ['/api/mobile/v1/records/create', 'POST'],
      ['/api/mobile/v1/daily-logs/sync', 'POST'],
      ['/api/mobile/v1/daily-logs/photos/prepare', 'POST'],
      ['/api/mobile/v1/daily-logs/photos/finalize', 'POST'],
      ['/api/mobile/v1/devices/push-token', 'POST'],
      ['/api/mobile/v1/account/deletion-request', 'POST'],
      ['/api/mobile/v1/account/deletion-request/cancel', 'POST'],
      ['/api/mobile/v1/invitations/synthetic-token', 'POST'],
      ['/api/mobile/v1/earthcam/embeds', 'POST'],
      ['/api/mobile/v1/earthcam/embeds/delete', 'POST'],
    ] as const;

    for (const [path, method] of readOnly) assert.equal(isMobileMutation(path, method), false, `${method} ${path}`);
    for (const [path, method] of mutations) assert.equal(isMobileMutation(path, method), true, `${method} ${path}`);
  });

  it('extracts only UUID subjects and does not treat the prefilter as authentication', () => {
    assert.equal(readUnverifiedBearerSubject(bearer(allowedUser)), allowedUser);
    assert.equal(readUnverifiedBearerSubject(bearer('app-review@railcommand.io')), null);
    assert.equal(readUnverifiedBearerSubject('Bearer malformed'), null);
  });
});
