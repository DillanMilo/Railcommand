import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const HEALTH_TIMEOUT_MS = 5_000;

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
): NextResponse {
  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'no-store',
    },
    status,
  });
}

export async function GET() {
  const startedAt = Date.now();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse(
      {
        checkedAt: new Date().toISOString(),
        error: 'supabase_env_missing',
        ok: false,
      },
      500,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const response = await fetch(new URL('/auth/v1/health', supabaseUrl), {
      cache: 'no-store',
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${supabaseAnonKey}`,
      },
      signal: controller.signal,
    });

    const ok = response.status < 500;
    return jsonResponse(
      {
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - startedAt,
        ok,
        status: response.status,
      },
      ok ? 200 : 502,
    );
  } catch (error) {
    return jsonResponse(
      {
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.name : 'supabase_unreachable',
        latencyMs: Date.now() - startedAt,
        ok: false,
      },
      503,
    );
  } finally {
    clearTimeout(timeout);
  }
}
