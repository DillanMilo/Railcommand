type IpReputationMode = 'log' | 'block';

type IpReputationTraits = {
  proxy: boolean;
  vpn: boolean;
  tor: boolean;
  hosting: boolean;
  fraudScore?: number;
  connectionType?: string;
  isp?: string;
  organization?: string;
  asn?: string | number;
};

type IpReputationConfig = {
  enabled: boolean;
  mode: IpReputationMode;
  provider: 'ipqualityscore';
  apiKey?: string;
  timeoutMs: number;
  cacheTtlSeconds: number;
  cookieSecret?: string;
  blockProxy: boolean;
  blockVpn: boolean;
  blockTor: boolean;
  blockHosting: boolean;
};

type IpReputationDecision = {
  allowed: boolean;
  blocked: boolean;
  skipped: boolean;
  source:
    | 'disabled'
    | 'non_protected_path'
    | 'missing_key'
    | 'missing_ip'
    | 'cache'
    | 'provider'
    | 'timeout'
    | 'error'
    | 'malformed_response';
  reason: string;
  failOpen: boolean;
  traits?: IpReputationTraits;
  matchedReasons?: string[];
  cacheCookie?: {
    name: string;
    value: string;
    maxAge: number;
  };
};

type IpReputationLogger = Pick<typeof console, 'info' | 'warn'>;

type IpReputationRequest = {
  isProtectedPath: boolean;
  ip: string | null;
  userAgent?: string | null;
  cacheCookieValue?: string;
  config: IpReputationConfig;
  fetchFn?: typeof fetch;
  logger?: IpReputationLogger;
  now?: number;
};

type IpQualityScoreResponse = Record<string, unknown>;

const CACHE_COOKIE_NAME = 'rc-iprep';
const DEFAULT_TIMEOUT_MS = 400;
const DEFAULT_CACHE_TTL_SECONDS = 30 * 60;
const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const FALSE_ENV_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);

function getEnvFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (TRUE_ENV_VALUES.has(normalized)) return true;
  if (FALSE_ENV_VALUES.has(normalized)) return false;

  return defaultValue;
}

