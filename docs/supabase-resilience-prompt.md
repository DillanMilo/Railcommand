# Supabase Resilience Implementation Prompt

Use this prompt in each app that depends on Supabase:

```text
We are seeing intermittent DNS/connectivity failures to Supabase project endpoints such as <project-ref>.supabase.co. Please harden this app so Supabase outages or resolver failures do not leave users stuck.

Implement:
1. A shared Supabase connectivity utility:
   - Wrap Supabase browser fetch calls with a 10-15 second timeout.
   - Translate fetch/network/timeout/abort errors into a friendly user-facing message.
   - Add a direct client-side health check to NEXT_PUBLIC_SUPABASE_URL + /auth/v1/health using the anon key.

2. Auth and data UX protection:
   - Catch errors in email/password login, OAuth login, signup, password reset, and resend-confirmation flows.
   - Always clear loading states in finally blocks.
   - Show a clear message such as: "Could not reach the auth service. Check your internet, VPN, or DNS settings and try again."
   - Do not expose Supabase keys beyond existing NEXT_PUBLIC anon usage.

3. A global service banner:
   - Run the client-side Supabase health check on app load, focus, browser online, and every 60 seconds.
   - Show a dismissible banner only when the client cannot reach Supabase.
   - Include a Retry button.
   - Hide the banner once connectivity returns.

4. A public server-side health endpoint:
   - Add GET /api/health/supabase.
   - From the server, fetch <NEXT_PUBLIC_SUPABASE_URL>/auth/v1/health with anon apikey and a 5 second timeout.
   - Return JSON with ok, status, latencyMs, and checkedAt.
   - Set Cache-Control: no-store.
   - Make the route public if middleware protects routes.

5. Verification:
   - Run TypeScript/build checks.
   - Test that normal app pages still render.
   - Simulate unreachable Supabase/DNS and confirm login does not spin forever.
   - Confirm /api/health/supabase returns 200 when reachable and 503/502 when not.

Keep changes scoped and do not refactor unrelated app logic.
```
