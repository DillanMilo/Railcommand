import test from 'node:test';
import assert from 'node:assert/strict';
import { curlConfig, parseResponse, PREVIEW, safeAuthDiagnostic, safeApiDiagnostic, safeDatabaseDiagnostic, requestWithSessionRecovery } from './verify-preview-reviewer.mjs';

const response = (body, extra = '') => `HTTP/2 200\r\ncontent-type: application/json\r\ncache-control: no-store, max-age=0\r\n${extra}\r\n${JSON.stringify(body)}`;
test('dated harness targets only the approved unique staging Preview', () => {
  assert.equal(PREVIEW, 'https://railcommand-mobile-staging-92syl0mro-dillans-projects-f662840b.vercel.app');
});
test('stdin config escapes JSON content and keeps body within one config line', () => {
  const body = { text: 'line\n"quote"\\path', value: 0 };
  const config = curlConfig(body, 'synthetic-token', { 'Idempotency-Key': '20000000-0000-4000-8000-000000000001' });
  assert.equal(config.split('\n').filter((line) => line.startsWith('data-binary')).length, 1);
  assert.deepEqual(JSON.parse(JSON.parse(config.split('data-binary = ')[1].trim())), body);
  assert.match(config, /proto = "=https"/);
  assert.doesNotMatch(config, /location|verbose|trace/);
});
test('additional header names and newline values are rejected', () => {
  assert.throws(() => curlConfig(undefined, '', { Authorization: 'wrong' }));
  assert.throws(() => curlConfig(undefined, '', { 'Idempotency-Key': 'x\nurl = https://example.test' }));
});
test('JSON no-store response is parsed without exposing headers', () => {
  assert.deepEqual(parseResponse(response({ ok: true })), { status: 200, data: { ok: true } });
});
test('CONNECT and interim headers do not hide final response', () => {
  assert.equal(parseResponse(`HTTP/1.1 200 Connection established\r\n\r\n${response({ ok: true })}`).status, 200);
});
test('cacheable, non-JSON, and malformed responses fail closed', () => {
  assert.throws(() => parseResponse(response({}).replace('no-store', 'public')));
  assert.throws(() => parseResponse(response({}).replace('application/json', 'text/html')));
  assert.throws(() => parseResponse('unexpected body'));
});
test('auth diagnostic exposes only recognized code, status, and error type', () => {
  assert.deepEqual(safeAuthDiagnostic({ name: 'AuthApiError', status: 400, code: 'invalid_credentials',
    message: 'must not be exposed', access_token: 'must not be exposed' }),
  { code: 'invalid_credentials', status: 400, type: 'AuthApiError' });
  assert.deepEqual(safeAuthDiagnostic({ name: 'AuthRetryableFetchError', status: 0 }),
    { code: 'unclassified', status: 0, type: 'AuthRetryableFetchError' });
});
test('auth diagnostic cannot echo arbitrary error properties', () => {
  assert.deepEqual(safeAuthDiagnostic({ name: 'private value', status: 'private value', code: 'private value' }),
    { code: 'unclassified', status: null, type: 'unclassified' });
  assert.deepEqual(safeAuthDiagnostic(null), { code: 'unclassified', status: null, type: 'unclassified' });
});
test('API diagnostics allowlist only static server errors', () => {
  assert.equal(safeApiDiagnostic({error:'Could not verify project access'}), 'Could not verify project access');
  assert.equal(safeApiDiagnostic({error:'Project membership required'}), 'Project membership required');
  assert.equal(safeApiDiagnostic({error:'private response',token:'private response'}), 'Unclassified API error; response body withheld');
});
test('database diagnostics discard row data and database messages', () => {
  assert.deepEqual(safeDatabaseDiagnostic({status:400,error:{code:'PGRST200',message:'private response'},data:[{secret:'private response'}]}),
    {status:400,code:'PGRST200'});
  assert.deepEqual(safeDatabaseDiagnostic({status:403,error:{code:'42501'}}), {status:403,code:'42501'});
  assert.deepEqual(safeDatabaseDiagnostic({status:200,error:null}), {status:200,code:null});
});

test('signed-in verifier refreshes once and retries the same request on unexpected 401', async () => {
  let token = 'old'; let refreshes = 0;
  const requests = [];
  const body = { clientId: 'synthetic-same-id', title: 'Synthetic' };
  const result = await requestWithSessionRecovery(async () => {
    requests.push({ token, body });
    return { status: token === 'old' ? 401 : 200 };
  }, async () => { refreshes += 1; token = 'new'; return true; }, true);
  assert.equal(result.status, 200); assert.equal(refreshes, 1);
  assert.deepEqual(requests, [{ token: 'old', body }, { token: 'new', body }]);
});

test('verifier never retries permission errors, expected negative checks, or other statuses', async () => {
  for (const [status, enabled] of [[403, true], [500, true], [200, true], [401, false]]) {
    let calls = 0;
    const result = await requestWithSessionRecovery(async () => { calls += 1; return { status }; },
      async () => { assert.fail('Refresh must not run'); }, enabled);
    assert.equal(result.status, status); assert.equal(calls, 1);
  }
});

test('verifier stops after a second 401 or an unsuccessful refresh', async () => {
  for (const recovered of [true, false]) {
    let calls = 0; let refreshes = 0;
    const result = await requestWithSessionRecovery(async () => { calls += 1; return { status: 401 }; },
      async () => { refreshes += 1; return recovered; }, true);
    assert.equal(result.status, 401); assert.equal(refreshes, 1);
    assert.equal(calls, recovered ? 2 : 1);
  }
});

test('transport failure is not replayed as an authentication retry', async () => {
  let calls = 0;
  await assert.rejects(() => requestWithSessionRecovery(async () => { calls += 1; throw new Error('Synthetic transport failure'); },
    async () => { assert.fail('Refresh must not run'); }, true), /Synthetic transport failure/);
  assert.equal(calls, 1);
});
