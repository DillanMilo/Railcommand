# RailCommand -- Authentication Backend Implementation Plan

> **Project:** RailCommand -- Construction & Rail Project Management
> **Stack:** Next.js 16 (App Router) | Supabase (Auth + DB + RLS) | TypeScript | Vercel
> **Last Updated:** February 27, 2026

---

## Table of Contents

1. [Supabase Project Configuration](#1-supabase-project-configuration)
2. [Database Schema](#2-database-schema)
3. [Row-Level Security (RLS) Policies](#3-row-level-security-rls-policies)
4. [Auth Implementation -- Server Side](#4-auth-implementation----server-side)
5. [Auth Implementation -- Client Side](#5-auth-implementation----client-side)
6. [Auth Hooks & Context](#6-auth-hooks--context)
7. [Email Templates (Supabase)](#7-email-templates-supabase)
8. [Error Handling](#8-error-handling)
9. [Security Checklist](#9-security-checklist)
10. [File Structure](#10-file-structure)
11. [Testing Plan](#11-testing-plan)
12. [Profile Management & Settings Backend](#12-profile-management--settings-backend)
13. [Supabase Storage (Avatars)](#13-supabase-storage-avatars)
14. [User Preferences](#14-user-preferences)
15. [Profile & Settings Testing Plan](#15-profile--settings-testing-plan)
16. [Role-Based Access Control (RBAC)](#16-role-based-access-control-rbac)
17. [Photo & Attachment Storage](#17-photo--attachment-storage-supabase-storage)
18. [Activity Log Database Triggers](#18-activity-log-database-triggers)
19. [Supabase Type Generation](#19-supabase-type-generation)
20. [Seed Data & Migration Strategy](#20-seed-data--migration-strategy)
21. [Real-Time Subscriptions (Optional Enhancement)](#21-real-time-subscriptions-optional-enhancement)
22. [Environment Variable Addendum](#22-environment-variable-addendum)
23. [Complete Data Table Schemas](#23-complete-data-table-schemas)
24. [RLS Policies for Data Tables](#24-rls-policies-for-data-tables)
25. [Core Data Server Actions](#25-core-data-server-actions)
26. [Master Implementation Order](#26-master-implementation-order)

---

## 1. Supabase Project Configuration

### 1.1 Environment Variables

Create or update `.env.local` at the project root with the following variables:

```env
# Supabase -- Public (exposed to browser)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Supabase -- Server only (NEVER expose to the browser)
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Site URL -- Used in auth email redirect URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Set the same variables in **Vercel > Project Settings > Environment Variables** for `Production`, `Preview`, and `Development` environments.

> **Important:** `SUPABASE_SERVICE_ROLE_KEY` must NOT have the `NEXT_PUBLIC_` prefix. It bypasses RLS and should only be used in server-side code (API routes, server actions).

### 1.2 Enable Email/Password Auth

In the Supabase Dashboard:

1. Go to **Authentication > Providers**.
2. Under **Email**, ensure the provider is **Enabled**.
3. Configure the following settings:
   - **Confirm email:** Enabled (sends a confirmation link on signup).
   - **Secure email change:** Enabled.
   - **Minimum password length:** 8 characters.
   - **Leaked password protection:** Enabled (if available on your plan).

### 1.3 Enable Google OAuth

#### Step A: Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select your project (e.g., `RailCommand`).
3. Navigate to **APIs & Services > Credentials**.
4. Click **Create Credentials > OAuth 2.0 Client ID**.
5. Set the **Application type** to `Web application`.
6. Set the **Name** to `RailCommand Auth`.
7. Under **Authorized JavaScript origins**, add:
   ```
   https://<your-project-ref>.supabase.co
   ```
8. Under **Authorized redirect URIs**, add:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
9. Click **Create** and copy the **Client ID** and **Client Secret**.

#### Step B: Configure in Supabase

1. In the Supabase Dashboard, go to **Authentication > Providers > Google**.
2. Toggle Google to **Enabled**.
3. Paste in the **Client ID** and **Client Secret** from Google Cloud Console.
4. Save.

### 1.4 Redirect URL Configuration

In the Supabase Dashboard, go to **Authentication > URL Configuration** and set:

| Setting | Value |
|---|---|
| **Site URL** | `https://your-production-domain.com` (or `http://localhost:3000` for local dev) |
| **Redirect URLs** | `http://localhost:3000/auth/callback`, `https://your-production-domain.com/auth/callback` |

> Add any Vercel preview URLs as additional redirect URLs if needed:
> `https://<project-name>-*.vercel.app/auth/callback`

---

## 2. Database Schema

### 2.1 Profiles Table

This table extends `auth.users` with application-specific profile data. It mirrors the existing `Profile` interface in `src/lib/types.ts`.

```sql
-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL DEFAULT '',
  phone         TEXT DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'member'
                  CHECK (role IN ('admin', 'manager', 'member', 'viewer')),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  avatar_url    TEXT DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for email lookups
CREATE INDEX idx_profiles_email ON public.profiles (email);

-- Index for organization membership queries
CREATE INDEX idx_profiles_organization_id ON public.profiles (organization_id);

-- Index for role-based queries
CREATE INDEX idx_profiles_role ON public.profiles (role);
```

### 2.2 Organizations Table

Referenced by profiles; create this first if it does not already exist.

```sql
-- ============================================================
-- ORGANIZATIONS TABLE
-- ============================================================
CREATE TABLE public.organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'contractor'
                  CHECK (type IN ('contractor', 'engineer', 'owner', 'inspector')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 2.3 Projects Table

This table stores all projects managed within RailCommand. All project-scoped data (submittals, RFIs, daily logs, punch list items, milestones, activity log) references this table via `project_id`.

```sql
-- ============================================================
-- PROJECTS TABLE
-- ============================================================
CREATE TABLE public.projects (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  description      TEXT DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'on_hold', 'completed', 'archived')),
  start_date       DATE NOT NULL,
  target_end_date  DATE NOT NULL,
  actual_end_date  DATE,
  budget_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  budget_spent     NUMERIC(12,2) NOT NULL DEFAULT 0,
  location         TEXT DEFAULT '',
  client           TEXT DEFAULT '',
  created_by       UUID NOT NULL REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for filtering by status
CREATE INDEX idx_projects_status ON public.projects (status);

-- Index for looking up projects by creator
CREATE INDEX idx_projects_created_by ON public.projects (created_by);

-- Apply updated_at trigger
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 2.4 Auto-Create Profile on Signup (Trigger)

This trigger function fires after a new user is inserted into `auth.users` and creates a corresponding row in `public.profiles`.

```sql
-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
```

> **Note:** `SECURITY DEFINER` allows the function to insert into `public.profiles` even though RLS is active and the user has no session yet at the point of creation.

### 2.5 Auto-Update `updated_at` Timestamp

```sql
-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 2.6 Project Members Table (Reference)

This table already aligns with the existing `ProjectMember` type. It is critical for RLS policies on project-scoped data.

```sql
-- ============================================================
-- PROJECT MEMBERS TABLE (for reference -- may already exist)
-- ============================================================
CREATE TABLE public.project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_role  TEXT NOT NULL DEFAULT 'member'
                  CHECK (project_role IN (
                    'engineer', 'contractor', 'owner', 'inspector',
                    'manager', 'superintendent', 'foreman'
                  )),
  can_edit      BOOLEAN NOT NULL DEFAULT false,
  added_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, profile_id)
);

-- Index for checking membership
CREATE INDEX idx_project_members_project_id ON public.project_members (project_id);
CREATE INDEX idx_project_members_profile_id ON public.project_members (profile_id);
```

---

## 3. Row-Level Security (RLS) Policies

### 3.1 Enable RLS on All Tables

```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfi_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
```

### 3.2 Profiles Policies

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Users can read profiles of people in the same projects
CREATE POLICY "Users can read project teammate profiles"
  ON public.profiles
  FOR SELECT
  USING (
    id IN (
      SELECT pm2.profile_id
      FROM public.project_members pm1
      JOIN public.project_members pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.profile_id = auth.uid()
    )
  );
```

### 3.3 Project Policies

```sql
-- Users can read projects they are a member of
CREATE POLICY "Members can read their projects"
  ON public.projects
  FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
    )
  );

-- Only admins/managers can create projects
CREATE POLICY "Admins and managers can create projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- Members with edit permission can update projects
CREATE POLICY "Members with edit access can update projects"
  ON public.projects
  FOR UPDATE
  USING (
    id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid() AND can_edit = true
    )
  );
```

### 3.4 Project-Scoped Data Policies (Submittals, RFIs, Daily Logs, Punch Lists, Milestones)

All project-scoped tables follow the same membership pattern. Below is the template applied to `submittals`; repeat for each table substituting the table name.

```sql
-- ============================================================
-- SUBMITTALS POLICIES (repeat pattern for rfis, daily_logs,
-- punch_list_items, milestones, attachments, activity_log)
-- ============================================================

-- Read: project members can read
CREATE POLICY "Project members can read submittals"
  ON public.submittals
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
    )
  );

-- Insert: project members with edit access can create
CREATE POLICY "Project editors can create submittals"
  ON public.submittals
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid() AND can_edit = true
    )
  );

-- Update: project members with edit access can update
CREATE POLICY "Project editors can update submittals"
  ON public.submittals
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid() AND can_edit = true
    )
  );

-- Delete: only admins can delete
CREATE POLICY "Admins can delete submittals"
  ON public.submittals
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 3.5 Project Members Policies

```sql
-- Members can see who else is on their projects
CREATE POLICY "Members can read project members"
  ON public.project_members
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
    )
  );

-- Only admins/managers can add members
CREATE POLICY "Admins can manage project members"
  ON public.project_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );
```

### 3.6 Service Role Bypass

The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies automatically. Use it only in server-side code for admin operations:

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

> **Warning:** Never import `createAdminClient` in client-side code. The service role key must never be sent to the browser.

---

## 4. Auth Implementation -- Server Side

### 4.1 Middleware (`src/middleware.ts`)

The middleware runs on every request to refresh the auth session (keeping cookies alive) and protect routes.

```typescript
// src/middleware.ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Routes that do NOT require authentication
const PUBLIC_ROUTES = ['/login', '/auth/callback', '/auth/confirm'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Set cookies on the request (for downstream server components)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Set cookies on the response (for the browser)
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session -- IMPORTANT: do not remove this call.
  // It keeps the auth session alive and syncs server/client state.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Check if the route is public
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // If the user is NOT authenticated and the route is NOT public, redirect to login
  if (!user && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If the user IS authenticated and tries to visit /login, redirect to dashboard
  if (user && pathname === '/login') {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public assets (images, SVGs, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 4.2 Server-Side Supabase Client (`src/lib/supabase/server.ts`)

The existing implementation is already correct for Next.js 16 with App Router. No changes needed:

```typescript
// src/lib/supabase/server.ts (existing -- no changes required)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method is called from a Server Component where
            // cookies cannot be set. This can be safely ignored if middleware
            // is refreshing user sessions.
          }
        },
      },
    }
  );
}
```

### 4.3 Auth Callback Route (`src/app/auth/callback/route.ts`)

This route handles the OAuth redirect from Supabase after Google sign-in or email confirmation links.

```typescript
// src/app/auth/callback/route.ts
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successful auth -- redirect to the intended destination
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, redirect to login with an error
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

### 4.4 Server-Side Auth Helpers

Utility functions for server components and server actions to get the current user.

```typescript
// src/lib/supabase/auth-helpers.ts
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

/**
 * Get the currently authenticated user. Redirects to /login if not authenticated.
 * Use this in Server Components and Server Actions that require auth.
 */
export async function getAuthenticatedUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login');
  }

  return user;
}

/**
 * Get the current user's profile from the profiles table.
 * Redirects to /login if not authenticated.
 */
export async function getCurrentProfile(): Promise<Profile> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect('/login');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, organization:organizations(*)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Profile not found');
  }

  return profile as Profile;
}
```

### 4.5 Protected App Layout (`src/app/(app)/layout.tsx`)

Update the app layout to verify authentication server-side:

```typescript
// src/app/(app)/layout.tsx
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import MobileNav from '@/components/layout/MobileNav';
import PageTransition from '@/components/shared/PageTransition';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-rc-bg">
      {/* Sidebar -- desktop only */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  );
}
```

### 4.6 Server Actions for Auth (`src/lib/actions/auth.ts`)

```typescript
// src/lib/actions/auth.ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signUp(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  // User created -- they need to confirm their email
  return { success: true, message: 'Check your email for a confirmation link.' };
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true, message: 'Check your email for a password reset link.' };
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get('password') as string;

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}
```

---

## 5. Auth Implementation -- Client Side

### 5.1 Browser Client (`src/lib/supabase/client.ts`)

Already exists and is correct. No changes needed:

```typescript
// src/lib/supabase/client.ts (existing -- no changes required)
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### 5.2 Updated Login Page (`src/app/(auth)/login/page.tsx`)

Replace the current demo login page with a full auth UI supporting email/password and Google OAuth:

```typescript
// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Train, Loader2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';
import { signIn, signUp, resetPassword } from '@/lib/actions/auth';

type AuthView = 'sign_in' | 'sign_up' | 'forgot_password';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<AuthView>('sign_in');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error') ? 'Authentication failed. Please try again.' : null
  );
  const [message, setMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // ------------------------------------------
  // Email/Password Sign In (via server action)
  // ------------------------------------------
  async function handleEmailSignIn(formData: FormData) {
    setLoading(true);
    setError(null);

    const result = await signIn(formData);

    // signIn redirects on success, so we only reach here on error
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  // ------------------------------------------
  // Email/Password Sign Up (via server action)
  // ------------------------------------------
  async function handleEmailSignUp(formData: FormData) {
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await signUp(formData);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setMessage(result.message ?? 'Check your email for a confirmation link.');
    }
    setLoading(false);
  }

  // ------------------------------------------
  // Password Reset Request (via server action)
  // ------------------------------------------
  async function handlePasswordReset(formData: FormData) {
    setLoading(true);
    setError(null);
    setMessage(null);

    const result = await resetPassword(formData);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setMessage(result.message ?? 'Check your email for a reset link.');
    }
    setLoading(false);
  }

  // ------------------------------------------
  // Google OAuth (client-side -- requires redirect)
  // ------------------------------------------
  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const redirectTo = searchParams.get('redirectTo') ?? '/dashboard';

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${redirectTo}`,
      },
    });

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // On success, the browser redirects to Google -- no further action needed here.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rc-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex items-center justify-center size-12 rounded-xl bg-rc-orange mb-2">
            <Train className="size-7 text-white" />
          </div>
          <CardTitle className="font-heading text-2xl">RailCommand</CardTitle>
          <CardDescription>
            Construction &amp; Rail Project Management
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Error Banner */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-xs text-red-800 font-medium">{error}</p>
            </div>
          )}

          {/* Success Message Banner */}
          {message && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-center">
              <p className="text-xs text-green-800 font-medium">{message}</p>
            </div>
          )}

          {/* ================== SIGN IN VIEW ================== */}
          {view === 'sign_in' && (
            <>
              <form action={handleEmailSignIn} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="password" className="text-sm font-medium">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setView('forgot_password');
                        setError(null);
                        setMessage(null);
                      }}
                      className="text-xs text-rc-orange hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      required
                      minLength={8}
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Sign In
                </Button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Google OAuth */}
              <Button
                type="button"
                variant="outline"
                disabled={googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full h-11"
              >
                {googleLoading ? (
                  <Loader2 className="size-4 animate-spin mr-2" />
                ) : (
                  <svg className="size-4 mr-2" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                Continue with Google
              </Button>

              {/* Switch to Sign Up */}
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('sign_up');
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-rc-orange hover:underline font-medium"
                >
                  Sign Up
                </button>
              </p>
            </>
          )}

          {/* ================== SIGN UP VIEW ================== */}
          {view === 'sign_up' && (
            <>
              <form action={handleEmailSignUp} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-sm font-medium">
                    Full Name
                  </label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Jane Smith"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    required
                    minLength={8}
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Create Account
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('sign_in');
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-rc-orange hover:underline font-medium"
                >
                  Sign In
                </button>
              </p>
            </>
          )}

          {/* ================== FORGOT PASSWORD VIEW ================== */}
          {view === 'forgot_password' && (
            <>
              <form action={handlePasswordReset} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    required
                    className="h-11"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold"
                >
                  {loading ? (
                    <Loader2 className="size-4 animate-spin mr-2" />
                  ) : null}
                  Send Reset Link
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('sign_in');
                    setError(null);
                    setMessage(null);
                  }}
                  className="text-rc-orange hover:underline font-medium"
                >
                  Sign In
                </button>
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5.3 Update Password Page (`src/app/(auth)/update-password/page.tsx`)

This page is shown when a user clicks the password reset link in their email.

```typescript
// src/app/(auth)/update-password/page.tsx
'use client';

import { useState } from 'react';
import { Train, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { updatePassword } from '@/lib/actions/auth';

export default function UpdatePasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    const result = await updatePassword(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // On success, the server action redirects to /dashboard
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-rc-bg p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="flex items-center justify-center size-12 rounded-xl bg-rc-orange mb-2">
            <Train className="size-7 text-white" />
          </div>
          <CardTitle className="font-heading text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your new password below.</CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-center">
              <p className="text-xs text-red-800 font-medium">{error}</p>
            </div>
          )}

          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                New Password
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Min. 8 characters"
                required
                minLength={8}
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm Password
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                required
                minLength={8}
                className="h-11"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-rc-orange hover:bg-rc-orange-dark text-white font-semibold"
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

### 5.4 Sign Out Implementation

Sign out can be triggered from any client component (e.g., the Topbar user menu):

```typescript
// In any client component (e.g., Topbar user dropdown)
import { signOut } from '@/lib/actions/auth';

// In JSX:
<form action={signOut}>
  <button type="submit">Sign Out</button>
</form>
```

---

## 6. Auth Hooks & Context

### 6.1 Auth Context Provider (`src/components/providers/AuthProvider.tsx`)

Provides the current user and profile to the entire client-side app tree.

```typescript
// src/components/providers/AuthProvider.tsx
'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  session: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('*, organization:organizations(*)')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data as Profile);
      }
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    // Get the initial session
    const getInitialSession = async () => {
      const {
        data: { session: initialSession },
      } = await supabase.auth.getSession();

      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        await fetchProfile(initialSession.user.id);
      }

      setLoading(false);
    };

    getInitialSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_IN' && newSession?.user) {
        await fetchProfile(newSession.user.id);
      }

      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{ user, profile, session, loading, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### 6.2 Mount the Provider

Wrap the app layout with the `AuthProvider`:

```typescript
// src/app/(app)/layout.tsx (updated)
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AuthProvider } from '@/components/providers/AuthProvider';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import MobileNav from '@/components/layout/MobileNav';
import PageTransition from '@/components/shared/PageTransition';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <AuthProvider>
      <div className="flex h-screen overflow-hidden bg-rc-bg">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
        <MobileNav />
      </div>
    </AuthProvider>
  );
}
```

### 6.3 `useUser` Hook (Shorthand)

```typescript
// src/hooks/useUser.ts
'use client';

import { useAuth } from '@/components/providers/AuthProvider';

/**
 * Shorthand hook to get the current user and profile.
 * Must be used within the AuthProvider (i.e., inside (app) layout).
 */
export function useUser() {
  const { user, profile, loading, refreshProfile } = useAuth();
  return { user, profile, loading, refreshProfile };
}
```

---

## 7. Email Templates (Supabase)

Configure these in **Supabase Dashboard > Authentication > Email Templates**.

### 7.1 Confirmation Email

```html
<!-- Subject: Confirm your RailCommand account -->
<div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a;">
  <div style="text-align: center; padding: 32px 0 24px;">
    <div style="display: inline-block; width: 48px; height: 48px; background-color: #F97316; border-radius: 12px; line-height: 48px; text-align: center;">
      <span style="color: white; font-size: 24px; font-weight: bold;">R</span>
    </div>
    <h1 style="margin: 16px 0 4px; font-size: 22px; font-weight: 700;">RailCommand</h1>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Construction &amp; Rail Project Management</p>
  </div>

  <div style="padding: 0 24px 32px;">
    <h2 style="font-size: 18px; margin-bottom: 12px;">Confirm your email</h2>
    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
      Click the button below to confirm your email address and activate your RailCommand account.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block; background-color: #F97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Confirm Email Address
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      If you didn't create a RailCommand account, you can safely ignore this email.
    </p>
  </div>
</div>
```

### 7.2 Password Reset Email

```html
<!-- Subject: Reset your RailCommand password -->
<div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a;">
  <div style="text-align: center; padding: 32px 0 24px;">
    <div style="display: inline-block; width: 48px; height: 48px; background-color: #F97316; border-radius: 12px; line-height: 48px; text-align: center;">
      <span style="color: white; font-size: 24px; font-weight: bold;">R</span>
    </div>
    <h1 style="margin: 16px 0 4px; font-size: 22px; font-weight: 700;">RailCommand</h1>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Construction &amp; Rail Project Management</p>
  </div>

  <div style="padding: 0 24px 32px;">
    <h2 style="font-size: 18px; margin-bottom: 12px;">Reset your password</h2>
    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
      We received a request to reset the password for your RailCommand account. Click the button below to choose a new password.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block; background-color: #F97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Reset Password
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      This link expires in 24 hours. If you didn't request a password reset, you can safely ignore this email.
    </p>
  </div>
</div>
```

### 7.3 Magic Link Email (if enabled)

```html
<!-- Subject: Your RailCommand sign-in link -->
<div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a;">
  <div style="text-align: center; padding: 32px 0 24px;">
    <div style="display: inline-block; width: 48px; height: 48px; background-color: #F97316; border-radius: 12px; line-height: 48px; text-align: center;">
      <span style="color: white; font-size: 24px; font-weight: bold;">R</span>
    </div>
    <h1 style="margin: 16px 0 4px; font-size: 22px; font-weight: 700;">RailCommand</h1>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Construction &amp; Rail Project Management</p>
  </div>

  <div style="padding: 0 24px 32px;">
    <h2 style="font-size: 18px; margin-bottom: 12px;">Your sign-in link</h2>
    <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
      Click the button below to sign in to your RailCommand account. This link is valid for a limited time.
    </p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{ .ConfirmationURL }}"
         style="display: inline-block; background-color: #F97316; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Sign In to RailCommand
      </a>
    </div>
    <p style="color: #9ca3af; font-size: 12px; text-align: center;">
      If you didn't request this link, you can safely ignore this email.
    </p>
  </div>
</div>
```

---

## 8. Error Handling

### 8.1 Auth Error Map

Create a utility to convert Supabase auth error codes to user-friendly messages:

```typescript
// src/lib/auth-errors.ts

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  // Sign in errors
  'Invalid login credentials':
    'Incorrect email or password. Please try again.',
  'Email not confirmed':
    'Please check your email and confirm your account before signing in.',
  'Invalid Refresh Token: Refresh Token Not Found':
    'Your session has expired. Please sign in again.',

  // Sign up errors
  'User already registered':
    'An account with this email already exists. Try signing in instead.',
  'Password should be at least 8 characters':
    'Password must be at least 8 characters long.',
  'Signup requires a valid password':
    'Please enter a valid password (minimum 8 characters).',

  // Rate limiting
  'For security purposes, you can only request this after':
    'Too many requests. Please wait a moment before trying again.',
  'Rate limit exceeded':
    'Too many attempts. Please wait a few minutes before trying again.',

  // OAuth errors
  'OAuth error':
    'There was a problem signing in with Google. Please try again.',

  // Password reset
  'Unable to validate email address: invalid format':
    'Please enter a valid email address.',

  // Generic
  'User not found': 'No account found with this email address.',
  'Network request failed':
    'Unable to reach the server. Please check your internet connection.',
};

/**
 * Convert a Supabase auth error message to a user-friendly message.
 */
export function getAuthErrorMessage(error: string): string {
  // Check for exact match first
  if (AUTH_ERROR_MESSAGES[error]) {
    return AUTH_ERROR_MESSAGES[error];
  }

  // Check for partial match (some errors include variable content)
  for (const [key, message] of Object.entries(AUTH_ERROR_MESSAGES)) {
    if (error.includes(key)) {
      return message;
    }
  }

  // Fallback
  return 'An unexpected error occurred. Please try again.';
}
```

### 8.2 Using the Error Map in Server Actions

Update `src/lib/actions/auth.ts` to use the error map:

```typescript
// In signIn, signUp, etc.:
import { getAuthErrorMessage } from '@/lib/auth-errors';

// Instead of returning error.message directly:
if (error) {
  return { error: getAuthErrorMessage(error.message) };
}
```

### 8.3 Network Error Handling

For client-side operations (like Google OAuth), wrap calls in try/catch:

```typescript
async function handleGoogleSignIn() {
  try {
    setGoogleLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setError(getAuthErrorMessage(error.message));
      setGoogleLoading(false);
    }
  } catch {
    setError('Unable to reach the server. Please check your internet connection.');
    setGoogleLoading(false);
  }
}
```

### 8.4 Rate Limiting Considerations

- Supabase has built-in rate limiting on auth endpoints (configurable per project).
- Default: 30 requests per hour for password-based auth per IP.
- For production, review and configure in **Supabase Dashboard > Authentication > Rate Limits**.
- On the client, disable the submit button after a submission and show a loading state to prevent double-clicks.
- Display the rate-limit error message from the error map when users hit the limit.

---

## 9. Security Checklist

### 9.1 PKCE Flow

Supabase uses **PKCE (Proof Key for Code Exchange)** by default for the `@supabase/ssr` package. This is automatically handled -- no additional configuration required. The `exchangeCodeForSession` call in the auth callback route is the PKCE verification step.

### 9.2 Secure Cookie Configuration

The `@supabase/ssr` library handles cookie security automatically:

- Cookies are `HttpOnly` (not accessible via JavaScript).
- Cookies use `SameSite=Lax` (protects against CSRF in most cases).
- Cookies use `Secure` flag when served over HTTPS (production on Vercel).
- Session tokens are split into chunks to avoid exceeding browser cookie size limits.

### 9.3 CSRF Protection

- Next.js Server Actions include built-in CSRF protection via origin checking.
- The `SameSite=Lax` cookie setting provides additional CSRF protection.
- The PKCE flow prevents authorization code interception attacks.

### 9.4 Input Sanitization

- All auth inputs (email, password) go directly to Supabase Auth API, which handles sanitization.
- For profile updates, always use parameterized queries (the Supabase client does this automatically).
- Never concatenate user input into SQL strings.

### 9.5 Password Requirements

Configure in Supabase Dashboard and enforce on the client:

| Requirement | Value |
|---|---|
| Minimum length | 8 characters |
| HTML `minLength` attribute | Set on all password inputs |
| Leaked password protection | Enabled (Supabase dashboard) |

Client-side enforcement:

```typescript
<Input
  type="password"
  minLength={8}
  required
  pattern=".{8,}"
  title="Password must be at least 8 characters"
/>
```

### 9.6 Environment Variable Security

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are safe to expose (they are scoped to RLS policies).
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the client. Only use in:
  - Server Actions
  - API Routes
  - `src/lib/supabase/admin.ts`
- Add to `.gitignore`: `.env.local`, `.env*.local`
- Verify `.env.local` is already in `.gitignore` before proceeding.

### 9.7 Additional Security Measures

- [ ] Enable Supabase Auth email confirmation (prevents fake signups).
- [ ] Set up a custom SMTP provider for production emails (improves deliverability and avoids Supabase free-tier email limits).
- [ ] Configure allowed redirect URLs to only include your domains.
- [ ] Review Supabase auth logs periodically for suspicious activity.
- [ ] Enable MFA/2FA for admin users in a future phase.

---

## 10. File Structure

### 10.1 Files to Create

| # | File | Purpose |
|---|---|---|
| 1 | `src/middleware.ts` | Auth session refresh + route protection |
| 2 | `src/app/auth/callback/route.ts` | OAuth + email link callback handler |
| 3 | `src/lib/actions/auth.ts` | Server actions: signIn, signUp, signOut, resetPassword, updatePassword |
| 4 | `src/lib/supabase/admin.ts` | Service role client for admin operations |
| 5 | `src/lib/supabase/auth-helpers.ts` | Server-side helpers: getAuthenticatedUser, getCurrentProfile |
| 6 | `src/lib/auth-errors.ts` | Auth error code to user-friendly message mapping |
| 7 | `src/components/providers/AuthProvider.tsx` | Client-side auth context provider with session listener |
| 8 | `src/hooks/useUser.ts` | Shorthand hook for accessing current user/profile |
| 9 | `src/app/(auth)/update-password/page.tsx` | Password reset confirmation page |

### 10.2 Files to Modify

| # | File | Changes |
|---|---|---|
| 1 | `src/app/(auth)/login/page.tsx` | Replace demo login with real auth (email/password, Google OAuth, password reset) |
| 2 | `src/app/(app)/layout.tsx` | Add server-side auth check + wrap with AuthProvider |
| 3 | `.env.local` | Add `SUPABASE_SERVICE_ROLE_KEY` and optionally `NEXT_PUBLIC_SITE_URL` |

### 10.3 SQL to Run in Supabase Dashboard (SQL Editor)

| # | Purpose |
|---|---|
| 1 | Create `organizations` table (Section 2.2) |
| 2 | Create `profiles` table (Section 2.1) |
| 3 | Create `handle_new_user` trigger function + trigger (Section 2.3) |
| 4 | Create `update_updated_at` trigger function + trigger (Section 2.4) |
| 5 | Create `project_members` table if not exists (Section 2.5) |
| 6 | Enable RLS on all tables (Section 3.1) |
| 7 | Create all RLS policies (Sections 3.2 -- 3.5) |

### 10.4 Implementation Order

Follow this order to build incrementally and test at each step:

```
Step 1:  Environment variables (.env.local, Vercel)
Step 2:  Supabase Dashboard -- enable Email provider, configure Google OAuth
Step 3:  Supabase Dashboard -- configure Site URL + Redirect URLs
Step 4:  Run SQL -- create tables, triggers, enable RLS, create policies
Step 5:  Create src/middleware.ts
Step 6:  Create src/app/auth/callback/route.ts
Step 7:  Create src/lib/supabase/admin.ts
Step 8:  Create src/lib/supabase/auth-helpers.ts
Step 9:  Create src/lib/auth-errors.ts
Step 10: Create src/lib/actions/auth.ts
Step 11: Update src/app/(auth)/login/page.tsx (replace demo with real auth)
Step 12: Create src/app/(auth)/update-password/page.tsx
Step 13: Create src/components/providers/AuthProvider.tsx
Step 14: Create src/hooks/useUser.ts
Step 15: Update src/app/(app)/layout.tsx (add auth check + AuthProvider)
Step 16: Configure email templates in Supabase Dashboard
Step 17: Test all flows (see Section 11)
```

---

## 11. Testing Plan

### 11.1 Manual Testing Checklist

#### Email/Password Sign Up

- [ ] Navigate to `/login` and switch to "Sign Up" view.
- [ ] Enter a valid name, email, and password (8+ characters).
- [ ] Submit the form.
- [ ] Verify a success message appears: "Check your email for a confirmation link."
- [ ] Check email inbox for the confirmation email.
- [ ] Click the confirmation link.
- [ ] Verify you are redirected to `/dashboard`.
- [ ] Verify a row was created in `public.profiles` with the correct `full_name` and `email`.

#### Email/Password Sign In

- [ ] Navigate to `/login`.
- [ ] Enter valid credentials for a confirmed user.
- [ ] Submit the form.
- [ ] Verify redirect to `/dashboard`.
- [ ] Verify user data is available via `useAuth()` / `useUser()`.

#### Google OAuth Sign In

- [ ] Navigate to `/login`.
- [ ] Click "Continue with Google".
- [ ] Verify redirect to Google OAuth consent screen.
- [ ] Complete Google sign-in.
- [ ] Verify redirect back to `/auth/callback` then to `/dashboard`.
- [ ] Verify a profile was created with the Google name and avatar.

#### Password Reset

- [ ] Navigate to `/login` and click "Forgot password?".
- [ ] Enter your email and submit.
- [ ] Verify success message appears.
- [ ] Check email for the reset link.
- [ ] Click the reset link.
- [ ] Verify you land on the `/auth/update-password` page.
- [ ] Enter a new password and submit.
- [ ] Verify redirect to `/dashboard`.
- [ ] Sign out and sign in with the new password.

#### Sign Out

- [ ] While authenticated, trigger sign out.
- [ ] Verify redirect to `/login`.
- [ ] Verify that navigating to `/dashboard` redirects back to `/login`.

#### Route Protection

- [ ] Without signing in, navigate directly to `/dashboard`.
- [ ] Verify redirect to `/login`.
- [ ] Without signing in, navigate to any `/projects/*` route.
- [ ] Verify redirect to `/login`.
- [ ] After signing in, verify `/login` redirects to `/dashboard`.

#### Session Persistence

- [ ] Sign in and close the browser tab.
- [ ] Re-open the app and navigate to `/dashboard`.
- [ ] Verify you are still authenticated (session cookie is valid).

### 11.2 Edge Cases to Verify

| # | Scenario | Expected Behavior |
|---|---|---|
| 1 | Sign up with an already-registered email | Error: "An account with this email already exists." |
| 2 | Sign in with wrong password | Error: "Incorrect email or password." |
| 3 | Sign in with unconfirmed email | Error: "Please check your email and confirm your account." |
| 4 | Sign up with password less than 8 characters | Client-side validation prevents submission; server returns error if bypassed. |
| 5 | Submit empty email field | HTML `required` attribute prevents submission. |
| 6 | Double-click submit button | Button is disabled during loading; only one request is sent. |
| 7 | OAuth cancelled by user (back button on Google consent) | User returns to `/login` with no error (or a dismissible error). |
| 8 | Expired password reset link | Error on callback; user is redirected to `/login` with an error message. |
| 9 | Open `/auth/callback` directly without a code | Redirect to `/login?error=auth_callback_failed`. |
| 10 | Network failure during sign in | Error: "Unable to reach the server." |
| 11 | Multiple rapid sign-in attempts | Rate limit error is displayed after threshold. |
| 12 | Sign in from a different browser/device | Works normally; each device gets its own session. |
| 13 | Concurrent tab usage | All tabs share the same session via cookies; signing out in one tab is reflected in others on next navigation. |

### 11.3 Database Verification

After testing, verify in the Supabase Dashboard:

- [ ] `auth.users` table has entries for all test signups (email + Google).
- [ ] `public.profiles` table has matching entries (created by the trigger).
- [ ] Google OAuth profiles have `avatar_url` populated from the Google picture.
- [ ] The `updated_at` field changes when a profile is modified.
- [ ] RLS policies work: query `profiles` as one user and confirm only authorized rows are returned.

---

## 12. Profile Management & Settings Backend

This section covers everything needed to make the Profile page (`/settings/profile`) and Settings page (`/settings`) fully functional with Supabase — including profile updates, avatar uploads, password changes, and notification preferences.

### 12.1 Profile Update Server Action

Updates user profile fields (full name, phone). Email changes are admin-only and not exposed in the UI.

```typescript
// src/lib/actions/profile.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Update the current user's profile (name, phone).
 */
export async function updateProfile(data: { fullName: string; phone: string }) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: data.fullName,
      phone: data.phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return { error: error.message };
  }

  // Also update auth.users metadata so it stays in sync
  await supabase.auth.updateUser({
    data: { full_name: data.fullName },
  });

  revalidatePath('/settings/profile');
  return { success: true };
}

/**
 * Update the user's avatar URL after a successful upload.
 */
export async function updateAvatarUrl(avatarUrl: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (error) {
    return { error: error.message };
  }

  // Sync with auth metadata
  await supabase.auth.updateUser({
    data: { avatar_url: avatarUrl },
  });

  revalidatePath('/settings/profile');
  return { success: true };
}

/**
 * Change password from Settings page (user knows current password).
 * Different from resetPassword which sends an email link.
 */
export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  // Verify current password by attempting a sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: data.currentPassword,
  });

  if (verifyError) {
    return { error: 'Current password is incorrect.' };
  }

  // Update to new password
  const { error: updateError } = await supabase.auth.updateUser({
    password: data.newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

/**
 * Sign out from all devices by revoking the session.
 * Supabase currently signs out the current session; for "all devices",
 * use scope: 'global'.
 */
export async function signOutAllDevices() {
  const supabase = await createClient();

  const { error } = await supabase.auth.signOut({ scope: 'global' });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
```

### 12.2 Avatar Upload Client Helper

Avatar uploads must happen client-side (browser → Supabase Storage). After upload, call the `updateAvatarUrl` server action to persist the URL.

```typescript
// src/lib/avatar-upload.ts
import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface AvatarUploadResult {
  url: string | null;
  error: string | null;
}

/**
 * Upload an avatar image to Supabase Storage.
 * Returns the public URL on success.
 */
export async function uploadAvatar(
  userId: string,
  file: File
): Promise<AvatarUploadResult> {
  // Validate file
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { url: null, error: 'File must be JPEG, PNG, or WebP.' };
  }
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: 'File must be under 2MB.' };
  }

  const supabase = createClient();
  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const filePath = `${userId}/avatar.${fileExt}`;

  // Upload (upsert: true replaces the existing avatar)
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
    });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  // Get public URL
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Append cache-buster so browser shows the new image
  const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

  return { url: publicUrl, error: null };
}

/**
 * Delete the user's avatar from Supabase Storage.
 */
export async function deleteAvatar(userId: string): Promise<{ error: string | null }> {
  const supabase = createClient();

  // List all files in the user's folder
  const { data: files, error: listError } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (listError) {
    return { error: listError.message };
  }

  if (files && files.length > 0) {
    const filePaths = files.map((f) => `${userId}/${f.name}`);
    const { error: deleteError } = await supabase.storage
      .from('avatars')
      .remove(filePaths);

    if (deleteError) {
      return { error: deleteError.message };
    }
  }

  return { error: null };
}
```

### 12.3 Wiring Avatar Upload in the Profile Page

When the backend is connected, replace the disabled avatar button in `src/app/(app)/settings/profile/page.tsx` with:

```typescript
// Inside ProfilePage component — add to existing imports:
import { uploadAvatar } from '@/lib/avatar-upload';
import { updateAvatarUrl } from '@/lib/actions/profile';

// Add a hidden file input and handler:
const fileInputRef = useRef<HTMLInputElement>(null);

const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  setIsSaving(true);
  const { url, error } = await uploadAvatar(profile.id, file);

  if (error) {
    // Show error toast
    setSuccessMessage(''); // clear any success
    setIsSaving(false);
    return;
  }

  if (url) {
    const result = await updateAvatarUrl(url);
    if (result.success) {
      setSuccessMessage('Avatar updated');
      // Refresh profile data
    }
  }
  setIsSaving(false);
};

// In the JSX, replace the disabled button:
<input
  ref={fileInputRef}
  type="file"
  accept="image/jpeg,image/png,image/webp"
  onChange={handleAvatarUpload}
  className="hidden"
  aria-label="Upload avatar image"
/>
<Button
  variant="outline"
  size="sm"
  onClick={() => fileInputRef.current?.click()}
  className="shrink-0 gap-1.5 text-xs"
>
  <Camera className="size-3.5" />
  Change Avatar
</Button>
```

### 12.4 Wiring Profile Form Save

Replace the simulated `onSubmit` in the profile page:

```typescript
import { updateProfile } from '@/lib/actions/profile';

const onSubmit = async (data: ProfileFormData) => {
  setIsSaving(true);
  const result = await updateProfile({
    fullName: data.fullName,
    phone: data.phone,
  });

  if (result.error) {
    setSuccessMessage(''); // clear
    // Optionally show error
  } else {
    setSuccessMessage('Profile updated successfully');
  }
  setIsSaving(false);
};
```

### 12.5 Wiring Change Password in Settings

Replace the simulated password handler in `src/app/(app)/settings/page.tsx`:

```typescript
import { changePassword } from '@/lib/actions/profile';

const handlePasswordSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setPasswordError('');
  setPasswordSuccess(false);

  if (!currentPassword) {
    setPasswordError('Current password is required.');
    return;
  }
  if (newPassword.length < 8) {
    setPasswordError('New password must be at least 8 characters.');
    return;
  }
  if (newPassword !== confirmPassword) {
    setPasswordError('New passwords do not match.');
    return;
  }

  const result = await changePassword({
    currentPassword,
    newPassword,
  });

  if (result.error) {
    setPasswordError(result.error);
  } else {
    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 4000);
  }
};
```

---

## 13. Supabase Storage (Avatars)

### 13.1 Create the Avatars Bucket

In the Supabase Dashboard:

1. Go to **Storage**.
2. Click **New Bucket**.
3. Set:
   - **Name:** `avatars`
   - **Public:** **Yes** (avatars are displayed in the UI to all project members)
   - **File size limit:** `2097152` (2MB)
   - **Allowed MIME types:** `image/jpeg, image/png, image/webp`
4. Click **Create bucket**.

### 13.2 Storage RLS Policies

```sql
-- ============================================================
-- STORAGE POLICIES: avatars bucket
-- ============================================================

-- Anyone can read avatars (they're public profile pictures)
CREATE POLICY "Anyone can read avatars"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload their own avatar (folder name = user ID)
CREATE POLICY "Users can upload own avatar"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update (overwrite) their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

### 13.3 Storage File Structure

Avatars are stored with user-scoped folders:

```
avatars/
  {user-uuid}/
    avatar.jpg      (or .png, .webp)
```

This ensures:
- Each user can only modify files in their own folder (enforced by RLS)
- Overwriting uses `upsert: true` so only one avatar exists per user
- Public URL format: `https://<project>.supabase.co/storage/v1/object/public/avatars/{uuid}/avatar.jpg`

---

## 14. User Preferences

### 14.1 User Preferences Table

Stores per-user settings like theme preference and notification toggles. Uses JSONB for flexible key-value storage.

```sql
-- ============================================================
-- USER PREFERENCES TABLE
-- ============================================================
CREATE TABLE public.user_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme        TEXT NOT NULL DEFAULT 'light'
                 CHECK (theme IN ('light', 'dark', 'auto')),
  notifications JSONB NOT NULL DEFAULT '{
    "email": true,
    "submittal": true,
    "rfi": true,
    "dailyLog": false,
    "punchList": true
  }'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences (user_id);

-- Auto-update timestamp
CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 14.2 Auto-Create Preferences on Signup

Extend the existing `handle_new_user` trigger to also create default preferences:

```sql
-- ============================================================
-- Updated TRIGGER: handle_new_user (replaces existing)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'picture', '')
  );

  -- Create default preferences
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 14.3 RLS Policies for Preferences

```sql
-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read their own preferences
CREATE POLICY "Users can read own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can insert their own preferences (in case trigger didn't fire)
CREATE POLICY "Users can insert own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

### 14.4 Preferences Server Actions

```typescript
// src/lib/actions/preferences.ts
'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface NotificationPreferences {
  email: boolean;
  submittal: boolean;
  rfi: boolean;
  dailyLog: boolean;
  punchList: boolean;
}

/**
 * Get the current user's preferences. Creates defaults if none exist.
 */
export async function getPreferences() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code === 'PGRST116') {
    // No row found — create defaults
    const { data: newPrefs, error: insertError } = await supabase
      .from('user_preferences')
      .insert({ user_id: user.id })
      .select()
      .single();

    if (insertError) return { error: insertError.message };
    return { data: newPrefs };
  }

  if (error) return { error: error.message };
  return { data };
}

/**
 * Update theme preference.
 */
export async function updateThemePreference(theme: 'light' | 'dark' | 'auto') {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('user_preferences')
    .update({ theme })
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { success: true };
}

/**
 * Update notification preferences.
 */
export async function updateNotificationPreferences(
  notifications: NotificationPreferences
) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: 'Not authenticated' };
  }

  const { error } = await supabase
    .from('user_preferences')
    .update({ notifications })
    .eq('user_id', user.id);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { success: true };
}
```

### 14.5 Wiring Preferences to the Settings Page

When the backend is connected, update the Settings page to load and save preferences:

```typescript
// In src/app/(app)/settings/page.tsx — add to imports:
import { getPreferences, updateThemePreference, updateNotificationPreferences } from '@/lib/actions/preferences';

// On mount, load preferences:
useEffect(() => {
  async function load() {
    const result = await getPreferences();
    if (result.data) {
      // Set theme from DB (but ThemeProvider also reads localStorage)
      if (result.data.theme) {
        setMode(result.data.theme as ThemeMode);
      }
      // Set notification toggles from DB
      if (result.data.notifications) {
        setNotifications(result.data.notifications);
      }
    }
  }
  load();
}, []);

// When theme changes, persist to DB:
const handleThemeChange = async (newTheme: ThemeMode) => {
  setMode(newTheme); // Update UI immediately via ThemeProvider
  await updateThemePreference(newTheme); // Persist to Supabase
};

// When a notification toggle changes, persist to DB:
const handleNotificationToggle = async (key: string) => {
  const updated = { ...notifications, [key]: !notifications[key] };
  setNotifications(updated); // Update UI immediately
  await updateNotificationPreferences(updated as NotificationPreferences); // Persist
};
```

### 14.6 Syncing Theme Between Devices

The current ThemeProvider reads from `localStorage`. To sync theme across devices:

1. On app load, the `AuthProvider` fetches user preferences from Supabase
2. Writes the theme value to `localStorage`
3. ThemeProvider picks it up from `localStorage` as it already does

This ensures:
- **Fast load**: Theme applies instantly from `localStorage` (no flash)
- **Cross-device sync**: New devices pull the preference from Supabase on first load
- **Offline resilience**: `localStorage` works even if Supabase is unreachable

```typescript
// In AuthProvider or app layout initialization:
const prefs = await getPreferences();
if (prefs.data?.theme) {
  localStorage.setItem('rc-theme-mode', prefs.data.theme);
  // ThemeProvider reads this on mount
}
```

---

## 15. Profile & Settings Testing Plan

### 15.1 Profile Page Testing

#### Profile Info Update

- [ ] Navigate to `/settings/profile`.
- [ ] Verify profile is pre-filled with current user data (name, email, phone).
- [ ] Change the full name and click "Save Changes".
- [ ] Verify success toast appears.
- [ ] Refresh the page — verify the new name persists.
- [ ] Verify the Topbar displays the updated name.
- [ ] Verify `updated_at` changed in the `profiles` table.

#### Email Field (Read-Only)

- [ ] Verify the email field is disabled and cannot be edited.
- [ ] Verify "Contact admin to change email" helper text is visible.

#### Phone Update

- [ ] Change phone number to a valid format, save.
- [ ] Verify it persists on refresh.
- [ ] Enter an invalid phone format — verify validation error appears.
- [ ] Clear the phone field — verify save works (phone is optional).

#### Avatar Upload

- [ ] Click "Change Avatar".
- [ ] Select a JPEG file under 2MB.
- [ ] Verify upload succeeds and avatar displays immediately.
- [ ] Refresh — verify avatar persists (loaded from Supabase Storage URL).
- [ ] Try uploading a file over 2MB — verify error message.
- [ ] Try uploading a non-image file (.pdf) — verify error message.
- [ ] Verify the file was stored in `avatars/{user-id}/avatar.jpg` in Supabase Storage.

#### Organization Details

- [ ] Verify organization name, type, and member-since date display correctly.
- [ ] Verify these fields are read-only (no edit controls).

#### Project Membership

- [ ] Verify current project name, role, and access level display correctly.
- [ ] Click "View Project Team" — verify navigation to `/projects/proj-001/team`.

#### Account Actions

- [ ] Click "Sign Out" — verify redirect to `/login`.
- [ ] Click "Delete Account" — verify dialog appears with support contact info.
- [ ] Verify dialog can be closed without any destructive action.

### 15.2 Settings Page Testing

#### Theme Switching

- [ ] Navigate to `/settings`.
- [ ] Click each theme option (Light, Dark, Auto).
- [ ] Verify the UI updates immediately on each click.
- [ ] Refresh the page — verify the selected theme persists.
- [ ] Open the app in a different browser/device — verify theme preference syncs after login.
- [ ] Verify `user_preferences.theme` in the database matches the selected theme.

#### Notification Toggles

- [ ] Toggle each notification setting on and off.
- [ ] Verify the toggle UI updates immediately.
- [ ] Refresh the page — verify toggle states persist.
- [ ] Verify `user_preferences.notifications` JSONB in the database matches the UI state.

#### Change Password

- [ ] Enter current password, new password (8+ chars), and confirm.
- [ ] Submit — verify success message.
- [ ] Sign out and sign back in with the new password — verify it works.
- [ ] Sign out and try the old password — verify it fails.
- [ ] Enter wrong current password — verify "Current password is incorrect" error.
- [ ] Enter new password under 8 characters — verify validation error.
- [ ] Enter mismatched confirm password — verify validation error.

#### Active Sessions

- [ ] Verify the current session card displays (Chrome on macOS, etc.).
- [ ] Click "Sign Out All Devices" — verify redirect to `/login`.
- [ ] On another device, verify the session was revoked (redirect to `/login`).

#### Danger Zone

- [ ] Click "Delete Account" — verify inline warning appears.
- [ ] Verify the warning says to contact the administrator.
- [ ] Click "Dismiss" — verify warning closes.

### 15.3 Database Verification

After testing, verify in the Supabase Dashboard:

- [ ] `profiles` table: `full_name`, `phone`, `avatar_url`, `updated_at` all reflect changes.
- [ ] `user_preferences` table: `theme` and `notifications` JSONB match what was set in the UI.
- [ ] `avatars` storage bucket: avatar file exists at `{user-id}/avatar.{ext}`.
- [ ] RLS: Query `user_preferences` as one user — confirm only that user's row is returned.
- [ ] RLS: Attempt to update another user's profile — confirm it's denied.
- [ ] Storage RLS: Attempt to upload to another user's avatar folder — confirm it's denied.

### 15.4 Files to Create (Settings & Profile Backend)

| # | File | Purpose |
|---|---|---|
| 1 | `src/lib/actions/profile.ts` | Server actions: updateProfile, updateAvatarUrl, changePassword, signOutAllDevices |
| 2 | `src/lib/actions/preferences.ts` | Server actions: getPreferences, updateThemePreference, updateNotificationPreferences |
| 3 | `src/lib/avatar-upload.ts` | Client-side avatar upload helper (browser → Supabase Storage) |

### 15.5 Files to Modify (Settings & Profile Backend)

| # | File | Changes |
|---|---|---|
| 1 | `src/app/(app)/settings/profile/page.tsx` | Replace simulated save with `updateProfile` server action; wire avatar upload |
| 2 | `src/app/(app)/settings/page.tsx` | Replace simulated handlers with `changePassword`, `updateThemePreference`, `updateNotificationPreferences` |
| 3 | `src/components/layout/Topbar.tsx` | Pull user name/avatar from auth context instead of hardcoded seed data |
| 4 | `src/components/providers/AuthProvider.tsx` | Fetch user preferences on login, sync theme to localStorage |

### 15.6 SQL to Run (Settings & Profile Backend)

| # | Purpose |
|---|---|
| 1 | Create `user_preferences` table (Section 14.1) |
| 2 | Update `handle_new_user` trigger to also create preferences (Section 14.2) |
| 3 | Enable RLS on `user_preferences` + create policies (Section 14.3) |
| 4 | Create `avatars` storage bucket (Section 13.1) |
| 5 | Create storage RLS policies for `avatars` bucket (Section 13.2) |

### 15.7 Implementation Order (Settings & Profile Backend)

```
Step 1:  Run SQL — create user_preferences table, update trigger, enable RLS
Step 2:  Create avatars storage bucket + storage policies in Supabase Dashboard
Step 3:  Create src/lib/actions/profile.ts (server actions)
Step 4:  Create src/lib/actions/preferences.ts (server actions)
Step 5:  Create src/lib/avatar-upload.ts (client helper)
Step 6:  Update src/app/(app)/settings/profile/page.tsx (wire real data)
Step 7:  Update src/app/(app)/settings/page.tsx (wire real data)
Step 8:  Update Topbar to pull from auth context
Step 9:  Test all flows (see Section 15)
```

---

## 16. Role-Based Access Control (RBAC)

This is the comprehensive plan for implementing role-based permissions across the entire app.

### 16.1 Permission Model Overview

The system uses a two-tier role model:

**Tier 1: Organization Role (profile.role)**
- `admin` — Systemwide access, can manage users/orgs/all projects
- `manager` — Full access within assigned projects
- `member` — Standard access based on project role
- `viewer` — Read-only everywhere

**Tier 2: Project Role (project_members.project_role)**
- `manager` (Project Manager) — Approve submittals, manage team, see financials
- `superintendent` — Field ops lead, daily logs, punch lists, schedule
- `foreman` — Field crew lead, daily logs, punch lists
- `engineer` — Technical reviewer, approve submittals, answer RFIs
- `contractor` — Submit submittals, create RFIs, field work
- `inspector` — Read-mostly, verify punch list items
- `owner` — Read-only dashboard, high-level visibility

**Combined Access Resolution:**

Access = max(organization_role_access, project_role_access)
- An `admin` org role always has full access regardless of project role
- A `viewer` org role is always read-only regardless of project role
- A `member` org role defers to the project role for specific permissions

### 16.2 Permission Constants

```typescript
// src/lib/permissions.ts

export type Action =
  | 'submittal:create'
  | 'submittal:review'      // approve/reject/conditional
  | 'submittal:view'
  | 'rfi:create'
  | 'rfi:respond'
  | 'rfi:close'
  | 'rfi:view'
  | 'daily_log:create'
  | 'daily_log:edit_own'
  | 'daily_log:view'
  | 'punch_list:create'
  | 'punch_list:start_work'
  | 'punch_list:resolve'
  | 'punch_list:verify'
  | 'punch_list:reopen'
  | 'punch_list:view'
  | 'schedule:view'
  | 'schedule:edit'
  | 'budget:view'
  | 'team:view'
  | 'team:manage'        // add/remove members
  | 'team:assign_roles'  // change roles
  | 'project:create'
  | 'project:edit'
  | 'project:delete'
  | 'org:manage';

export type ProjectRole = 'manager' | 'superintendent' | 'foreman' | 'engineer' | 'contractor' | 'inspector' | 'owner';
export type OrgRole = 'admin' | 'manager' | 'member' | 'viewer';

/**
 * Permission matrix for project roles.
 * Organization role overrides: admin = all, viewer = view-only.
 */
const PROJECT_ROLE_PERMISSIONS: Record<ProjectRole, Action[]> = {
  manager: [
    'submittal:create', 'submittal:review', 'submittal:view',
    'rfi:create', 'rfi:respond', 'rfi:close', 'rfi:view',
    'daily_log:create', 'daily_log:edit_own', 'daily_log:view',
    'punch_list:create', 'punch_list:start_work', 'punch_list:resolve',
    'punch_list:verify', 'punch_list:reopen', 'punch_list:view',
    'schedule:view', 'schedule:edit',
    'budget:view',
    'team:view', 'team:manage',
    'project:edit',
  ],
  superintendent: [
    'submittal:create', 'submittal:view',
    'rfi:create', 'rfi:respond', 'rfi:view',
    'daily_log:create', 'daily_log:edit_own', 'daily_log:view',
    'punch_list:create', 'punch_list:start_work', 'punch_list:resolve',
    'punch_list:view',
    'schedule:view', 'schedule:edit',
    'team:view',
  ],
  foreman: [
    'submittal:create', 'submittal:view',
    'rfi:create', 'rfi:respond', 'rfi:view',
    'daily_log:create', 'daily_log:edit_own', 'daily_log:view',
    'punch_list:create', 'punch_list:start_work', 'punch_list:resolve',
    'punch_list:view',
    'schedule:view',
    'team:view',
  ],
  engineer: [
    'submittal:create', 'submittal:review', 'submittal:view',
    'rfi:create', 'rfi:respond', 'rfi:close', 'rfi:view',
    'daily_log:view',
    'punch_list:create', 'punch_list:verify', 'punch_list:reopen',
    'punch_list:view',
    'schedule:view',
    'budget:view',
    'team:view',
  ],
  contractor: [
    'submittal:create', 'submittal:view',
    'rfi:create', 'rfi:respond', 'rfi:view',
    'daily_log:view',
    'punch_list:create', 'punch_list:start_work', 'punch_list:resolve',
    'punch_list:view',
    'schedule:view',
    'team:view',
  ],
  inspector: [
    'submittal:view',
    'rfi:view',
    'daily_log:view',
    'punch_list:verify', 'punch_list:reopen', 'punch_list:view',
    'schedule:view',
    'team:view',
  ],
  owner: [
    'submittal:view',
    'rfi:view',
    'daily_log:view',
    'punch_list:view',
    'schedule:view',
    'budget:view',
    'team:view',
  ],
};

/**
 * Check if a user can perform an action.
 */
export function canPerform(
  orgRole: OrgRole,
  projectRole: ProjectRole | null,
  action: Action
): boolean {
  // Admin can do everything
  if (orgRole === 'admin') return true;

  // Viewer can only view
  if (orgRole === 'viewer') return action.endsWith(':view');

  // Org-level manager gets team:manage and project:edit regardless of project role
  if (orgRole === 'manager') {
    if (['team:manage', 'project:edit', 'project:create'].includes(action)) return true;
  }

  // Defer to project role permissions
  if (!projectRole) return false;
  return PROJECT_ROLE_PERMISSIONS[projectRole]?.includes(action) ?? false;
}

/**
 * Get all allowed actions for a user on a project.
 */
export function getAllowedActions(
  orgRole: OrgRole,
  projectRole: ProjectRole | null
): Action[] {
  if (orgRole === 'admin') {
    // Return all actions
    return Object.values(PROJECT_ROLE_PERMISSIONS).flat().filter((v, i, a) => a.indexOf(v) === i);
  }
  if (orgRole === 'viewer') {
    return Object.values(PROJECT_ROLE_PERMISSIONS).flat().filter(a => a.endsWith(':view')).filter((v, i, a) => a.indexOf(v) === i);
  }
  if (!projectRole) return [];
  const base = [...(PROJECT_ROLE_PERMISSIONS[projectRole] ?? [])];
  if (orgRole === 'manager') {
    if (!base.includes('team:manage')) base.push('team:manage');
    if (!base.includes('project:edit')) base.push('project:edit');
  }
  return base;
}
```

### 16.3 React Hook for Permissions

```typescript
// src/hooks/usePermissions.ts
'use client';

import { useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { canPerform, getAllowedActions, type Action, type ProjectRole, type OrgRole } from '@/lib/permissions';

/**
 * Hook to check permissions for the current user on the current project.
 */
export function usePermissions(projectId?: string) {
  const { profile, projectMemberships } = useAuth();

  const membership = useMemo(() => {
    if (!projectId || !projectMemberships) return null;
    return projectMemberships.find((m) => m.project_id === projectId) ?? null;
  }, [projectId, projectMemberships]);

  const orgRole = (profile?.role ?? 'viewer') as OrgRole;
  const projectRole = (membership?.project_role ?? null) as ProjectRole | null;

  const can = useMemo(
    () => (action: Action) => canPerform(orgRole, projectRole, action),
    [orgRole, projectRole]
  );

  const allowedActions = useMemo(
    () => getAllowedActions(orgRole, projectRole),
    [orgRole, projectRole]
  );

  return {
    can,
    allowedActions,
    orgRole,
    projectRole,
    canEdit: membership?.can_edit ?? orgRole === 'admin',
    isAdmin: orgRole === 'admin',
    isViewer: orgRole === 'viewer',
  };
}
```

### 16.4 Usage Examples in Components

How to use the hook in existing pages:

**Submittal Detail Page -- conditional approve/reject buttons:**
```typescript
const { can } = usePermissions(projectId);

// Only show review buttons for engineers and managers
{can('submittal:review') && (
  <div className="flex gap-2">
    <Button onClick={() => handleApprove()}>Approve</Button>
    <Button onClick={() => handleReject()}>Reject</Button>
  </div>
)}
```

**Sidebar -- conditional navigation items:**
```typescript
const { can } = usePermissions(currentProjectId);

// Hide "New Submittal" quick action if user can't create
{can('submittal:create') && (
  <Link href={`/projects/${id}/submittals/new`}>New Submittal</Link>
)}
```

**Dashboard -- conditional budget widget:**
```typescript
const { can } = usePermissions(projectId);

// Only show budget health card if user can view budget
{can('budget:view') && (
  <BudgetHealthCard ... />
)}
```

**Punch List Detail -- separation of duties:**
```typescript
const { can } = usePermissions(projectId);

// Start/Resolve: field roles
{status === 'open' && can('punch_list:start_work') && (
  <Button onClick={handleStart}>Start Work</Button>
)}

// Verify: inspectors/engineers/managers only (not the resolver)
{status === 'resolved' && can('punch_list:verify') && (
  <Button onClick={handleVerify}>Verify Completion</Button>
)}
```

### 16.5 Server-Side Permission Enforcement

Client-side checks are for UI only. The real enforcement happens server-side.

**Server Action with permission check:**
```typescript
// src/lib/actions/submittals.ts
'use server';

import { createClient } from '@/lib/supabase/server';
import { canPerform } from '@/lib/permissions';

export async function approveSubmittal(projectId: string, submittalId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Get user's profile and project membership
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const { data: membership } = await supabase
    .from('project_members')
    .select('project_role')
    .eq('project_id', projectId)
    .eq('profile_id', user.id)
    .single();

  // Check permission
  if (!canPerform(profile.role, membership?.project_role, 'submittal:review')) {
    return { error: 'You do not have permission to review submittals.' };
  }

  // Proceed with approval...
  const { error } = await supabase
    .from('submittals')
    .update({ status: 'approved', reviewed_by: user.id, review_date: new Date().toISOString() })
    .eq('id', submittalId);

  if (error) return { error: error.message };
  return { success: true };
}
```

### 16.6 RLS Policies for Role Enforcement

Database-level enforcement using RLS. Updated policies that also check project role for write operations:

```sql
-- ============================================================
-- ENHANCED RLS: Submittal review requires engineer or manager role
-- ============================================================
CREATE POLICY "Only reviewers can update submittal status"
  ON public.submittals
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
        AND (
          project_role IN ('manager', 'engineer')
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

-- ============================================================
-- ENHANCED RLS: Daily log creation restricted to field roles
-- ============================================================
CREATE POLICY "Only field roles can create daily logs"
  ON public.daily_logs
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
        AND (
          project_role IN ('manager', 'superintendent', 'foreman')
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

-- ============================================================
-- ENHANCED RLS: Punch list verification requires inspector/engineer/manager
-- ============================================================
-- (Note: This requires a partial update policy. In practice, use a
-- server action that checks role before calling supabase.update())

-- Budget data restricted to specific roles
CREATE POLICY "Only authorized roles can view budget data"
  ON public.projects
  FOR SELECT
  USING (
    id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
        AND (
          project_role IN ('manager', 'owner')
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role IN ('admin', 'manager')
          )
        )
    )
  );
```

> **Note:** RLS can enforce coarse-grained access (member can read, editor can write). Fine-grained action-level control (e.g., only engineers can approve submittals, only inspectors can verify punch lists) is best enforced in server actions using the `canPerform()` helper, with RLS as a safety net.

### 16.7 Updating the AuthProvider

The AuthProvider needs to fetch the user's project memberships so the `usePermissions` hook has the data it needs:

```typescript
// In AuthProvider, after fetching the profile, also fetch memberships:
const { data: memberships } = await supabase
  .from('project_members')
  .select('project_id, project_role, can_edit')
  .eq('profile_id', user.id);

// Expose in context:
// { user, profile, projectMemberships: memberships }
```

### 16.8 Files to Create (RBAC)

| # | File | Purpose |
|---|---|---|
| 1 | `src/lib/permissions.ts` | Permission constants, role-action matrix, `canPerform()` and `getAllowedActions()` |
| 2 | `src/hooks/usePermissions.ts` | React hook for checking permissions in components |

### 16.9 Files to Modify (RBAC)

| # | File | Changes |
|---|---|---|
| 1 | `src/components/providers/AuthProvider.tsx` | Fetch project memberships, expose in context |
| 2 | `src/app/(app)/projects/[id]/submittals/[submittalId]/page.tsx` | Wrap approve/reject buttons with `can('submittal:review')` |
| 3 | `src/app/(app)/projects/[id]/submittals/new/page.tsx` | Redirect if `!can('submittal:create')` |
| 4 | `src/app/(app)/projects/[id]/rfis/[rfiId]/page.tsx` | Wrap respond/close with permission checks |
| 5 | `src/app/(app)/projects/[id]/rfis/new/page.tsx` | Redirect if `!can('rfi:create')` |
| 6 | `src/app/(app)/projects/[id]/daily-logs/new/page.tsx` | Redirect if `!can('daily_log:create')` |
| 7 | `src/app/(app)/projects/[id]/punch-list/[itemId]/page.tsx` | Conditional workflow buttons per role |
| 8 | `src/app/(app)/projects/[id]/punch-list/new/page.tsx` | Redirect if `!can('punch_list:create')` |
| 9 | `src/app/(app)/projects/[id]/team/page.tsx` | Wrap add/remove with `can('team:manage')` |
| 10 | `src/app/(app)/projects/[id]/schedule/page.tsx` | Wrap edit with `can('schedule:edit')`, budget with `can('budget:view')` |
| 11 | `src/app/(app)/dashboard/page.tsx` | Conditional budget widget, filtered quick actions |
| 12 | `src/components/layout/Sidebar.tsx` | Hide action links user can't access |
| 13 | `src/components/dashboard/QuickActions.tsx` | Filter actions by permission |
| 14 | All server actions | Add permission check before mutation |
| 15 | RLS policies in Supabase | Add role-aware write policies |

### 16.10 Implementation Order (RBAC)

```
Step 1:  Create src/lib/permissions.ts (the permission matrix -- no dependencies)
Step 2:  Create src/hooks/usePermissions.ts
Step 3:  Update AuthProvider to fetch project memberships
Step 4:  Update Dashboard (conditional budget, filtered quick actions)
Step 5:  Update Submittal detail page (conditional review buttons)
Step 6:  Update RFI detail page (conditional respond/close)
Step 7:  Update Punch List detail page (conditional workflow buttons)
Step 8:  Update Daily Log new page (redirect if not allowed)
Step 9:  Update Team page (conditional add/remove)
Step 10: Update Schedule page (conditional edit, budget visibility)
Step 11: Update all /new pages (redirect if not allowed)
Step 12: Update Sidebar and QuickActions
Step 13: Add permission checks to all server actions
Step 14: Update RLS policies in Supabase for write operations
Step 15: Test all roles (see testing plan below)
```

### 16.11 RBAC Testing Plan

**Test each role by switching the logged-in user's profile:**

For each of these 7 project roles, verify:

| Test | Project Manager | Superintendent | Foreman | Engineer | Contractor | Inspector | Owner |
|---|---|---|---|---|---|---|---|
| View Dashboard | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| See Budget Widget | Yes | No | No | Yes | No | No | Yes |
| Create Submittal | Yes | Yes | Yes | Yes | Yes | No | No |
| Approve/Reject Submittal | Yes | No | No | Yes | No | No | No |
| Create RFI | Yes | Yes | Yes | Yes | Yes | No | No |
| Respond to RFI | Yes | Yes | Yes | Yes | Yes | No | No |
| Close RFI | Yes | No | No | Yes | No | No | No |
| Create Daily Log | Yes | Yes | Yes | No | No | No | No |
| Create Punch List Item | Yes | Yes | Yes | Yes | Yes | No | No |
| Start Punch List Work | Yes | Yes | Yes | No | Yes | No | No |
| Resolve Punch List Item | Yes | Yes | Yes | No | Yes | No | No |
| Verify Punch List Item | Yes | No | No | Yes | No | Yes | No |
| Reopen Punch List Item | Yes | No | No | Yes | No | Yes | No |
| Edit Schedule | Yes | Yes | No | No | No | No | No |
| Manage Team Members | Yes | No | No | No | No | No | No |
| View Team Directory | Yes | Yes | Yes | Yes | Yes | Yes | Yes |

**Additional RBAC tests:**
- [ ] Admin org role overrides all project role restrictions
- [ ] Viewer org role is always read-only regardless of project role
- [ ] User without project membership cannot access project data
- [ ] Server actions reject unauthorized requests even if UI check is bypassed
- [ ] RLS blocks direct database writes from unauthorized roles

---

## 17. Photo & Attachment Storage (Supabase Storage)

### 17.1 Storage Buckets

Create the following storage buckets in the Supabase Dashboard under **Storage**:

| Bucket | Public | Description |
|---|---|---|
| `project-photos` | No (private) | Standard field photos attached to daily logs, punch list items, RFIs, submittals |
| `thermal-photos` | No (private) | Thermal/infrared images (FLIR, radiometric JPEG, etc.) |
| `project-documents` | No (private) | PDFs, DWGs, and other non-image attachments |

**Bucket Configuration (all buckets):**
```
File size limit: 25 MB
Allowed MIME types (project-photos): image/jpeg, image/png, image/webp, image/heic, image/heif
Allowed MIME types (thermal-photos): image/jpeg, image/png, application/octet-stream
Allowed MIME types (project-documents): application/pdf, image/jpeg, image/png, application/octet-stream
```

### 17.2 Attachments Table (Extended)

The existing `attachments` table must be extended to support photo categories and geo-tagging:

```sql
-- ============================================================
-- ATTACHMENTS TABLE (Extended for Photos & Geo-tagging)
-- ============================================================
CREATE TABLE public.attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     TEXT NOT NULL
                    CHECK (entity_type IN ('submittal', 'rfi', 'daily_log', 'punch_list')),
  entity_id       UUID NOT NULL,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_type       TEXT NOT NULL,        -- MIME type
  file_size       BIGINT NOT NULL,      -- bytes
  photo_category  TEXT NOT NULL DEFAULT 'standard'
                    CHECK (photo_category IN ('standard', 'thermal', 'document')),
  uploaded_by     UUID NOT NULL REFERENCES public.profiles(id),
  geo_lat         DOUBLE PRECISION,     -- WGS84 latitude
  geo_lng         DOUBLE PRECISION,     -- WGS84 longitude
  captured_at     TIMESTAMPTZ,          -- when the photo was taken
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying attachments by entity
CREATE INDEX idx_attachments_entity
  ON public.attachments (entity_type, entity_id);

-- Index for filtering by photo category
CREATE INDEX idx_attachments_photo_category
  ON public.attachments (photo_category);

-- Index for geo-spatial queries (lat/lng bounding box)
CREATE INDEX idx_attachments_geo
  ON public.attachments (geo_lat, geo_lng)
  WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;

-- Index for uploaded_by lookups
CREATE INDEX idx_attachments_uploaded_by
  ON public.attachments (uploaded_by);
```

### 17.3 Geo-tagging Support for Jobs

Add geo-tag columns to `punch_list_items` and `daily_logs` for job-level location tracking:

```sql
-- ============================================================
-- ADD GEO-TAG COLUMNS TO PUNCH LIST ITEMS
-- ============================================================
ALTER TABLE public.punch_list_items
  ADD COLUMN geo_lat       DOUBLE PRECISION,
  ADD COLUMN geo_lng       DOUBLE PRECISION,
  ADD COLUMN geo_accuracy  DOUBLE PRECISION,
  ADD COLUMN geo_altitude  DOUBLE PRECISION,
  ADD COLUMN geo_timestamp TIMESTAMPTZ;

-- Spatial index for punch list geo queries
CREATE INDEX idx_punch_list_geo
  ON public.punch_list_items (geo_lat, geo_lng)
  WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;

-- ============================================================
-- ADD GEO-TAG COLUMNS TO DAILY LOGS
-- ============================================================
ALTER TABLE public.daily_logs
  ADD COLUMN geo_lat       DOUBLE PRECISION,
  ADD COLUMN geo_lng       DOUBLE PRECISION,
  ADD COLUMN geo_accuracy  DOUBLE PRECISION,
  ADD COLUMN geo_altitude  DOUBLE PRECISION,
  ADD COLUMN geo_timestamp TIMESTAMPTZ;

-- Spatial index for daily log geo queries
CREATE INDEX idx_daily_logs_geo
  ON public.daily_logs (geo_lat, geo_lng)
  WHERE geo_lat IS NOT NULL AND geo_lng IS NOT NULL;
```

### 17.4 Storage RLS Policies

```sql
-- ============================================================
-- RLS POLICIES FOR project-photos BUCKET
-- ============================================================

-- Project members can upload photos (INSERT)
CREATE POLICY "Project members can upload photos"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'project-photos'
    AND auth.role() = 'authenticated'
  );

-- Project members can view photos from their projects (SELECT)
CREATE POLICY "Project members can view project photos"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'project-photos'
    AND auth.role() = 'authenticated'
  );

