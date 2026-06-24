import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/supabase/connectivity';
import { DEMO_SESSION_COOKIE, readDemoSessionToken } from '@/lib/demo/session-cookie';

const GEO_RESTRICTED_PAGE = '/geo-restricted';

const GEO_RESTRICTED_EXACT_PATHS = new Set(['/login']);

const GEO_RESTRICTED_PREFIXES = [
  '/admin',
  '/auth',
  '/dashboard',
  '/demo',
  '/invite',
  '/onboarding',
  '/projects',
  '/search',
  '/settings',
  '/api/access-request',
  '/api/admin/demo',
  '/api/chat',
  '/api/demo',
  '/api/email/send',
  '/api/notifications',
];

const GEO_EXEMPT_PREFIXES = ['/api/cron/'];
const GEO_EXEMPT_EXACT_PATHS = new Set(['/api/health/supabase', GEO_RESTRICTED_PAGE]);
const FALSE_ENV_VALUES = new Set(['0', 'false', 'no', 'off', 'disabled']);
const TRUE_ENV_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);
const DEFAULT_ALLOWED_COUNTRIES = ['US'];

type GeoAccessDecision = {
  blocked: boolean;
  country: string | null;
  reason: string;
  allowedCountries: Set<string>;
};

function getSafeRedirectPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null;
  }
  return value;
}

function getEnvFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;

  const normalized = value.trim().toLowerCase();
  if (TRUE_ENV_VALUES.has(normalized)) return true;
  if (FALSE_ENV_VALUES.has(normalized)) return false;

  return defaultValue;
}

function getAllowedCountries(): Set<string> {
  const configuredCountries = env.US_ONLY_ALLOWED_COUNTRIES
    ?.split(',')
    .map((country) => country.trim().toUpperCase())
    .filter(Boolean);

  return new Set(
    configuredCountries && configuredCountries.length > 0
      ? configuredCountries
      : DEFAULT_ALLOWED_COUNTRIES
  );
}

function getTestCountry(request: NextRequest): string | null {
  if (process.env.NODE_ENV === 'production') return null;

  const country = request.headers.get('x-rc-test-country')?.trim().toUpperCase();
  return country || null;
}

function getRequestCountry(request: NextRequest): string | null {
  const testCountry = getTestCountry(request);
  const country =
    testCountry ??
    request.headers.get('x-vercel-ip-country') ??
    request.headers.get('cf-ipcountry') ??
    request.headers.get('cloudfront-viewer-country');

  const normalizedCountry = country?.trim().toUpperCase();
  if (!normalizedCountry || normalizedCountry === 'UNKNOWN') return null;

  return normalizedCountry;
}

function isGeoRestrictionEnabled(request: NextRequest): boolean {
  if (getTestCountry(request)) return true;

  return getEnvFlag(
    env.US_ONLY_ACCESS_ENABLED,
    process.env.NODE_ENV === 'production'
  );
}

function shouldBlockUnknownCountry(): boolean {
  return getEnvFlag(
    env.US_ONLY_BLOCK_UNKNOWN_COUNTRY,
    process.env.NODE_ENV === 'production'
  );
}

