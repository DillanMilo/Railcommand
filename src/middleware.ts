import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    }
  );

  // IMPORTANT: Do NOT add any code between createServerClient and
  // supabase.auth.getUser(). A simple mistake here can make it very
  // hard to debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow demo-mode users through (cookie set by the "Explore Demo" button)
  const isDemoMode =
    request.cookies.get('rc-mode')?.value === 'demo' ||
    request.cookies.get('rc-mode')?.value === 'fresh';

  const { pathname } = request.nextUrl;

  // Public routes that never require auth
  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/auth/');

  // If not authenticated, not demo, and not on a public route → redirect to login
  if (!user && !isDemoMode && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // If authenticated but "Remember me" was not checked (session cookie expired
  // after browser close), sign out and redirect to login
  const hasRememberCookie = request.cookies.get('rc-remember')?.value === 'true';
  if (user && !hasRememberCookie && !isPublicRoute) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = '/login';
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
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
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
