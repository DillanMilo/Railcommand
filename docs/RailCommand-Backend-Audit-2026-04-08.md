# RailCommand Backend Audit — 2026-04-08

## §7 Edge Functions Audit

N/A — no `/supabase/functions/` directory exists. No edge functions are deployed.

## §8 Client Bundle Audit

### Source-Level Scan

| Env Var | File | Context | Classification |
|---|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `src/lib/supabase/admin.ts` | Server-only utility (only imported by `'use server'` actions and API routes) | SAFE |
| `RESEND_API_KEY` | `src/lib/notifications/send.ts` | Server-only utility (not imported by any file currently) | SAFE |
| `RESEND_API_KEY` | `src/app/api/email/send/route.ts` | API route (server-only by Next.js convention) | SAFE |
| `RESEND_FROM_EMAIL` | `src/app/api/email/send/route.ts` | API route | SAFE |
| `RESEND_FROM_EMAIL` | `src/lib/notifications/send.ts` | Server-only utility (unused) | SAFE |
| `OPENAI_API_KEY` | `src/app/api/chat/route.ts` | API route | SAFE |
| `OPENAI_API_KEY` | `src/app/api/chat/transcribe/route.ts` | API route | SAFE |
| `CRON_SECRET` | `src/app/api/cron/daily-log-reminders/route.ts` | API route | SAFE |
| `CRON_SECRET` | `src/app/api/cron/overdue-reminders/route.ts` | API route | SAFE |
| `EMAIL_API_KEY` | `src/app/api/email/send/route.ts` | API route | SAFE |
| `NOTIFICATIONS_API_KEY` | `src/app/api/email/send/route.ts` | API route | SAFE |
| `NOTIFICATIONS_API_KEY` | `src/app/api/notifications/route.ts` | API route | SAFE |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/client.ts` | Browser client (public by design) | SAFE |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/client.ts` | Browser client (public by design) | SAFE |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/lib/supabase/server.ts` | Server client | SAFE |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/lib/supabase/server.ts` | Server client | SAFE |
| `NEXT_PUBLIC_SUPABASE_URL` | `src/middleware.ts` | Middleware (server-only) | SAFE |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `src/middleware.ts` | Middleware (server-only) | SAFE |
| `NEXT_PUBLIC_APP_URL` | `src/lib/notifications/templates.ts` | Public var, safe by design | SAFE |
| `NEXT_PUBLIC_SITE_URL` | `src/lib/actions/invitations.ts` | `'use server'` file, public var | SAFE |

No RISK items found. All server-only env vars are confined to API routes, `'use server'` actions, or server-only utility files that are never imported by client components.

### next.config.ts Review

The config is an empty object — no `env`, `publicRuntimeConfig`, `serverRuntimeConfig`, or `define` blocks present. No risk of server-only variables being injected into client bundles via configuration.

```ts
const nextConfig: NextConfig = {
  /* config options here */
};
```

### Production Build Scan

Build completed successfully. Scanned `.next/static/` for leaked secrets:

| Pattern | Matches | Notes |
|---|---|---|
| `service_role` | 0 | Clean |
| `RESEND` | 0 | Clean |
| `OPENAI` | 0 | Clean |
| `CRON_SECRET` | 0 | Clean |
| `eyJ` (JWT prefix) | 1 match | Anon key only (`role: "anon"`) — expected, this is the public Supabase key embedded by `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

No service role key, API keys, or other secrets found in the client bundle.

### .env.local Classification

`.env.local` is covered by `.gitignore` via the `.env*` glob pattern. It is not committed to the repository.

| Env Var | Scope | Notes |
|---|---|---|
| `OPENAI_API_KEY` | Server-only | Used in API routes only |
| `RESEND_API_KEY` | Server-only | Used in API routes / notification lib only |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL — safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Anon-role JWT — safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Admin-level access — must never leak to client |
| `NEXT_PUBLIC_SITE_URL` | Public | Canonical site URL |
| `CRON_SECRET` | Server-only | Bearer token for cron endpoint auth |
| `NEXT_PUBLIC_APP_URL` | Public | App URL for links/OG tags |

Note: `EMAIL_API_KEY`, `NOTIFICATIONS_API_KEY`, and `RESEND_FROM_EMAIL` are referenced in code but not defined in `.env.local`. These are optional and presumably set in Vercel environment variables or not yet configured.

### Verdict

**PASS** — No server-only secrets leak into the client bundle. All sensitive env vars are properly confined to API routes and server-side code. The `.env.local` file is gitignored. The production build is clean.
