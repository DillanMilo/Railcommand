import { strict as assert } from 'node:assert';
import {
  evaluateIpReputationAccess,
  getIpReputationConfig,
} from './ip-reputation';

type TestLogger = {
  infoMessages: unknown[];
  warnMessages: unknown[];
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
};

let passed = 0;
let failed = 0;
const failures: string[] = [];

function createLogger(): TestLogger {
  const logger: TestLogger = {
    infoMessages: [],
    warnMessages: [],
    info(...args: unknown[]) {
      logger.infoMessages.push(args);
    },
    warn(...args: unknown[]) {
      logger.warnMessages.push(args);
    },
  };

  return logger;
}

function baseConfig(overrides: Record<string, string | undefined> = {}) {
  return getIpReputationConfig({
    IP_REPUTATION_ENABLED: 'true',
    IP_REPUTATION_MODE: 'log',
    IP_REPUTATION_PROVIDER: 'ipqualityscore',
    IP_REPUTATION_API_KEY: 'test-key',
    IP_REPUTATION_TIMEOUT_MS: '25',
    IP_REPUTATION_CACHE_TTL_SECONDS: '900',
    IP_REPUTATION_BLOCK_PROXY: 'true',
    IP_REPUTATION_BLOCK_VPN: 'true',
    IP_REPUTATION_BLOCK_TOR: 'true',
    IP_REPUTATION_BLOCK_HOSTING: 'false',
    ...overrides,
  });
}

function ipqsResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push(`${name}: ${msg}`);
    console.log(`  FAIL  ${name} -- ${msg}`);
  }
}

async function main() {
  await test('fails open on timeout', async () => {
    const logger = createLogger();
    const fetchFn: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });

    const result = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config: baseConfig({ IP_REPUTATION_TIMEOUT_MS: '5' }),
      fetchFn,
      logger,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.failOpen, true);
    assert.equal(result.source, 'timeout');
    assert.equal(logger.warnMessages.length, 1);
  });

  await test('fails open on provider error', async () => {
    const logger = createLogger();
    const fetchFn: typeof fetch = async () => {
      throw new Error('provider unavailable');
    };

    const result = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config: baseConfig(),
      fetchFn,
      logger,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.failOpen, true);
    assert.equal(result.source, 'error');
    assert.match(result.reason, /provider unavailable/);
    assert.equal(logger.warnMessages.length, 1);
  });

  await test('fails open on malformed response', async () => {
    const logger = createLogger();
    const fetchFn: typeof fetch = async () => ipqsResponse({ success: true });

    const result = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config: baseConfig(),
      fetchFn,
      logger,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.failOpen, true);
    assert.equal(result.source, 'malformed_response');
    assert.equal(logger.warnMessages.length, 1);
  });

  await test('blocks known VPN IP when mode is block', async () => {
    const logger = createLogger();
    const fetchFn: typeof fetch = async () =>
      ipqsResponse({
        success: true,
        proxy: false,
        vpn: true,
        tor: false,
        active_vpn: true,
        connection_type: 'Premium VPN',
        fraud_score: 85,
      });

    const result = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config: baseConfig({ IP_REPUTATION_MODE: 'block' }),
      fetchFn,
      logger,
    });

    assert.equal(result.allowed, false);
    assert.equal(result.blocked, true);
    assert.equal(result.failOpen, false);
    assert.deepEqual(result.matchedReasons, ['vpn']);
    assert.equal(logger.warnMessages.length, 1);
  });

  await test('logs only for known VPN IP when mode is log', async () => {
    const logger = createLogger();
    const fetchFn: typeof fetch = async () =>
      ipqsResponse({
        success: true,
        proxy: false,
        vpn: true,
        tor: false,
        connection_type: 'Premium VPN',
      });

    const result = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config: baseConfig({ IP_REPUTATION_MODE: 'log' }),
      fetchFn,
      logger,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.failOpen, false);
    assert.deepEqual(result.matchedReasons, ['vpn']);
    assert.equal(logger.infoMessages.length, 1);
    assert.equal(logger.warnMessages.length, 0);
  });

  await test('skips non-protected paths without calling provider', async () => {
    let called = false;
    const fetchFn: typeof fetch = async () => {
      called = true;
      return ipqsResponse({ success: true, proxy: true });
    };

    const result = await evaluateIpReputationAccess({
      isProtectedPath: false,
      ip: '203.0.113.10',
      config: baseConfig({ IP_REPUTATION_MODE: 'block' }),
      fetchFn,
      logger: createLogger(),
    });

    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.skipped, true);
    assert.equal(result.source, 'non_protected_path');
    assert.equal(called, false);
  });

  await test('uses signed cache cookie without calling provider again', async () => {
    let calls = 0;
    const fetchFn: typeof fetch = async () => {
      calls++;
      return ipqsResponse({
        success: true,
        proxy: false,
        vpn: false,
        tor: false,
        connection_type: 'Residential',
      });
    };
    const config = baseConfig({ IP_REPUTATION_COOKIE_SECRET: 'test-cookie-secret' });

    const first = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config,
      fetchFn,
      logger: createLogger(),
      now: 1_000,
    });

    assert.equal(first.allowed, true);
    assert.equal(first.source, 'provider');
    assert.ok(first.cacheCookie?.value);
    assert.equal(calls, 1);

    const second = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config,
      cacheCookieValue: first.cacheCookie.value,
      fetchFn,
      logger: createLogger(),
      now: 2_000,
    });

    assert.equal(second.allowed, true);
    assert.equal(second.source, 'cache');
    assert.equal(calls, 1);
  });

  await test('flag off allows without calling provider', async () => {
    let called = false;
    const fetchFn: typeof fetch = async () => {
      called = true;
      return ipqsResponse({ success: true, vpn: true });
    };

    const result = await evaluateIpReputationAccess({
      isProtectedPath: true,
      ip: '203.0.113.10',
      config: baseConfig({ IP_REPUTATION_ENABLED: 'false', IP_REPUTATION_MODE: 'block' }),
      fetchFn,
      logger: createLogger(),
    });

    assert.equal(result.allowed, true);
    assert.equal(result.blocked, false);
    assert.equal(result.skipped, true);
    assert.equal(result.source, 'disabled');
    assert.equal(called, false);
  });

  console.log(`\nIP reputation tests: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