-- Users can delete their own uploads (DELETE)
CREATE POLICY "Users can delete own photo uploads"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'project-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Repeat similar policies for thermal-photos and project-documents buckets
-- (Same structure, different bucket_id)
```

### 17.5 Attachment RLS Policies

```sql
-- ============================================================
-- RLS POLICIES FOR ATTACHMENTS TABLE
-- ============================================================
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

-- Project members can view attachments for their project entities
CREATE POLICY "Members can view project attachments"
  ON public.attachments
  FOR SELECT
  USING (
    -- Check if the user is a member of the project that owns the entity
    EXISTS (
      SELECT 1 FROM public.project_members pm
      WHERE pm.profile_id = auth.uid()
        AND pm.project_id = (
          CASE
            WHEN entity_type = 'submittal' THEN (SELECT project_id FROM public.submittals WHERE id = entity_id)
            WHEN entity_type = 'rfi' THEN (SELECT project_id FROM public.rfis WHERE id = entity_id)
            WHEN entity_type = 'daily_log' THEN (SELECT project_id FROM public.daily_logs WHERE id = entity_id)
            WHEN entity_type = 'punch_list' THEN (SELECT project_id FROM public.punch_list_items WHERE id = entity_id)
          END
        )
    )
  );

-- Authenticated users can insert attachments
CREATE POLICY "Authenticated users can add attachments"
  ON public.attachments
  FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
  );

