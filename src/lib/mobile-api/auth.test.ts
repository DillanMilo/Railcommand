import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'mocha';
import { mobileJson, mobileOptions, parseBearerAuthorization } from './auth';
import { canCreateMobileDailyLog } from './authorization';

describe('mobile API security boundary', () => {
  it('accepts only one bearer token and never query/cookie fallbacks', () => {
    assert.equal(parseBearerAuthorization('Bearer token-value'), 'token-value');
    assert.equal(parseBearerAuthorization('Basic token-value'), null);
    assert.equal(parseBearerAuthorization('Bearer token one'), null);
    assert.equal(parseBearerAuthorization(null), null);
  });

  it('requires current edit permission and an allowed project role', () => {
    assert.equal(canCreateMobileDailyLog({ organizationRole: 'admin', projectRole: null, canEdit: false }), true);
    assert.equal(canCreateMobileDailyLog({ organizationRole: 'member', projectRole: 'manager', canEdit: true }), true);
    assert.equal(canCreateMobileDailyLog({ organizationRole: 'member', projectRole: 'manager', canEdit: false }), false);
    assert.equal(canCreateMobileDailyLog({ organizationRole: 'member', projectRole: 'inspector', canEdit: true }), false);
  });

  it('lets bearer routes reach their own auth boundary while retaining US geo checks', () => {
    const middleware = readFileSync(
      new URL('../../middleware.ts', import.meta.url),
      'utf8',
    );
    assert.match(middleware, /['"]\/api\/mobile\/v1['"]/);
    assert.match(middleware, /pathname\.startsWith\(['"]\/api\/mobile\/v1\/['"]\)/);
  });

  it('allows only the bundled Capacitor origin through preflight', () => {
    const allowed = mobileOptions(new Request('https://staging.example/api/mobile/v1/bootstrap', {
      method: 'OPTIONS',
      headers: { origin: 'capacitor://localhost' },
    }));
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), 'capacitor://localhost');
    assert.match(allowed.headers.get('access-control-allow-headers') ?? '', /Authorization/i);

    const rejected = mobileOptions(new Request('https://staging.example/api/mobile/v1/bootstrap', {
      method: 'OPTIONS',
      headers: { origin: 'https://untrusted.example' },
    }));
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get('access-control-allow-origin'), null);
  });

  it('adds the exact native origin to authenticated JSON responses', async () => {
    const response = mobileJson({ ok: true });
    assert.equal(response.headers.get('access-control-allow-origin'), 'capacitor://localhost');
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
    assert.match(response.headers.get('vary') ?? '', /Origin/);
    assert.deepEqual(await response.json(), { ok: true });
  });

  it('revalidates identity, permission, parent ownership, and storage paths for queued photos', () => {
    const helper = readFileSync(new URL('./photo-sync.ts', import.meta.url), 'utf8');
    const prepare = readFileSync(
      new URL('../../app/api/mobile/v1/daily-logs/photos/prepare/route.ts', import.meta.url),
      'utf8',
    );
    const finalize = readFileSync(
      new URL('../../app/api/mobile/v1/daily-logs/photos/finalize/route.ts', import.meta.url),
      'utf8',
    );
    assert.match(helper, /operation\.userId !== context\.user\.id/);
    assert.match(helper, /canCreateMobileDailyLog/);
    assert.match(helper, /\.eq\('created_by', context\.user\.id\)/);
    assert.match(prepare, /createSignedUploadUrl\(authorized\.path, \{ upsert: true \}\)/);
    assert.match(finalize, /body\.storage\.path !== authorized\.path/);
    assert.match(finalize, /sync_daily_log_photo_attachment/);
  });
});