function getPositiveInteger(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

function getMode(value: string | undefined): IpReputationMode {
  return value?.trim().toLowerCase() === 'block' ? 'block' : 'log';
}

export function getIpReputationConfig(env: {
  IP_REPUTATION_ENABLED?: string;
  IP_REPUTATION_MODE?: string;
  IP_REPUTATION_PROVIDER?: string;
  IP_REPUTATION_API_KEY?: string;
  IP_REPUTATION_TIMEOUT_MS?: string;
  IP_REPUTATION_CACHE_TTL_SECONDS?: string;
  IP_REPUTATION_COOKIE_SECRET?: string;
  IP_REPUTATION_BLOCK_PROXY?: string;
  IP_REPUTATION_BLOCK_VPN?: string;
  IP_REPUTATION_BLOCK_TOR?: string;
  IP_REPUTATION_BLOCK_HOSTING?: string;
}): IpReputationConfig {
  const provider = env.IP_REPUTATION_PROVIDER?.trim().toLowerCase();

  return {
    enabled: getEnvFlag(env.IP_REPUTATION_ENABLED, false),
    mode: getMode(env.IP_REPUTATION_MODE),
    provider: provider === 'ipqualityscore' || !provider ? 'ipqualityscore' : 'ipqualityscore',
    apiKey: env.IP_REPUTATION_API_KEY?.trim() || undefined,
    timeoutMs: getPositiveInteger(env.IP_REPUTATION_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    cacheTtlSeconds: getPositiveInteger(
      env.IP_REPUTATION_CACHE_TTL_SECONDS,
      DEFAULT_CACHE_TTL_SECONDS
    ),
    cookieSecret: env.IP_REPUTATION_COOKIE_SECRET?.trim() || undefined,
    blockProxy: getEnvFlag(env.IP_REPUTATION_BLOCK_PROXY, true),
    blockVpn: getEnvFlag(env.IP_REPUTATION_BLOCK_VPN, true),
    blockTor: getEnvFlag(env.IP_REPUTATION_BLOCK_TOR, true),
    blockHosting: getEnvFlag(env.IP_REPUTATION_BLOCK_HOSTING, false),
  };
}

export function getIpReputationCookieName(): string {
  return CACHE_COOKIE_NAME;
}

export async function evaluateIpReputationAccess({
  isProtectedPath,
  ip,
  userAgent,
  cacheCookieValue,
  config,
  fetchFn = fetch,
  logger = console,
  now = Date.now(),
}: IpReputationRequest): Promise<IpReputationDecision> {
  if (!isProtectedPath) {
    return allow('non_protected_path', 'Path is not geo restricted', true, false);
  }

  if (!config.enabled) {
    return allow('disabled', 'IP reputation check is disabled', true, false);
  }

  if (!config.apiKey) {
    logger.warn('[middleware] IP reputation fail-open: missing API key');
    return allow('missing_key', 'IP reputation API key is not configured', false, true);
  }

  if (!ip) {
    logger.warn('[middleware] IP reputation fail-open: missing client IP');
    return allow('missing_ip', 'Client IP could not be determined', false, true);
  }

  const cachedTraits = config.cookieSecret && cacheCookieValue
    ? await readCacheCookie(config.cookieSecret, ip, cacheCookieValue, now)
    : null;

  if (cachedTraits) {
    return decisionFromTraits(cachedTraits, config, 'cache', logger);
  }

  const providerResult = await fetchIpQualityScore({
    apiKey: config.apiKey,
    ip,
    userAgent,
    timeoutMs: config.timeoutMs,
    fetchFn,
  });

  if (!providerResult.ok) {
    logger.warn('[middleware] IP reputation fail-open', {
      source: providerResult.source,
      reason: providerResult.reason,
    });
    return allow(providerResult.source, providerResult.reason, false, true);
  }

  const cacheCookie = config.cookieSecret
    ? {
        name: CACHE_COOKIE_NAME,
        value: await createCacheCookie(
          config.cookieSecret,
          ip,
          providerResult.traits,
          now,
          config.cacheTtlSeconds
        ),
        maxAge: config.cacheTtlSeconds,
      }
    : undefined;

  return decisionFromTraits(providerResult.traits, config, 'provider', logger, cacheCookie);
}

function allow(
  source: IpReputationDecision['source'],
  reason: string,
  skipped: boolean,
  failOpen: boolean
): IpReputationDecision {
  return {
    allowed: true,
    blocked: false,
    skipped,
    source,
    reason,
    failOpen,
  };
}

function decisionFromTraits(
  traits: IpReputationTraits,
  config: IpReputationConfig,
  source: 'cache' | 'provider',
  logger: IpReputationLogger,
  cacheCookie?: IpReputationDecision['cacheCookie']
): IpReputationDecision {
  const matchedReasons = getMatchedReasons(traits, config);
  const shouldBlock = matchedReasons.length > 0 && config.mode === 'block';

  if (matchedReasons.length > 0) {
    const logPayload = {
      source,
      mode: config.mode,
      matchedReasons,
      fraudScore: traits.fraudScore,
      connectionType: traits.connectionType,
      isp: traits.isp,
      organization: traits.organization,
      asn: traits.asn,
    };

    if (shouldBlock) {
      logger.warn('[middleware] IP reputation blocked request', logPayload);
    } else {
      logger.info('[middleware] IP reputation log-only match', logPayload);
    }
  }

  return {
    allowed: !shouldBlock,
    blocked: shouldBlock,
    skipped: false,
    source,
    reason: matchedReasons.length > 0
      ? `Matched ${matchedReasons.join(', ')}`
      : 'No blocked IP reputation signals',
    failOpen: false,
    traits,
    matchedReasons,
    cacheCookie,
  };
}

function getMatchedReasons(
  traits: IpReputationTraits,
  config: IpReputationConfig
): string[] {
  const reasons: string[] = [];

  if (config.blockProxy && traits.proxy) reasons.push('proxy');
  if (config.blockVpn && traits.vpn) reasons.push('vpn');
  if (config.blockTor && traits.tor) reasons.push('tor');
  if (config.blockHosting && traits.hosting) reasons.push('hosting');

  return reasons;
}

async function fetchIpQualityScore({
  apiKey,
  ip,
  userAgent,
  timeoutMs,
  fetchFn,
}: {
  apiKey: string;
  ip: string;
  userAgent?: string | null;
  timeoutMs: number;
  fetchFn: typeof fetch;
}): Promise<
  | { ok: true; traits: IpReputationTraits }
  | {
      ok: false;
      source: 'timeout' | 'error' | 'malformed_response';
      reason: string;
    }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = new URL(
      `https://ipqualityscore.com/api/json/ip/${encodeURIComponent(apiKey)}/${encodeURIComponent(ip)}`
    );
    url.searchParams.set('strictness', '1');
    url.searchParams.set('fast', 'true');
    url.searchParams.set('allow_public_access_points', 'true');
    if (userAgent) url.searchParams.set('user_agent', userAgent.slice(0, 512));

    const response = await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return {
        ok: false,
        source: 'error',
        reason: `IPQualityScore returned HTTP ${response.status}`,
      };
    }

    const body = await response.json().catch(() => null) as IpQualityScoreResponse | null;
    const traits = parseIpQualityScoreResponse(body);
    if (!traits) {
      return {
        ok: false,
        source: 'malformed_response',
        reason: 'IPQualityScore response was missing expected fields',
      };
    }

    return { ok: true, traits };
  } catch (err) {
    if (isAbortError(err)) {
      return {
        ok: false,
        source: 'timeout',
        reason: `IPQualityScore request timed out after ${timeoutMs}ms`,
      };
    }

    return {
      ok: false,
      source: 'error',
      reason: err instanceof Error ? err.message : 'IPQualityScore request failed',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseIpQualityScoreResponse(body: IpQualityScoreResponse | null): IpReputationTraits | null {
  if (!body || typeof body !== 'object') return null;
  if (body.success !== true) return null;

  const hasAnyReputationSignal =
    typeof body.proxy === 'boolean' ||
    typeof body.vpn === 'boolean' ||
    typeof body.tor === 'boolean' ||
    typeof body.active_vpn === 'boolean' ||
    typeof body.active_tor === 'boolean' ||
    typeof body.connection_type === 'string';

  if (!hasAnyReputationSignal) return null;

  const connectionType = typeof body.connection_type === 'string'
    ? body.connection_type
    : undefined;
  const normalizedConnectionType = connectionType?.toLowerCase() ?? '';

  return {
    proxy: body.proxy === true,
    vpn: body.vpn === true || body.active_vpn === true,
    tor: body.tor === true || body.active_tor === true,
    hosting:
      normalizedConnectionType.includes('hosting') ||
      normalizedConnectionType.includes('data center') ||
      normalizedConnectionType.includes('datacenter'),
    fraudScore: typeof body.fraud_score === 'number' ? body.fraud_score : undefined,
    connectionType,
    isp: typeof body.ISP === 'string' ? body.ISP : undefined,
    organization: typeof body.organization === 'string' ? body.organization : undefined,
    asn: typeof body.ASN === 'string' || typeof body.ASN === 'number' ? body.ASN : undefined,
  };
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === 'AbortError') ||
    (err instanceof Error && err.name === 'AbortError')
  );
}