-- Users can delete their own attachments
CREATE POLICY "Users can delete own attachments"
  ON public.attachments
  FOR DELETE
  USING (
    auth.uid() = uploaded_by
  );
```

### 17.6 File Upload Utility

```typescript
// src/lib/photo-upload.ts
import { createClient } from '@/lib/supabase/client';
import type { PhotoCategory } from '@/lib/types';

const BUCKET_MAP: Record<PhotoCategory, string> = {
  standard: 'project-photos',
  thermal: 'thermal-photos',
  document: 'project-documents',
};

interface UploadResult {
  url: string | null;
  error: string | null;
}

export async function uploadPhoto(
  file: File,
  entityType: string,
  entityId: string,
  category: PhotoCategory,
  geoLat?: number | null,
  geoLng?: number | null,
): Promise<UploadResult> {
  const supabase = createClient();
  const bucket = BUCKET_MAP[category];
  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const timestamp = Date.now();
  const filePath = `${entityType}/${entityId}/${timestamp}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    return { url: null, error: uploadError.message };
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return { url: data.publicUrl, error: null };
}
```

### 17.7 Thermal Photo Handling

Thermal photos from FLIR and similar thermal cameras require special handling:

**Supported Thermal Formats:**
| Format | Extension | Description |
|---|---|---|
| FLIR Radiometric JPEG | `.jpg` | Standard JPEG with embedded thermal data in EXIF |
| FLIR Sequence | `.seq` | Multi-frame thermal video sequence |
| FLIR IS2 | `.is2` | FLIR proprietary inspection format |
| FLIR CSQ | `.csq` | Compressed FLIR sequence |
| Radiometric PNG | `.png` | 16-bit thermal data in PNG container |

**Storage Notes:**
- Thermal images are stored in the `thermal-photos` bucket
- The `photo_category` field is set to `'thermal'` for thermal uploads
- EXIF metadata (if present) is preserved during upload
- Frontend renders thermal images like standard images (visual representation)
- Raw radiometric data extraction (temperature readings) is a future enhancement

### 17.8 File Path Convention

All uploaded files follow a consistent path structure inside storage buckets:

```
{bucket}/
  {entity_type}/
    {entity_id}/
      {timestamp}.{ext}
```

**Example paths:**
```
project-photos/punch_list/pl-001/1709132400000.jpg
project-photos/daily_log/dl-025/1709132400001.png
thermal-photos/punch_list/pl-003/1709132400002.jpg
project-documents/submittal/sub-001/1709132400003.pdf
```

### 17.9 Implementation Order (Photo & Geo-tagging)

```
Step 1:  Create storage buckets in Supabase Dashboard (project-photos, thermal-photos, project-documents)
Step 2:  Run ALTER TABLE migrations to add geo columns to punch_list_items and daily_logs
Step 3:  Run CREATE TABLE for attachments (if not exists) with extended schema
Step 4:  Create storage RLS policies for all 3 buckets
Step 5:  Create attachment table RLS policies
Step 6:  Create src/lib/photo-upload.ts utility
Step 7:  Replace in-memory attachment storage (store.ts) with Supabase calls
Step 8:  Wire PhotoUpload component to real Supabase upload
Step 9:  Wire PhotoGallery component to fetch from Supabase
Step 10: Test upload/download/delete for all entity types
Step 11: Test geo-tagging capture on mobile devices
Step 12: Test thermal photo upload with FLIR files
Step 13: Verify RLS blocks cross-project attachment access
```

### 17.10 New Files (Photo & Geo-tagging)

| # | File | Purpose |
|---|---|---|
| 1 | `src/lib/photo-upload.ts` | Supabase Storage upload/delete utility |
| 2 | `src/hooks/useGeolocation.ts` | Browser Geolocation API hook |
| 3 | `src/components/shared/PhotoUpload.tsx` | Reusable photo upload component (standard + thermal) |
| 4 | `src/components/shared/PhotoGallery.tsx` | Photo display grid with lightbox |
| 5 | `src/components/shared/GeoTagInput.tsx` | GPS location capture input |

### 17.11 Modified Files (Photo & Geo-tagging)

| # | File | Changes |
|---|---|---|
| 1 | `src/lib/types.ts` | Added `PhotoCategory`, `GeoTag` types; extended `Attachment`, `PunchListItem`, `DailyLog` |
| 2 | `src/lib/store.ts` | Added attachment CRUD operations; updated `addPunchListItem`, `addDailyLog` with geo_tag |
| 3 | `src/lib/seed-data.ts` | Added `geo_tag: null` to all seed punch list items and daily logs |
| 4 | `src/app/(app)/projects/[id]/punch-list/new/page.tsx` | Added PhotoUpload + GeoTagInput to creation form |
| 5 | `src/app/(app)/projects/[id]/punch-list/[itemId]/page.tsx` | Replaced photo placeholder with PhotoGallery + geo display |
| 6 | `src/app/(app)/projects/[id]/daily-logs/new/page.tsx` | Added PhotoUpload + GeoTagInput to creation form |
| 7 | `src/app/(app)/projects/[id]/daily-logs/[logId]/page.tsx` | Replaced photo placeholder with PhotoGallery + geo display |

---

## 18. Activity Log Database Triggers

These PostgreSQL trigger functions automatically insert rows into `public.activity_log` whenever relevant data is created or updated. Each trigger fires in the context of an authenticated Supabase user, so `auth.uid()` captures who performed the action.

### 18.1 Activity Log Table (Reference)

```sql
-- ============================================================
-- ACTIVITY LOG TABLE (for reference -- may already exist)
-- ============================================================
CREATE TABLE public.activity_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type    TEXT NOT NULL
                   CHECK (entity_type IN (
                     'submittal', 'rfi', 'daily_log', 'punch_list', 'milestone', 'project'
                   )),
  entity_id      UUID NOT NULL,
  action         TEXT NOT NULL
                   CHECK (action IN (
                     'created', 'updated', 'status_changed', 'commented',
                     'approved', 'rejected', 'submitted', 'assigned'
                   )),
  description    TEXT NOT NULL DEFAULT '',
  performed_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_activity_log_project_id ON public.activity_log (project_id);
CREATE INDEX idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_created_at ON public.activity_log (created_at DESC);
```

### 18.2 Submittals Trigger

```sql
-- ============================================================
-- TRIGGER: Log submittal creation and status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_submittal_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'submittal',
      NEW.id,
      'created',
      'New submittal created: ' || NEW.number || ' — ' || NEW.title,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'submittal',
      NEW.id,
      'status_changed',
      'Submittal ' || NEW.number || ' status changed to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_submittal_change
  AFTER INSERT OR UPDATE ON public.submittals
  FOR EACH ROW
  EXECUTE FUNCTION public.log_submittal_activity();
```

### 18.3 RFIs Trigger

```sql
-- ============================================================
-- TRIGGER: Log RFI creation and status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_rfi_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'rfi',
      NEW.id,
      'created',
      'New RFI created: ' || NEW.number || ' — ' || NEW.subject,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'rfi',
      NEW.id,
      'status_changed',
      'RFI ' || NEW.number || ' status changed to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_rfi_change
  AFTER INSERT OR UPDATE ON public.rfis
  FOR EACH ROW
  EXECUTE FUNCTION public.log_rfi_activity();
```

### 18.4 RFI Responses Trigger

```sql
-- ============================================================
-- TRIGGER: Log RFI response (comment) creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_rfi_response_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_project_id UUID;
  v_rfi_number TEXT;
BEGIN
  -- Look up the parent RFI to get project_id and number
  SELECT project_id, number INTO v_project_id, v_rfi_number
  FROM public.rfis
  WHERE id = NEW.rfi_id;

  INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
  VALUES (
    v_project_id,
    'rfi',
    NEW.rfi_id,
    'commented',
    'New response added to RFI ' || v_rfi_number,
    auth.uid()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_rfi_response_created
  AFTER INSERT ON public.rfi_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.log_rfi_response_activity();
```

### 18.5 Daily Logs Trigger

```sql
-- ============================================================
-- TRIGGER: Log daily log creation
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_daily_log_activity()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
  VALUES (
    NEW.project_id,
    'daily_log',
    NEW.id,
    'created',
    'Daily log created for ' || TO_CHAR(NEW.log_date, 'Mon DD, YYYY'),
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_daily_log_created
  AFTER INSERT ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_daily_log_activity();
```

### 18.6 Punch List Items Trigger

```sql
-- ============================================================
-- TRIGGER: Log punch list item creation and status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_punch_list_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'punch_list',
      NEW.id,
      'created',
      'New punch list item created: ' || NEW.number || ' — ' || NEW.title,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'punch_list',
      NEW.id,
      'status_changed',
      'Punch list item ' || NEW.number || ' status changed to ' || NEW.status,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_punch_list_change
  AFTER INSERT OR UPDATE ON public.punch_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_punch_list_activity();
```

### 18.7 Milestones Trigger

```sql
-- ============================================================
-- TRIGGER: Log milestone creation and status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_milestone_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'milestone',
      NEW.id,
      'created',
      'New milestone created: ' || NEW.name,
      auth.uid()
    );
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.project_id,
      'milestone',
      NEW.id,
      'status_changed',
      'Milestone "' || NEW.name || '" status changed to ' || REPLACE(NEW.status, '_', ' '),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_milestone_change
  AFTER INSERT OR UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.log_milestone_activity();
```

### 18.8 Projects Trigger (Status Changes Only)

```sql
-- ============================================================
-- TRIGGER: Log project status changes
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_project_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_log (project_id, entity_type, entity_id, action, description, performed_by)
    VALUES (
      NEW.id,
      'project',
      NEW.id,
      'status_changed',
      'Project "' || NEW.name || '" status changed to ' || REPLACE(NEW.status, '_', ' '),
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_status_change
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_status_change();
```

### 18.9 Notes on Activity Log Triggers

- All trigger functions use `SECURITY DEFINER` so they can insert into `activity_log` even when the calling user does not have direct INSERT access (RLS policies on `activity_log` are typically read-only for non-admin users).
- `auth.uid()` returns the UUID of the currently authenticated user from the Supabase session context. This works because these triggers fire as a result of mutations made through the Supabase client, which carries the user's JWT.
- `IS DISTINCT FROM` is used instead of `!=` to correctly handle `NULL` values in status comparisons.
- The `REPLACE(NEW.status, '_', ' ')` call in milestones and projects converts statuses like `on_hold` to `on hold` for human-readable descriptions.
- These triggers fire on both client-side and server-side mutations. If a server action uses the admin client (service role), `auth.uid()` will be `NULL`. For admin-initiated changes, consider setting `performed_by` to a system UUID or wrapping the admin call with `SET LOCAL role = 'authenticated'; SET LOCAL request.jwt.claim.sub = '<admin-user-id>';`.

---

## 19. Supabase Type Generation

Supabase provides a CLI command to introspect your database schema and generate TypeScript types. This ensures type-safe queries across the entire app.

### 19.1 Install the Supabase CLI

If not already installed:

```bash
npm install -D supabase
```

Or install globally:

```bash
npm install -g supabase
```

### 19.2 Generate Types

Run the following command to generate types from your remote Supabase project:

```bash
npx supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/supabase/database.types.ts
```

Replace `<your-project-ref>` with your Supabase project reference ID (the subdomain portion of your Supabase URL, e.g., `abcdefghijklmnop`).

### 19.3 Add a Package Script

Add the following script to `package.json` for convenience:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/supabase/database.types.ts"
  }
}
```

Then run it anytime the schema changes:

```bash
npm run db:types
```

### 19.4 Using Generated Types with the Supabase Client

Update the Supabase client factories to use the generated `Database` type for full type safety on all queries:

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from './database.types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Safe to ignore in Server Components
          }
        },
      },
    }
  );
}
```

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