function isGeoRestrictedPath(pathname: string): boolean {
  if (GEO_EXEMPT_EXACT_PATHS.has(pathname)) return false;
  if (GEO_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }
  if (GEO_RESTRICTED_EXACT_PATHS.has(pathname)) return true;

  return GEO_RESTRICTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function shouldBlockForGeo(
  request: NextRequest,
  pathname: string
): GeoAccessDecision {
  if (!isGeoRestrictedPath(pathname) || !isGeoRestrictionEnabled(request)) {
    return {
      blocked: false,
      country: null,
      reason: 'not_restricted',
      allowedCountries: getAllowedCountries(),
    };
  }

  const allowedCountries = getAllowedCountries();
  const country = getRequestCountry(request);

  if (!country) {
    return {
      blocked: shouldBlockUnknownCountry(),
      country,
      reason: 'unknown_country',
      allowedCountries,
    };
  }

  return {
    blocked: !allowedCountries.has(country),
    country,
    reason: 'outside_allowed_country',
    allowedCountries,
  };
}

function getGeoBlockedResponse(
  request: NextRequest,
  pathname: string,
  country: string | null,
  reason: string
) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      {
        error: 'Access is restricted to users located within the United States.',
      },
      { status: 403 }
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = GEO_RESTRICTED_PAGE;
  url.search = '';
  url.searchParams.set('reason', reason);
  if (country) url.searchParams.set('country', country);
  url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);

  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const geoBlock = shouldBlockForGeo(request, pathname);

  if (geoBlock.blocked) {
    console.warn('[middleware] Geo access blocked', {
      pathname,
      country: geoBlock.country ?? 'unknown',
      reason: geoBlock.reason,
      allowedCountries: Array.from(geoBlock.allowedCountries),
    });

    return getGeoBlockedResponse(
      request,
      pathname,
      geoBlock.country,
      geoBlock.reason
    );
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
      global: {
        fetch: fetchWithTimeout,
      },
    }
  );

  // IMPORTANT: Do NOT add any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake here can make it very
  // hard to debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow unauthenticated local demo users only with a server-signed demo cookie.
  const demoSession = !user
    ? await readDemoSessionToken(request.cookies.get(DEMO_SESSION_COOKIE)?.value)
    : null;
  const isDemoMode = !user && !!demoSession;

  // Public routes that never require auth
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === GEO_RESTRICTED_PAGE ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/demo/') ||
    pathname === '/api/health/supabase' ||
    pathname === '/api/access-request' ||
    pathname === '/api/admin/demo/lookup' ||
    pathname === '/api/admin/demo/session' ||
    pathname === '/api/admin/demo/track' ||
    pathname === '/api/demo/local-session' ||
    pathname === '/api/chat/transcribe' ||
    pathname === '/api/email/send' ||
    pathname === '/api/notifications' ||
    pathname.startsWith('/api/cron/');

  // If not authenticated, not demo, and not on a public route → redirect to login
  if (!user && !isDemoMode && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // If authenticated but "Remember me" was not checked (session cookie expired
  // after browser close), sign out and redirect to login
  const hasRememberCookie = request.cookies.get('rc-remember')?.value === 'true';
  if (user && !hasRememberCookie && !isPublicRoute) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    const response = NextResponse.redirect(url);
    // Clear Supabase auth cookies
    request.cookies.getAll().forEach(({ name }) => {
      if (name.startsWith('sb-')) {
        response.cookies.delete(name);
      }
    });
    return response;
  }

  // If authenticated + remembered and visiting /login → redirect to dashboard
  if (user && hasRememberCookie && pathname === '/login') {
    const safeNext = getSafeRedirectPath(request.nextUrl.searchParams.get('next'));
    const url = new URL(safeNext ?? '/dashboard', request.nextUrl.origin);
    return NextResponse.redirect(url);
  }

  // Onboarding check: redirect users without an organization to /onboarding
  if (user && hasRememberCookie && !isDemoMode) {
    const hasOnboardedCookie = request.cookies.get('rc-onboarded')?.value === 'true';

    // Paths exempt from onboarding redirect
    const isOnboardingExempt =
      pathname === '/onboarding' ||
      pathname.startsWith('/invite/') ||
      pathname.startsWith('/auth/') ||
      pathname === '/login' ||
      pathname === '/privacy' ||
      pathname === '/terms';

    if (!hasOnboardedCookie && !isOnboardingExempt) {
      // Check if user has completed onboarding (has an organization)
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!profile?.organization_id) {
        const { count: projectMembershipCount } = await supabase
          .from('project_members')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', user.id);

        if ((projectMembershipCount ?? 0) > 0) {
          supabaseResponse.cookies.set('rc-onboarded', 'true', {
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
            sameSite: 'lax',
          });
          return supabaseResponse;
        }

        // Redirect to onboarding, preserving the original destination
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        if (pathname !== '/dashboard' && pathname !== '/') {
          url.searchParams.set('next', pathname);
        }
        return NextResponse.redirect(url);
      } else {
        // User has org - set cookie so we skip the DB check next time
        supabaseResponse.cookies.set('rc-onboarded', 'true', {
          path: '/',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          sameSite: 'lax',
        });
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, manifest, icons, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