async function createCacheCookie(
  secret: string,
  ip: string,
  traits: IpReputationTraits,
  now: number,
  ttlSeconds: number
): Promise<string> {
  const payload = {
    v: 1,
    exp: now + ttlSeconds * 1000,
    ip: await sign(secret, `ip:${ip}`),
    traits,
  };
  const body = textToBase64Url(JSON.stringify(payload));
  const signature = await sign(secret, `cache:${body}`);

  return `${body}.${signature}`;
}

async function readCacheCookie(
  secret: string,
  ip: string,
  value: string,
  now: number
): Promise<IpReputationTraits | null> {
  const [body, signature] = value.split('.');
  if (!body || !signature) return null;

  const expectedSignature = await sign(secret, `cache:${body}`);
  if (!timingSafeEqual(signature, expectedSignature)) return null;

  const payloadText = base64UrlToText(body);
  if (!payloadText) return null;

  try {
    const payload = JSON.parse(payloadText) as {
      v?: unknown;
      exp?: unknown;
      ip?: unknown;
      traits?: unknown;
    };

    if (payload.v !== 1) return null;
    if (typeof payload.exp !== 'number' || payload.exp <= now) return null;
    if (typeof payload.ip !== 'string') return null;

    const expectedIpHash = await sign(secret, `ip:${ip}`);
    if (!timingSafeEqual(payload.ip, expectedIpHash)) return null;

    return isTraits(payload.traits) ? payload.traits : null;
  } catch {
    return null;
  }
}

function isTraits(value: unknown): value is IpReputationTraits {
  if (!value || typeof value !== 'object') return false;
  const traits = value as Partial<IpReputationTraits>;

  return (
    typeof traits.proxy === 'boolean' &&
    typeof traits.vpn === 'boolean' &&
    typeof traits.tor === 'boolean' &&
    typeof traits.hosting === 'boolean'
  );
}

async function sign(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(message)
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToText(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}
