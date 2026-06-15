# US-Only Access Controls

RailCommand enforces United States access at the application layer for sign-in,
onboarding, invites, demo entry points, project pages, settings, search, chat,
email, notification, and demo-admin API routes.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `US_ONLY_ACCESS_ENABLED` | `true` in production, `false` in local dev | Enables the app-layer geo gate. Set to `false` only for controlled rollout or debugging. |
| `US_ONLY_ALLOWED_COUNTRIES` | `US` | Comma-separated ISO 3166-1 alpha-2 country codes allowed through the gate. |
| `US_ONLY_BLOCK_UNKNOWN_COUNTRY` | `true` in production, `false` in local dev | Blocks protected routes when the request has no trusted country header. |

Local development is not blocked by default. To smoke-test the middleware
without changing Vercel, send the `x-rc-test-country` request header:

```bash
curl -I -H 'x-rc-test-country: CA' http://localhost:3000/dashboard
curl -I -H 'x-rc-test-country: US' http://localhost:3000/dashboard
```

## Vercel Firewall Rule

Add this as a second layer in Vercel after the deployment is verified:

1. Open `railcommand` in Vercel.
2. Go to `Firewall`.
3. Add a custom rule named `US-only app access`.
4. Match protected paths:
   `/login`, `/auth/*`, `/dashboard/*`, `/projects/*`, `/settings/*`,
   `/search/*`, `/onboarding/*`, `/invite/*`, `/demo/*`, `/api/chat/*`,
   `/api/admin/demo/*`, `/api/email/send`, and `/api/notifications`.
5. Add a condition where `Country` is not `United States`.
6. Start with action `Log` long enough to confirm expected traffic, then change
   the action to `Deny`.

Keep `/api/cron/*` and `/api/health/supabase` out of the rule so scheduled jobs
and health checks keep working.

## VPN And Proxy Control

IP-based geography blocks non-US networks and many offshore VPN exits, but it
cannot prove physical location if someone uses a US-based VPN or proxy. For
strict VPN blocking, add an IP reputation provider or maintain a Vercel Firewall
denylist for known proxy, VPN, hosting-provider, and suspicious ASN ranges.

The app-layer gate intentionally fails closed in production when the request
country is unknown.