### 19.5 Type-Safe Query Examples

With generated types, all queries are fully typed:

```typescript
// Fully typed — the result is automatically typed as Submittal row(s)
const { data: submittals, error } = await supabase
  .from('submittals')
  .select('*')
  .eq('project_id', projectId)
  .order('created_at', { ascending: false });

// Insert — TypeScript enforces required columns and valid values
const { data, error } = await supabase
  .from('rfis')
  .insert({
    project_id: projectId,
    number: 'RFI-015',
    subject: 'Ballast depth clarification',
    question: 'What is the required ballast depth under turnout #24?',
    status: 'open',
    priority: 'high',
    submitted_by: userId,
    assigned_to: engineerId,
    submit_date: new Date().toISOString(),
    due_date: '2026-03-15',
  })
  .select()
  .single();

// Join queries — use explicit select to type the response
const { data: rfiWithResponses } = await supabase
  .from('rfis')
  .select(`
    *,
    responses:rfi_responses(*),
    submitted_by_profile:profiles!submitted_by(full_name, email),
    assigned_to_profile:profiles!assigned_to(full_name, email)
  `)
  .eq('id', rfiId)
  .single();
```

### 19.6 Re-generate Types After Schema Changes

Run `npm run db:types` after any of these events:

- Running a new Supabase migration
- Adding or altering tables, columns, or constraints in the dashboard
- Changing RLS policies (does not affect types but good practice to keep in sync)
- Adding new enums or check constraints

