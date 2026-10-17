# Recovery confirmation with privacy-preserving browser headers

Mark's follow-up screenshot shows the confirmation POST returning downloadable
JSON: `Invalid request origin.` The previous release used `no-referrer` on the
confirmation page while requiring an exact non-null Origin for its HTML form.
The [Fetch Origin-header algorithm](https://fetch.spec.whatwg.org/#append-a-request-origin-header)
sets Origin to `null` for non-CORS form POSTs under that policy. The earlier HTTP
acceptance script forced a normal Origin header and missed this browser behavior.
The previous claim of complete acceptance is superseded by this record.

## Change and impact

- Web: middleware issues a fresh 256-bit confirmation nonce when the confirmation
  page is rendered. It overwrites any caller-supplied internal nonce header and
  pairs the hidden form value with an HttpOnly, SameSite=Strict, fifteen-minute
  cookie. Production uses the `__Host-` prefix, Secure and Path=/ with no Domain.
  Every confirmation POST requires the matching cookie and form value. Privacy
  null/missing Origin is supported; explicit foreign origins and cross-site fetch
  metadata remain rejected. No recovery token is verified on GET.
- Browser errors: stale/missing confirmation state returns the preserved link to
  a fresh confirmation page with a clear cookie/retry instruction. Foreign or
  malformed submissions return a normal sign-in page, never downloadable JSON.
  Verification still creates the same signed, user-bound recovery permission.
  Successful confirmation deletes its temporary nonce cookie.
- Native: existing token-hash callbacks and the already-published SMTP template
  remain compatible. Direct native verification is unchanged; reset emails opened
  in Edge/Safari use the repaired web confirmation. No new TestFlight build or
  native bundled change is required. Native source remains on its release branch.
- Shared API/domain/database: no migrations or project-data changes. Existing
  mobile API authentication, pilot restrictions, RailBot, permissions and queued
  mutation contracts are retained. Auth expiry remains one hour and single use.
- Offline classification: **online-only**. The confirmation page explains this;
  retry failures preserve the link and existing password forms retain mounted
  input. No password/credential draft is persisted or queued. Offline databases,
  drafts and outboxes are unchanged across restart, sign-out and upgrades. Private
  responses remain no-store/no-referrer and outside the public service-worker cache.

## Verification and release

350 auth/mobile tests cover null, absent, normal and foreign origins, matching and
missing/mismatched nonces, forged middleware headers, cookie flags, retry, replay,
and existing OAuth/signup/native contracts. Sixteen provisioning tests pass.
Production build and TypeScript pass; lint has no errors. Static grant and nine
grant unit checks pass; isolated PostgreSQL permission checks run in PR CI because
the local Docker daemon is stopped.

The revised full-flow script uses an actual native 2.106.2 SDK PKCE/SMTP request
and browser-accurate `Origin: null`, with the cookie and hidden value obtained from
the rendered page. It verifies scanner GETs cannot consume the link, cross-site
and forged submissions cannot consume it, password changes work between web and
native in both directions, and one-time replay fails. Only a temporary QA account
and Resend's simulated recipient are used; QA identity/sessions/profile/event rows
are removed. Human passwords and reset tokens are never used.

Browser checks cover the actual HTML form submission and password-form arrival;
the final password update and subsequent login are exercised through the Auth SDK
and HTTP, not by typing a credential into browser automation. The exact physical
iPhone Outlook/Proofpoint/Edge combination remains explicitly pending unless Mark
confirms his retest. Record preview, production SHA/deployment and browser results
on the release PR. Do not equate scripted or desktop checks with physical-device
acceptance.

Rollout: web/backend only, after PR checks and preview acceptance. Verify the live
alias points at the merged source, then repeat browser and full Auth acceptance.
The SMTP template needs no further change. Existing newest links retain their
normal one-hour validity; this fix does not require a differently formatted email.
Rollback reference: main `9469965`, deployment `dpl_HcAqNYisAnn94iXEpKpSMt34Ka5c`
(known null-Origin defect; roll forward to this correction when possible).
