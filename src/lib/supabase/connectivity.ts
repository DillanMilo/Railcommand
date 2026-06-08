export const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;
export const SUPABASE_HEALTH_TIMEOUT_MS = 6_000;
export const SUPABASE_TIMEOUT_MESSAGE = 'Auth request timed out';
export const SUPABASE_CONNECTION_ERROR =
  'Could not reach the auth service. Check your internet, VPN, or DNS settings and try again.';

type FetchWithTimeoutInit = RequestInit & {
  timeoutMessage?: string;
  timeoutMs?: number;
  timeoutStatus?: number;
};

export function isSupabaseConnectionError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  return /abort|fetch|network|timeout|timed out|load failed|request_timeout/i.test(message);
}

export function getSupabaseAuthErrorMessage(error: unknown): string {
  return isSupabaseConnectionError(error)
    ? SUPABASE_CONNECTION_ERROR
    : error instanceof Error
      ? error.message
      : SUPABASE_CONNECTION_ERROR;
}

export function fetchWithTimeout(input: RequestInfo | URL, init: FetchWithTimeoutInit = {}) {
  const {
    timeoutMessage = SUPABASE_TIMEOUT_MESSAGE,
    timeoutMs = SUPABASE_REQUEST_TIMEOUT_MS,
    timeoutStatus = 504,
    ...requestInit
  } = init;

  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      resolve(
        new Response(
          JSON.stringify({
            error: 'request_timeout',
            error_description: timeoutMessage,
            message: timeoutMessage,
          }),
          {
            status: timeoutStatus,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );
    }, timeoutMs);

    fetch(input, requestInit)
      .then((response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(response);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
  });
}

export async function checkSupabaseConnectivity(timeoutMs = SUPABASE_HEALTH_TIMEOUT_MS) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const checkedAt = new Date().toISOString();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      checkedAt,
      error: 'supabase_env_missing',
      ok: false,
      status: 0,
    };
  }

  try {
    const response = await fetchWithTimeout(new URL('/auth/v1/health', supabaseUrl), {
      cache: 'no-store',
      headers: {
        apikey: supabaseAnonKey,
      },
      timeoutMessage: 'Supabase health check timed out',
      timeoutMs,
    });

    return {
      checkedAt,
      ok: response.status < 500,
      status: response.status,
    };
  } catch (error) {
    return {
      checkedAt,
      error: error instanceof Error ? error.message : 'Supabase health check failed',
      ok: false,
      status: 0,
    };
  }
}
