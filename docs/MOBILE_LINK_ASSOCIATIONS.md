# RailCommand mobile link associations

## Scope

The two `/.well-known` routes publish the public identifiers that allow iOS and
Android to verify links for the production RailCommand application. They do not
change authentication, customer records, the web application's ordinary pages, or
the mobile API.

## Offline classification

**Online-only infrastructure.** Apple and Google retrieve these public documents over
HTTPS. No project or user data is read, written, cached, or queued. Mobile daily-log
drafts and the durable outbox continue to work independently when the device is
offline.

## Safety and validation

- The routes return data only for `railcommand.io` and `www.railcommand.io`.
- The Apple document contains only team `PQAGLH9L66` and bundle
  `io.railcommand.app`.
- The Android document contains only package `io.railcommand.app` and the public
  Google Play App Signing SHA-256 certificate fingerprint.
- Both routes bypass login middleware because operating systems fetch them without a
  RailCommand session.
- Unknown and staging hosts receive `404` from these production-only handlers.

Before production deployment, build and test this isolated patch as a preview. After
explicit production authorization, verify both live URLs return direct
`200 application/json` responses without authentication or redirects. Rollback is
the previous Vercel production deployment; no database rollback is involved.