---

## 20. Seed Data & Migration Strategy

### 20.1 Transition from In-Memory to Supabase

The app currently uses an in-memory store (`src/lib/store.ts`) backed by TypeScript seed data (`src/lib/seed-data.ts`). The transition to Supabase follows this approach:

1. **Keep seed data as reference** -- The existing `seed-data.ts` file documents the exact data shape expected by every component. Do not delete it until all components are migrated to fetch from Supabase.

2. **Create a SQL seed script** -- Translate the TypeScript seed data into a SQL file that can be run against the Supabase database for development environments.

3. **Swap store functions incrementally** -- Replace each function in `store.ts` one at a time with Supabase queries (e.g., replace `getSubmittals()` with a server action that calls `supabase.from('submittals').select()`). This allows component-by-component migration without breaking the app.

4. **Remove the in-memory store** -- Once all components fetch from Supabase, delete `store.ts` and `seed-data.ts`.

### 20.2 Seed SQL Script

Create a seed script at `supabase/seed.sql` that inserts demo data for development. This file is automatically run by `supabase db reset`.

```sql
-- ============================================================
-- SEED DATA FOR DEVELOPMENT
-- supabase/seed.sql
-- ============================================================
-- This script mirrors the data in src/lib/seed-data.ts.
-- Run with: supabase db reset (runs migrations + seed)
-- Or manually: psql -f supabase/seed.sql
-- ============================================================

-- Organizations
INSERT INTO public.organizations (id, name, type, created_at) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'A5 Rail', 'owner', '2025-01-15T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000002', 'Mountain West Track Services', 'contractor', '2025-02-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000003', 'Front Range Signal Co.', 'contractor', '2025-02-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000004', 'Summit Grade Construction', 'contractor', '2025-03-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000005', 'Colorado DOT', 'inspector', '2025-01-01T00:00:00Z'),
  ('a0000000-0000-0000-0000-000000000006', 'Kensington Engineering Group', 'engineer', '2025-01-10T00:00:00Z');

-- Seed Profiles
-- NOTE: In production, profiles are created by the auth trigger. For seeding,
-- you must first create corresponding entries in auth.users (via Supabase Dashboard
-- or the admin API), then insert profiles with matching UUIDs. The UUIDs below
-- are placeholders; replace them with real auth.users IDs when seeding.
--
-- For local development with `supabase db reset`, you can create test users
-- using the Supabase Management API or insert directly:
--
-- INSERT INTO auth.users (id, email, ...) VALUES (...);

-- Projects
INSERT INTO public.projects (id, name, description, status, start_date, target_end_date, budget_total, budget_spent, location, client, created_by, created_at)
VALUES (
  'b0000000-0000-0000-0000-000000000001',
  'Englewood Yard Expansion — Phase 2',
  'Track expansion including 3 new sidings, signal upgrades with wayside signals and grade crossing protection, and yard reconfiguration for increased capacity at Englewood Yard.',
  'active',
  '2025-08-26',
  '2026-02-26',
  4200000,
  2100000,
  'Englewood, CO',
  'Colorado & Western Railroad',
  '00000000-0000-0000-0000-000000000001', -- Replace with real auth user UUID
  '2025-07-15T00:00:00Z'
);

-- Submittals (example — repeat for all seed submittals)
INSERT INTO public.submittals (id, project_id, number, title, description, spec_section, status, submitted_by, reviewed_by, submit_date, due_date, review_date, review_notes, milestone_id, created_at)
VALUES (
  'c0000000-0000-0000-0000-000000000001',
  'b0000000-0000-0000-0000-000000000001',
  'SUB-001',
  '136RE Rail — 2,400 LF',
  'Shop drawings and mill certifications for 136RE continuous welded rail per AREMA specifications. Quantity: 2,400 linear feet for Sidings 1-3.',
  '34 11 13 - Track Construction',
  'approved',
  '00000000-0000-0000-0000-000000000004', -- Travis Mitchell
  '00000000-0000-0000-0000-000000000010', -- Dr. Nathan Park
  '2025-09-15T00:00:00Z',
  '2025-09-29',
  '2025-09-25T00:00:00Z',
  'Approved. Mill certs verified against AREMA Ch. 4 requirements.',
  NULL,
  '2025-09-14T00:00:00Z'
);

-- Continue for all submittals, RFIs, daily logs, punch list items,
-- milestones, project members, and activity log entries from seed-data.ts.
-- See src/lib/seed-data.ts for the complete dataset.
```

