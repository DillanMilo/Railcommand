# Password recovery across app and browser

Mark's October 17 recording shows a reset requested in the native app, received
in Outlook, then opened through Proofpoint into Edge. Auth issued the recovery
code about 22 seconds after the request; the pending PKCE flow was not exchanged.
The app holds the verifier, while Edge does not. The web UI reported this as an
expired link. This evidence identifies a browser handoff failure, not a one-hour
timeout or evidence that Mark needs a newer TestFlight build.

## Change and platform impact

- Web: recovery callback GET redirects to an explicit confirmation form. Only a
  same-origin POST verifies the token and creates the existing user-bound,
  HttpOnly, fifteen-minute recovery permission. Scanner GETs and prefetches cannot
  spend recovery tokens. Auth pages/responses use no-store and no-referrer.
  Missing legacy PKCE verifiers receive a specific new-link instruction.
- Native: change the separate Supabase SMTP recovery template from
  `ConfirmationURL` to `SiteURL/auth/callback?token_hash=TokenHash&type=recovery&next=/reset-password`.
  The installed callback already supports `verifyOtp` with this token hash. The
  existing callback path also preserves iOS/Android link routing. No bundled
  native code, new TestFlight build, or OTA mechanism is required for this fix.
- Shared API/domain/database: no schema, project permission, mobile API, pilot,
  RailBot, provisioning, or queued-write contract changes. Token verification
  uses the public Auth client; administrative credentials are never sent to users.
- Installed compatibility: legacy same-browser PKCE, OAuth and signup callbacks
  remain supported. Previously issued native emails still contain the old URL;
  affected users must request a new email after template publication.
- Offline classification: **online-only**, because Auth must verify the token and
  change the password. Confirmation explains the connection requirement. Retryable
  verification failures preserve the link. Existing password forms retain mounted
  input on failure; passwords are not persisted. Recovery is not queued. Existing
  offline databases, drafts, attachments and outboxes are unchanged across upgrade,
  restart and sign-out.
- Idempotency/authorization: Auth enforces expiry and single use; foreign/missing
  POST origins are denied before verification. Recovery permission is signed for
  the verified identity and cannot be transferred between users.

## Verification and rollout

Local gates: production build, TypeScript, 336 auth/mobile API cases, sixteen
isolated beta-account cases, grant static/unit checks and lint (existing warnings).
The isolated PostgreSQL grant test requires Docker and runs in PR CI because the
local Docker daemon is stopped. Native typecheck, native/domain regression tests,
244 native tests and 27 shared-domain tests pass. Eleven local integration checks
pass against the production build and real Auth/SMTP using only the temporary QA
account. Preview acceptance and production acceptance are recorded on the linked PR.

Acceptance uses a temporary account with no organization/projects and Resend's
simulated `delivered@resend.dev` recipient. It requests an actual PKCE reset via
the native SDK and tests independent-browser verification without copying its
verifier, repeated scanner GETs, rejected foreign POSTs, one-time replay, web to
native and native to web password use. QA sessions and the temporary account are
removed afterward. No human account passwords or reset tokens are used.

Deploy the web routes first; then patch only the SMTP recovery template and read
it back. The template is versioned at `supabase/templates/recovery.html`; the
subject, one-hour Auth expiry, SMTP settings and other templates remain unchanged.
The pre-change template is saved privately for rollback. Web rollback target is
production `dpl_9Dftu6ELVRjTKp81GthBtmHoPAwe` (main `57babea`).

Physical Outlook/Proofpoint/Edge on Mark's iPhone remains the final device
acceptance case. SDK/HTTP/browser checks cannot certify that exact third-party
device combination. Track that check with the PR release outcome; do not label it
passed without a device result.