> **Tip:** To generate the full seed SQL from the TypeScript seed data, write a one-off Node script that imports from `seed-data.ts` and outputs SQL INSERT statements. This avoids manual translation errors.

### 20.3 Supabase Migrations for Schema Versioning

Use Supabase migrations to version-control all schema changes:

```bash
# Initialize Supabase locally (if not already done)
npx supabase init

# Link to your remote project
npx supabase link --project-ref <your-project-ref>

# Create a new migration
npx supabase migration new create_core_tables

# This creates: supabase/migrations/<timestamp>_create_core_tables.sql
# Paste your CREATE TABLE statements into this file.

# Apply migrations locally
npx supabase db reset

# Push migrations to remote (production/staging)
npx supabase db push
```

Recommended migration file structure:

```
supabase/
  migrations/
    20260228000001_create_organizations.sql
    20260228000002_create_profiles_and_trigger.sql
    20260228000003_create_projects.sql
    20260228000004_create_project_members.sql
    20260228000005_create_submittals.sql
    20260228000006_create_rfis_and_responses.sql
    20260228000007_create_daily_logs.sql
    20260228000008_create_punch_list_items.sql
    20260228000009_create_milestones.sql
    20260228000010_create_attachments.sql
    20260228000011_create_activity_log.sql
    20260228000012_create_rls_policies.sql
    20260228000013_create_activity_log_triggers.sql
    20260228000014_create_storage_buckets.sql
  seed.sql
```

Add useful scripts to `package.json`:

```json
{
  "scripts": {
    "db:types": "supabase gen types typescript --project-id <your-project-ref> --schema public > src/lib/supabase/database.types.ts",
    "db:reset": "supabase db reset",
    "db:migrate": "supabase db push",
    "db:new-migration": "supabase migration new"
  }
}
```

### 20.4 Environment-Based Seeding

| Environment | Seeding Approach |
|---|---|
| **Local dev** (`supabase db reset`) | Automatically runs all migrations + `supabase/seed.sql`. Full demo data is inserted for development and testing. |
| **Preview / Staging** | Run migrations via `supabase db push`. Optionally run a stripped-down seed script with minimal test data. Do not include production user data. |
| **Production** | Run migrations via `supabase db push` only. **Never run seed data in production.** The database starts empty; real users and data are created through the app. |

To conditionally control seeding, use environment variables in any server-side setup scripts:

```typescript
// scripts/seed-check.ts (optional — run as part of CI/CD)
const env = process.env.NODE_ENV ?? 'development';
const allowSeed = process.env.ALLOW_SEED === 'true';

if (env === 'production' && allowSeed) {
  console.warn('WARNING: ALLOW_SEED is true in production. This should never happen.');
  process.exit(1);
}

if (env === 'development' || env === 'test') {
  console.log('Seeding is permitted for environment:', env);
  // Run seed logic here if needed
}
```

> **Important:** The `supabase/seed.sql` file is only executed by `supabase db reset`, which drops and recreates the local database. It is never automatically run on remote databases.

---

## 21. Real-Time Subscriptions (Optional Enhancement)

Supabase Realtime enables live data streaming over WebSockets. This section covers how to subscribe to database changes for live activity feeds, RFI responses, and punch list status updates.

### 21.1 Enable Realtime on Tables

In the Supabase Dashboard, go to **Database > Replication** and enable Realtime for the tables you want to subscribe to:

- `activity_log` -- Live activity feed on the dashboard
- `rfi_responses` -- Real-time RFI discussion updates
- `punch_list_items` -- Live punch list status changes
- `rfis` -- RFI status change notifications

Or enable via SQL:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rfi_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_list_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rfis;
```

### 21.2 Generic Realtime Subscription Hook

A reusable React hook for subscribing to Supabase Realtime changes:

```typescript
// src/hooks/useRealtimeSubscription.ts
'use client';

import { useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseRealtimeOptions<T extends Record<string, unknown>> {
  /** The database table to subscribe to */
  table: string;
  /** The schema (default: 'public') */
  schema?: string;
  /** The event type to listen for (default: '*' for all) */
  event?: PostgresChangeEvent;
  /** Optional filter expression (e.g., 'project_id=eq.abc-123') */
  filter?: string;
  /** Callback fired when a matching change occurs */
  onPayload: (payload: RealtimePostgresChangesPayload<T>) => void;
}

export function useRealtimeSubscription<T extends Record<string, unknown>>({
  table,
  schema = 'public',
  event = '*',
  filter,
  onPayload,
}: UseRealtimeOptions<T>) {
  const callbackRef = useRef(onPayload);
  callbackRef.current = onPayload;

  useEffect(() => {
    const supabase = createClient();

    const channelConfig: Record<string, string> = {
      event,
      schema,
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(`realtime:${table}:${filter ?? 'all'}`)
      .on(
        'postgres_changes' as any,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<T>) => {
          callbackRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, schema, event, filter]);
}
```

### 21.3 Live Activity Feed

Subscribe to new activity log entries for a specific project:

```typescript
// Usage in a dashboard component
'use client';

import { useState, useCallback } from 'react';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import type { ActivityLogEntry } from '@/lib/types';

export function LiveActivityFeed({ projectId }: { projectId: string }) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);

  useRealtimeSubscription<ActivityLogEntry>({
    table: 'activity_log',
    event: 'INSERT',
    filter: `project_id=eq.${projectId}`,
    onPayload: useCallback((payload) => {
      if (payload.new && 'id' in payload.new) {
        setActivities((prev) => [payload.new as ActivityLogEntry, ...prev]);
      }
    }, []),
  });

  return (
    <ul>
      {activities.map((activity) => (
        <li key={activity.id}>{activity.description}</li>
      ))}
    </ul>
  );
}
```

### 21.4 Real-Time RFI Responses

Subscribe to new responses on a specific RFI:

```typescript
// Usage in an RFI detail page
useRealtimeSubscription<RFIResponse>({
  table: 'rfi_responses',
  event: 'INSERT',
  filter: `rfi_id=eq.${rfiId}`,
  onPayload: useCallback((payload) => {
    if (payload.new && 'id' in payload.new) {
      setResponses((prev) => [...prev, payload.new as RFIResponse]);
    }
  }, []),
});
```

### 21.5 Punch List Status Changes

Subscribe to punch list item updates for a project:

```typescript
// Usage in a punch list view
useRealtimeSubscription<PunchListItem>({
  table: 'punch_list_items',
  event: 'UPDATE',
  filter: `project_id=eq.${projectId}`,
  onPayload: useCallback((payload) => {
    if (payload.new && 'id' in payload.new) {
      const updated = payload.new as PunchListItem;
      setPunchListItems((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
    }
  }, []),
});
```

### 21.6 Realtime Considerations

- **RLS applies to Realtime** -- Users only receive events for rows they can read per their RLS policies. No additional authorization is needed.
- **Performance** -- Only enable Realtime on tables that benefit from it. High-write tables (like detailed audit logs) may generate excessive WebSocket traffic.
- **Reconnection** -- The Supabase client automatically handles reconnections. The hook above uses the `useEffect` cleanup to remove channels on component unmount.
- **Channel limits** -- Supabase has a default limit of 100 concurrent Realtime connections per project on the free tier. Monitor usage if scaling.

---

## 22. Environment Variable Addendum

### 22.1 Missing Variable: NEXT_PUBLIC_SITE_URL

The `NEXT_PUBLIC_SITE_URL` environment variable is required for auth actions that construct email redirect URLs (password reset, email confirmation, etc.). It is referenced in `src/lib/actions/auth.ts` by the `resetPassword` function.

Add it to `.env.local`:

```env
# Site URL — used for auth email redirect URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For production, set the value to your deployed domain:

```env
NEXT_PUBLIC_SITE_URL=https://your-production-domain.com
```

Set this variable in **Vercel > Project Settings > Environment Variables** for all environments:

| Environment | Value |
|---|---|
| **Development** | `http://localhost:3000` |
| **Preview** | `https://<project-name>-git-<branch>.vercel.app` (or use `VERCEL_URL`) |
| **Production** | `https://your-production-domain.com` |

> **Note for Vercel Preview deployments:** You can dynamically construct the URL using the `VERCEL_URL` environment variable that Vercel injects automatically. However, since `NEXT_PUBLIC_SITE_URL` is a build-time variable (prefixed with `NEXT_PUBLIC_`), you may need a wrapper:
>
> ```typescript
> // src/lib/utils/site-url.ts
> export function getSiteUrl(): string {
>   // Explicit env var takes priority
>   if (process.env.NEXT_PUBLIC_SITE_URL) {
>     return process.env.NEXT_PUBLIC_SITE_URL;
>   }
>   // Fallback for Vercel preview deployments (server-side only)
>   if (process.env.VERCEL_URL) {
>     return `https://${process.env.VERCEL_URL}`;
>   }
>   // Local development fallback
>   return 'http://localhost:3000';
> }
> ```

Update the existing environment variables section (Section 1.1) to include this variable. The complete set of required environment variables is:

```env
# Supabase -- Public (exposed to browser)
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>

# Supabase -- Server only (NEVER expose to the browser)
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# Site URL -- used for auth email redirect URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 23. Complete Data Table Schemas

This section contains every CREATE TABLE statement needed for the full RailCommand database. Run these in the Supabase SQL Editor **in order** (dependencies flow top to bottom).

> **Note:** The tables from Sections 2.1--2.6 (organizations, profiles, projects, project_members) are already documented above. This section covers all remaining data tables that were missing from the original schema.

### 23.1 Human-Readable Number Sequence Infrastructure

Per-project sequences for `SUB-NNN`, `RFI-NNN`, `PL-NNN` using a counter table and trigger function.

```sql
-- ============================================================
-- ENTITY NUMBER SEQUENCES (counter table)
-- One row per (project_id, entity_type) pair
-- ============================================================
CREATE TABLE public.entity_number_sequences (
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL CHECK (entity_type IN ('submittal', 'rfi', 'punch_list')),
  current_value INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, entity_type)
);

-- Generic function: increments the counter and returns the next
-- formatted number (e.g. 'SUB-001', 'RFI-042', 'PL-007').
CREATE OR REPLACE FUNCTION public.assign_entity_number()
RETURNS TRIGGER AS $$
DECLARE
  _prefix TEXT;
  _type   TEXT;
  _next   INT;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'submittals'       THEN _prefix := 'SUB'; _type := 'submittal';
    WHEN 'rfis'             THEN _prefix := 'RFI'; _type := 'rfi';
    WHEN 'punch_list_items' THEN _prefix := 'PL';  _type := 'punch_list';
    ELSE RAISE EXCEPTION 'assign_entity_number: unsupported table %', TG_TABLE_NAME;
  END CASE;

  -- Upsert the counter row and atomically increment
  INSERT INTO public.entity_number_sequences (project_id, entity_type, current_value)
  VALUES (NEW.project_id, _type, 1)
  ON CONFLICT (project_id, entity_type)
  DO UPDATE SET current_value = public.entity_number_sequences.current_value + 1
  RETURNING current_value INTO _next;

  -- Format as PREFIX-NNN (zero-padded to 3 digits, grows beyond 3 naturally)
  NEW.number := _prefix || '-' || LPAD(_next::TEXT, 3, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 23.2 Milestones Table

```sql
-- ============================================================
-- MILESTONES TABLE
-- ============================================================
CREATE TABLE public.milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  target_date      DATE NOT NULL,
  actual_date      DATE,
  status           TEXT NOT NULL DEFAULT 'not_started'
                     CHECK (status IN ('on_track', 'at_risk', 'behind', 'complete', 'not_started')),
  percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0
                     CHECK (percent_complete >= 0 AND percent_complete <= 100),
  budget_planned   NUMERIC(14,2) NOT NULL DEFAULT 0,
  budget_actual    NUMERIC(14,2) NOT NULL DEFAULT 0,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_milestones_project_id ON public.milestones (project_id);
CREATE INDEX idx_milestones_status ON public.milestones (status);
CREATE INDEX idx_milestones_sort_order ON public.milestones (project_id, sort_order);

CREATE TRIGGER milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 23.3 Submittals Table

```sql
-- ============================================================
-- SUBMITTALS TABLE
-- ============================================================
CREATE TABLE public.submittals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number           TEXT NOT NULL,           -- assigned by trigger, e.g. 'SUB-001'
  title            TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  spec_section     TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'conditional', 'rejected')),
  submitted_by     UUID NOT NULL REFERENCES public.profiles(id),
  reviewed_by      UUID REFERENCES public.profiles(id),
  submit_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE NOT NULL,
  review_date      DATE,
  review_notes     TEXT,
  milestone_id     UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);

CREATE INDEX idx_submittals_project_id ON public.submittals (project_id);
CREATE INDEX idx_submittals_status ON public.submittals (status);
CREATE INDEX idx_submittals_submitted_by ON public.submittals (submitted_by);
CREATE INDEX idx_submittals_reviewed_by ON public.submittals (reviewed_by);
CREATE INDEX idx_submittals_milestone_id ON public.submittals (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE TRIGGER submittals_updated_at
  BEFORE UPDATE ON public.submittals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER submittals_assign_number
  BEFORE INSERT ON public.submittals
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_entity_number();
```

### 23.4 RFIs Table

```sql
-- ============================================================
-- RFIS TABLE
-- ============================================================
CREATE TABLE public.rfis (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number           TEXT NOT NULL,           -- assigned by trigger, e.g. 'RFI-001'
  subject          TEXT NOT NULL,
  question         TEXT NOT NULL,
  answer           TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'answered', 'closed', 'overdue')),
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  submitted_by     UUID NOT NULL REFERENCES public.profiles(id),
  assigned_to      UUID NOT NULL REFERENCES public.profiles(id),
  submit_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date         DATE NOT NULL,
  response_date    DATE,
  milestone_id     UUID REFERENCES public.milestones(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);

CREATE INDEX idx_rfis_project_id ON public.rfis (project_id);
CREATE INDEX idx_rfis_status ON public.rfis (status);
CREATE INDEX idx_rfis_priority ON public.rfis (priority);
CREATE INDEX idx_rfis_submitted_by ON public.rfis (submitted_by);
CREATE INDEX idx_rfis_assigned_to ON public.rfis (assigned_to);
CREATE INDEX idx_rfis_milestone_id ON public.rfis (milestone_id) WHERE milestone_id IS NOT NULL;

CREATE TRIGGER rfis_updated_at
  BEFORE UPDATE ON public.rfis
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER rfis_assign_number
  BEFORE INSERT ON public.rfis
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_entity_number();
```

### 23.5 RFI Responses Table

```sql
-- ============================================================
-- RFI_RESPONSES TABLE
-- ============================================================
CREATE TABLE public.rfi_responses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id                UUID NOT NULL REFERENCES public.rfis(id) ON DELETE CASCADE,
  author_id             UUID NOT NULL REFERENCES public.profiles(id),
  content               TEXT NOT NULL,
  is_official_response  BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rfi_responses_rfi_id ON public.rfi_responses (rfi_id);
CREATE INDEX idx_rfi_responses_author_id ON public.rfi_responses (author_id);
```

### 23.6 Daily Logs Table

```sql
-- ============================================================
-- DAILY_LOGS TABLE
-- ============================================================
CREATE TABLE public.daily_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id          UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  log_date            DATE NOT NULL,
  created_by          UUID NOT NULL REFERENCES public.profiles(id),
  weather_temp        NUMERIC(5,1) NOT NULL DEFAULT 0,
  weather_conditions  TEXT NOT NULL DEFAULT '',
  weather_wind        TEXT NOT NULL DEFAULT '',
  work_summary        TEXT NOT NULL DEFAULT '',
  safety_notes        TEXT NOT NULL DEFAULT '',
  geo_tag             JSONB,                -- { lat, lng, accuracy?, altitude?, timestamp }
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, log_date)             -- one log per project per day
);

CREATE INDEX idx_daily_logs_project_id ON public.daily_logs (project_id);
CREATE INDEX idx_daily_logs_log_date ON public.daily_logs (log_date);
CREATE INDEX idx_daily_logs_created_by ON public.daily_logs (created_by);

CREATE TRIGGER daily_logs_updated_at
  BEFORE UPDATE ON public.daily_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
```

### 23.7 Daily Log Sub-Entity Tables

```sql
-- ============================================================
-- DAILY_LOG_PERSONNEL TABLE
-- ============================================================
CREATE TABLE public.daily_log_personnel (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id  UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  role          TEXT NOT NULL,
  headcount     INT  NOT NULL DEFAULT 0 CHECK (headcount >= 0),
  company       TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_daily_log_personnel_daily_log_id ON public.daily_log_personnel (daily_log_id);

-- ============================================================
-- DAILY_LOG_EQUIPMENT TABLE
-- ============================================================
CREATE TABLE public.daily_log_equipment (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id    UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  equipment_type  TEXT NOT NULL,
  count           INT  NOT NULL DEFAULT 0 CHECK (count >= 0),
  notes           TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_daily_log_equipment_daily_log_id ON public.daily_log_equipment (daily_log_id);

-- ============================================================
-- DAILY_LOG_WORK_ITEMS TABLE
-- ============================================================
CREATE TABLE public.daily_log_work_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id  UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  quantity      NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT '',
  location      TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_daily_log_work_items_daily_log_id ON public.daily_log_work_items (daily_log_id);
```

### 23.8 Punch List Items Table

```sql
-- ============================================================
-- PUNCH_LIST_ITEMS TABLE
-- ============================================================
CREATE TABLE public.punch_list_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  number            TEXT NOT NULL,           -- assigned by trigger, e.g. 'PL-001'
  title             TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  location          TEXT NOT NULL DEFAULT '',
  geo_tag           JSONB,                   -- { lat, lng, accuracy?, altitude?, timestamp }
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'in_progress', 'resolved', 'verified')),
  priority          TEXT NOT NULL DEFAULT 'medium'
                      CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assigned_to       UUID NOT NULL REFERENCES public.profiles(id),
  created_by        UUID NOT NULL REFERENCES public.profiles(id),
  due_date          DATE NOT NULL,
  resolved_date     DATE,
  verified_date     DATE,
  resolution_notes  TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, number)
);

CREATE INDEX idx_punch_list_items_project_id ON public.punch_list_items (project_id);
CREATE INDEX idx_punch_list_items_status ON public.punch_list_items (status);
CREATE INDEX idx_punch_list_items_priority ON public.punch_list_items (priority);
CREATE INDEX idx_punch_list_items_assigned_to ON public.punch_list_items (assigned_to);
CREATE INDEX idx_punch_list_items_created_by ON public.punch_list_items (created_by);

CREATE TRIGGER punch_list_items_updated_at
  BEFORE UPDATE ON public.punch_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER punch_list_items_assign_number
  BEFORE INSERT ON public.punch_list_items
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_entity_number();
```

### 23.9 Milestone Junction Tables

```sql
-- ============================================================
-- MILESTONE_SUBMITTALS JUNCTION TABLE
-- ============================================================
CREATE TABLE public.milestone_submittals (
  milestone_id  UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  submittal_id  UUID NOT NULL REFERENCES public.submittals(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, submittal_id)
);

CREATE INDEX idx_milestone_submittals_submittal_id ON public.milestone_submittals (submittal_id);

-- ============================================================
-- MILESTONE_RFIS JUNCTION TABLE
-- ============================================================
CREATE TABLE public.milestone_rfis (
  milestone_id  UUID NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
  rfi_id        UUID NOT NULL REFERENCES public.rfis(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, rfi_id)
);

CREATE INDEX idx_milestone_rfis_rfi_id ON public.milestone_rfis (rfi_id);
```

### 23.10 Activity Log Table

```sql
-- ============================================================
-- ACTIVITY_LOG TABLE
-- ============================================================
CREATE TABLE public.activity_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type    TEXT NOT NULL
                   CHECK (entity_type IN ('submittal', 'rfi', 'daily_log', 'punch_list', 'milestone', 'project')),
  entity_id      UUID NOT NULL,
  action         TEXT NOT NULL
                   CHECK (action IN ('created', 'updated', 'status_changed', 'commented', 'approved', 'rejected', 'submitted', 'assigned')),
  description    TEXT NOT NULL DEFAULT '',
  performed_by   UUID NOT NULL REFERENCES public.profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_log_project_id ON public.activity_log (project_id, created_at DESC);
CREATE INDEX idx_activity_log_entity ON public.activity_log (entity_type, entity_id);
CREATE INDEX idx_activity_log_performed_by ON public.activity_log (performed_by);
```

### 23.11 Enable RLS on All New Tables

```sql
ALTER TABLE public.entity_number_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submittals              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfis                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rfi_responses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_log_personnel     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_log_equipment     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_log_work_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_list_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_submittals    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_rfis          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log            ENABLE ROW LEVEL SECURITY;
```

### 23.12 SQL Execution Order

Run the SQL from this document in this exact order:

```
 1. Section 2.2  -- organizations table
 2. Section 2.1  -- profiles table
 3. Section 2.5  -- update_updated_at() function + profiles trigger
 4. Section 2.3  -- projects table
 5. Section 2.6  -- project_members table
 6. Section 2.4  -- handle_new_user() trigger
 7. Section 14.1 -- user_preferences table
 8. Section 14.2 -- updated handle_new_user() with preferences
 9. Section 23.1 -- entity_number_sequences + assign_entity_number()
10. Section 23.2 -- milestones table
11. Section 23.3 -- submittals table
12. Section 23.4 -- rfis table
13. Section 23.5 -- rfi_responses table
14. Section 23.6 -- daily_logs table
15. Section 23.7 -- daily_log_personnel, daily_log_equipment, daily_log_work_items
16. Section 23.8 -- punch_list_items table
17. Section 23.9 -- milestone_submittals, milestone_rfis junction tables
18. Section 23.10 -- activity_log table
19. Section 17.2 -- attachments table (extended)
20. Section 23.11 -- enable RLS on all new tables
21. Section 3    -- all RLS policies (Sections 3.1--3.5)
22. Section 24   -- RLS policies for data tables
23. Section 13.2 -- storage policies for avatars
24. Section 17.4 -- storage policies for project-photos
25. Section 17.5 -- attachment table RLS policies
26. Section 18   -- activity log triggers
```

---

## 24. RLS Policies for Data Tables

These policies complement the existing policies in Section 3. Apply these after all tables have been created and RLS has been enabled.

### 24.1 Milestones Policies

```sql
-- Project members can read milestones
CREATE POLICY "Project members can read milestones"
  ON public.milestones
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
    )
  );

-- Project editors can create milestones
CREATE POLICY "Project editors can create milestones"
  ON public.milestones
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid() AND can_edit = true
    )
  );

-- Project editors can update milestones
CREATE POLICY "Project editors can update milestones"
  ON public.milestones
  FOR UPDATE
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid() AND can_edit = true
    )
  );
```

### 24.2 RFI Responses Policies

```sql
-- Project members can read RFI responses
CREATE POLICY "Project members can read rfi responses"
  ON public.rfi_responses
  FOR SELECT
  USING (
    rfi_id IN (
      SELECT r.id FROM public.rfis r
      JOIN public.project_members pm ON pm.project_id = r.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );

-- Project members can create RFI responses
CREATE POLICY "Project members can create rfi responses"
  ON public.rfi_responses
  FOR INSERT
  WITH CHECK (
    rfi_id IN (
      SELECT r.id FROM public.rfis r
      JOIN public.project_members pm ON pm.project_id = r.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );
```

### 24.3 Daily Log Sub-Entity Policies

All three daily log child tables follow the same pattern: access is based on the parent daily log's project membership.

```sql
-- ============================================================
-- DAILY_LOG_PERSONNEL POLICIES
-- ============================================================
CREATE POLICY "Project members can read daily log personnel"
  ON public.daily_log_personnel
  FOR SELECT
  USING (
    daily_log_id IN (
      SELECT dl.id FROM public.daily_logs dl
      JOIN public.project_members pm ON pm.project_id = dl.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Daily log creators can insert personnel"
  ON public.daily_log_personnel
  FOR INSERT
  WITH CHECK (
    daily_log_id IN (
      SELECT dl.id FROM public.daily_logs dl
      WHERE dl.created_by = auth.uid()
    )
  );

-- ============================================================
-- DAILY_LOG_EQUIPMENT POLICIES
-- ============================================================
CREATE POLICY "Project members can read daily log equipment"
  ON public.daily_log_equipment
  FOR SELECT
  USING (
    daily_log_id IN (
      SELECT dl.id FROM public.daily_logs dl
      JOIN public.project_members pm ON pm.project_id = dl.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Daily log creators can insert equipment"
  ON public.daily_log_equipment
  FOR INSERT
  WITH CHECK (
    daily_log_id IN (
      SELECT dl.id FROM public.daily_logs dl
      WHERE dl.created_by = auth.uid()
    )
  );

-- ============================================================
-- DAILY_LOG_WORK_ITEMS POLICIES
-- ============================================================
CREATE POLICY "Project members can read daily log work items"
  ON public.daily_log_work_items
  FOR SELECT
  USING (
    daily_log_id IN (
      SELECT dl.id FROM public.daily_logs dl
      JOIN public.project_members pm ON pm.project_id = dl.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Daily log creators can insert work items"
  ON public.daily_log_work_items
  FOR INSERT
  WITH CHECK (
    daily_log_id IN (
      SELECT dl.id FROM public.daily_logs dl
      WHERE dl.created_by = auth.uid()
    )
  );
```

### 24.4 Milestone Junction Table Policies

```sql
-- Project members can read milestone links
CREATE POLICY "Project members can read milestone submittals"
  ON public.milestone_submittals
  FOR SELECT
  USING (
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      JOIN public.project_members pm ON pm.project_id = m.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project editors can manage milestone submittals"
  ON public.milestone_submittals
  FOR ALL
  USING (
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      JOIN public.project_members pm ON pm.project_id = m.project_id
      WHERE pm.profile_id = auth.uid() AND pm.can_edit = true
    )
  );

CREATE POLICY "Project members can read milestone rfis"
  ON public.milestone_rfis
  FOR SELECT
  USING (
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      JOIN public.project_members pm ON pm.project_id = m.project_id
      WHERE pm.profile_id = auth.uid()
    )
  );

CREATE POLICY "Project editors can manage milestone rfis"
  ON public.milestone_rfis
  FOR ALL
  USING (
    milestone_id IN (
      SELECT m.id FROM public.milestones m
      JOIN public.project_members pm ON pm.project_id = m.project_id
      WHERE pm.profile_id = auth.uid() AND pm.can_edit = true
    )
  );
```

### 24.5 Activity Log Policies

```sql
-- Project members can read activity log
CREATE POLICY "Project members can read activity log"
  ON public.activity_log
  FOR SELECT
  USING (
    project_id IN (
      SELECT project_id FROM public.project_members
      WHERE profile_id = auth.uid()
    )
  );

-- Authenticated users can insert activity log entries
CREATE POLICY "Authenticated users can insert activity log"
  ON public.activity_log
  FOR INSERT
  WITH CHECK (
    auth.uid() = performed_by
  );
```

### 24.6 Entity Number Sequences Policy

```sql
-- Allow the trigger function to manage sequences (service role)
-- Regular users don't need direct access to this table
CREATE POLICY "Allow sequence management"
  ON public.entity_number_sequences
  FOR ALL
  USING (true)
  WITH CHECK (true);
```

---

## 25. Core Data Server Actions

All core data operations are implemented as Next.js Server Actions in `src/lib/actions/`. Each file follows the same patterns:

- `'use server'` directive
- Auth check via `getAuthenticatedUser()`
- Permission checks via `checkPermission()` or `checkProjectMembership()`
- Admin bypass for org-level admins
- Structured returns: `ActionResult<T>` = `{ error: string }` | `{ success: true, data: T }`
- Activity logging via `logActivity()` after mutations
- `revalidatePath()` for Next.js cache invalidation

### 25.1 Shared Permission Helper

```
File: src/lib/actions/permissions-helper.ts
```

Exports:
- `ActionResult<T>` -- Discriminated union return type
- `getAuthenticatedUser(supabase)` -- Get current user or return error
- `checkPermission(supabase, userId, projectId, action)` -- Verify org + project role permissions
- `checkProjectMembership(supabase, userId, projectId)` -- Verify read access
- `logActivity(supabase, ...)` -- Insert activity log entry

### 25.2 Projects

```
File: src/lib/actions/projects.ts
```

| Function | Permission | Description |
|---|---|---|
| `getProjects()` | Membership | All projects for current user (admins see all) |
| `getProjectById(projectId)` | Membership | Single project |
| `createProject(data)` | admin/manager org role | Create project + auto-add creator as manager |
| `updateProject(projectId, data)` | project:edit | Update project fields |
| `updateProjectStatus(projectId, status)` | project:edit | Change status, auto-set actual_end_date on completion |
| `deleteProject(projectId)` | admin org role | Delete project (cascading via DB) |

### 25.3 Submittals

```
File: src/lib/actions/submittals.ts
```

| Function | Permission | Description |
|---|---|---|
| `getSubmittals(projectId)` | Membership | All submittals with profile joins |
| `getSubmittalById(projectId, submittalId)` | Membership | Single submittal with attachments |
| `createSubmittal(projectId, data)` | submittal:create | Create with auto-generated SUB-NNN number |
| `updateSubmittalStatus(projectId, submittalId, status, reviewNotes?)` | submittal:review for approve/reject | Update status, auto-set reviewer |

### 25.4 RFIs

```
File: src/lib/actions/rfis.ts
```

| Function | Permission | Description |
|---|---|---|
| `getRFIs(projectId)` | Membership | All RFIs with profile joins |
| `getRFIById(projectId, rfiId)` | Membership | Single RFI with responses + attachments |
| `createRFI(projectId, data)` | rfi:create | Create with auto-generated RFI-NNN number |
| `updateRFIStatus(projectId, rfiId, status)` | rfi:close for closing | Update status, set response_date |
| `addRFIResponse(projectId, rfiId, content, isOfficial)` | rfi:respond for official | Add response, auto-update RFI if official |

### 25.5 Daily Logs

```
File: src/lib/actions/daily-logs.ts
```

| Function | Permission | Description |
|---|---|---|
| `getDailyLogs(projectId)` | Membership | All logs with creator profile |
| `getDailyLogById(projectId, logId)` | Membership | Single log with personnel, equipment, work items, attachments |
| `createDailyLog(projectId, data)` | daily_log:create | Create log + nested personnel, equipment, work items |

### 25.6 Punch List

```
File: src/lib/actions/punch-list.ts
```

| Function | Permission | Description |
|---|---|---|
| `getPunchListItems(projectId)` | Membership | All items with profile joins |
| `getPunchListItemById(projectId, itemId)` | Membership | Single item with attachments |
| `createPunchListItem(projectId, data)` | punch_list:create | Create with auto-generated PL-NNN, optional geo_tag |
| `updatePunchListStatus(projectId, itemId, status, resolutionNotes?)` | punch_list:resolve or punch_list:verify | Update status, auto-set resolved/verified dates |

### 25.7 Team Management

```
File: src/lib/actions/team.ts
```

| Function | Permission | Description |
|---|---|---|
| `getProjectMembers(projectId)` | Membership | All members with profiles + organizations |
| `addProjectMember(projectId, profileId, role)` | team:manage | Add member, check duplicates, auto-set can_edit |
| `removeProjectMember(projectId, memberId)` | team:manage | Remove member (cannot self-remove) |
| `updateMemberRole(projectId, memberId, role)` | team:manage | Change role + update can_edit |

### 25.8 Milestones

```
File: src/lib/actions/milestones.ts
```

| Function | Permission | Description |
|---|---|---|
| `getMilestones(projectId)` | Membership | All milestones ordered by sort_order |
| `createMilestone(projectId, data)` | schedule:edit | Create with auto sort_order |
| `updateMilestone(projectId, milestoneId, data)` | schedule:edit | Update, auto-set actual_date on complete |

### 25.9 Activity Log

```
File: src/lib/actions/activity-log.ts
```

| Function | Permission | Description |
|---|---|---|
| `getActivityLog(projectId, limit?)` | Membership | Recent activity with performer profiles (max 200) |

### 25.10 Updated Permissions File

The permissions file (`src/lib/permissions.ts`) has been updated with two additional actions:

```typescript
PROJECT_EDIT: 'project:edit',
SCHEDULE_EDIT: 'schedule:edit',
```

These are granted to the `manager` role (via `ALL_ACTIONS`), and `SCHEDULE_EDIT` is also granted to `superintendent`.

### 25.11 Files Created (Server Actions)

| # | File | Purpose |
|---|---|---|
| 1 | `src/lib/actions/permissions-helper.ts` | Shared auth, permission, and logging utilities |
| 2 | `src/lib/actions/projects.ts` | Project CRUD server actions |
| 3 | `src/lib/actions/submittals.ts` | Submittal CRUD server actions |
| 4 | `src/lib/actions/rfis.ts` | RFI CRUD + response server actions |
| 5 | `src/lib/actions/daily-logs.ts` | Daily log CRUD with nested inserts |
| 6 | `src/lib/actions/punch-list.ts` | Punch list CRUD server actions |
| 7 | `src/lib/actions/team.ts` | Team management server actions |
| 8 | `src/lib/actions/milestones.ts` | Milestone CRUD server actions |
| 9 | `src/lib/actions/activity-log.ts` | Activity log read server action |

---

## 26. Master Implementation Order

This is the complete end-to-end order for implementing the full Supabase backend. Follow these phases in sequence.

### Phase 1: Database Setup (Supabase Dashboard)

```
Step 1:  Set environment variables (.env.local + Vercel)
           - NEXT_PUBLIC_SUPABASE_URL
           - NEXT_PUBLIC_SUPABASE_ANON_KEY
           - SUPABASE_SERVICE_ROLE_KEY
           - NEXT_PUBLIC_SITE_URL
Step 2:  Enable Email provider in Supabase Auth
Step 3:  Configure Google OAuth (Google Cloud Console + Supabase)
Step 4:  Set Site URL + Redirect URLs in Supabase Auth
```

### Phase 2: Core Schema (SQL Editor -- run in order)

```
Step 5:  Create update_updated_at() function (Section 2.5)
Step 6:  Create organizations table (Section 2.2)
Step 7:  Create profiles table (Section 2.1) + indexes + trigger
Step 8:  Create projects table (Section 2.3)
Step 9:  Create project_members table (Section 2.6)
Step 10: Create handle_new_user() trigger (Section 2.4)
Step 11: Create user_preferences table (Section 14.1)
Step 12: Update handle_new_user() to include preferences (Section 14.2)
```

### Phase 3: Data Tables (SQL Editor -- run in order)

```
Step 13: Create entity_number_sequences + assign_entity_number() (Section 23.1)
Step 14: Create milestones table (Section 23.2)
Step 15: Create submittals table (Section 23.3)
Step 16: Create rfis table (Section 23.4)
Step 17: Create rfi_responses table (Section 23.5)
Step 18: Create daily_logs table (Section 23.6)
Step 19: Create daily_log_personnel, daily_log_equipment, daily_log_work_items (Section 23.7)
Step 20: Create punch_list_items table (Section 23.8)
Step 21: Create milestone_submittals, milestone_rfis (Section 23.9)
Step 22: Create activity_log table (Section 23.10)
Step 23: Create attachments table (Section 17.2)
```

### Phase 4: Security (SQL Editor)

```
Step 24: Enable RLS on all tables (Section 23.11 + Section 3.1)
Step 25: Create profiles RLS policies (Section 3.2)
Step 26: Create projects RLS policies (Section 3.3)
Step 27: Create project-scoped data RLS policies (Section 3.4)
Step 28: Create project_members RLS policies (Section 3.5)
Step 29: Create milestones RLS policies (Section 24.1)
Step 30: Create rfi_responses RLS policies (Section 24.2)
Step 31: Create daily log sub-entity RLS policies (Section 24.3)
Step 32: Create milestone junction RLS policies (Section 24.4)
Step 33: Create activity log RLS policies (Section 24.5)
Step 34: Create entity number sequences policy (Section 24.6)
Step 35: Create user_preferences RLS policies (Section 14.3)
```

### Phase 5: Storage (Supabase Dashboard + SQL)

```
Step 36: Create avatars bucket (Section 13.1)
Step 37: Create avatar storage policies (Section 13.2)
Step 38: Create project-photos, thermal-photos, project-documents buckets (Section 17.1)
Step 39: Create storage RLS policies for all 3 buckets (Section 17.4)
Step 40: Create attachment table RLS policies (Section 17.5)
```

### Phase 6: Activity Log Triggers (SQL Editor)

```
Step 41: Create all activity log trigger functions (Section 18)
```

### Phase 7: Authentication Code

```
Step 42: Create src/middleware.ts (Section 4.1)
Step 43: Create src/app/auth/callback/route.ts (Section 4.3)
Step 44: Create src/lib/supabase/admin.ts (Section 3.6)
Step 45: Create src/lib/supabase/auth-helpers.ts (Section 4.4)
Step 46: Create src/lib/auth-errors.ts (Section 8.1)
Step 47: Create src/lib/actions/auth.ts (Section 4.6)
Step 48: Update src/app/(auth)/login/page.tsx (Section 5.2)
Step 49: Create src/app/(auth)/update-password/page.tsx (Section 5.3)
Step 50: Create src/components/providers/AuthProvider.tsx (Section 6.1)
Step 51: Create src/hooks/useUser.ts (Section 6.3)
Step 52: Update src/app/(app)/layout.tsx (Section 6.2)
```

### Phase 8: Profile & Settings

```
Step 53: Create src/lib/actions/profile.ts (Section 12.1)
Step 54: Create src/lib/actions/preferences.ts (Section 14.4)
Step 55: Create src/lib/avatar-upload.ts (Section 12.2)
Step 56: Wire profile page to real data (Section 12.3--12.4)
Step 57: Wire settings page to real data (Section 12.5, 14.5)
```

### Phase 9: Core Data Server Actions

```
Step 58: Create src/lib/actions/permissions-helper.ts (Section 25.1)
Step 59: Update src/lib/permissions.ts with new actions (Section 25.10)
Step 60: Create src/lib/actions/projects.ts (Section 25.2)
Step 61: Create src/lib/actions/submittals.ts (Section 25.3)
Step 62: Create src/lib/actions/rfis.ts (Section 25.4)
Step 63: Create src/lib/actions/daily-logs.ts (Section 25.5)
Step 64: Create src/lib/actions/punch-list.ts (Section 25.6)
Step 65: Create src/lib/actions/team.ts (Section 25.7)
Step 66: Create src/lib/actions/milestones.ts (Section 25.8)
Step 67: Create src/lib/actions/activity-log.ts (Section 25.9)
```

### Phase 10: Wire Pages to Server Actions

```
Step 68: Update Dashboard page -- replace store calls with server actions
Step 69: Update Submittals pages (list, detail, new)
Step 70: Update RFI pages (list, detail, new)
Step 71: Update Daily Log pages (list, detail, new)
Step 72: Update Punch List pages (list, detail, new)
Step 73: Update Schedule/Milestones page
Step 74: Update Team page
Step 75: Update Sidebar + Topbar to use auth context
Step 76: Create src/lib/photo-upload.ts (Section 17.6)
Step 77: Wire PhotoUpload + PhotoGallery components to Supabase Storage
```

### Phase 11: Permissions UI Integration

```
Step 78: Update usePermissions hook (Section 16.3)
Step 79: Update AuthProvider to fetch project memberships (Section 16.7)
Step 80: Wire permission checks into all page components (Section 16.9)
```

### Phase 12: Email Templates + Final Configuration

```
Step 81: Configure email templates in Supabase Dashboard (Section 7)
Step 82: Generate TypeScript types from Supabase schema (Section 19)
Step 83: Set up Supabase migrations (Section 20)
Step 84: (Optional) Enable Realtime subscriptions (Section 21)
```

### Phase 13: Testing

```
Step 85: Test auth flows (Section 11)
Step 86: Test profile & settings (Section 15)
Step 87: Test RBAC for all 7 project roles (Section 16.11)
Step 88: Test photo upload/download for all entity types
Step 89: Test RLS: verify cross-project data isolation
Step 90: Test cascading deletes (delete project, verify all child data removed)
```

---

*Document updated: February 28, 2026*
*Product: RailCommand -- by A5 Rail*
*Developer: Dillan Milosevich, CTO -- Creative Currents LLC*
