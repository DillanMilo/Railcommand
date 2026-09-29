# Web/mobile parity audit — September 17, 2026

**Not full parity; do not tell external testers that every web feature is present.**
This is a source audit of backend edb985a and native 48cc92c plus the current
same-day-log patch. It is not physical-device acceptance or a live-data write test.

| Capability | Current native behavior | Missing acceptance/work |
|---|---|---|
| Sign-in and projects | Existing accounts, Google, project selection | Refresh/access-revocation and role-specific end-to-end checks |
| Daily logs | Create/queue/photos, cached detail, share text | Native existing-log editing, server attachment viewing, PDF equivalence; same-day review patch not released |
| RFIs | Native list/detail/create, saved drafts, attachment reads | Responses, status changes, edit/delete, creation attachment parity |
| Submittals | Native list/detail/create, saved drafts, attachment reads | Review/status changes, edit/delete, creation attachment parity |
| RailBot | Native chat/history/voice and confirmed supported actions | Full tool-by-tool comparison and physical-device/offline acceptance; user reports it working |
| Punch list | Web link; some RailBot creation | Native list/detail/edit/status/photos/delete |
| Safety | Web link | Native create/detail/edit/files/delete |
| QC/QA | Web link | Native create/detail/edit/files/delete |
| Documents | Web link | Native upload/version/detail/download/edit/delete |
| Photos | Daily-log capture/queue; project gallery opens web | Native project gallery/upload/filter/attachment management |
| Weekly reports / UP workbook | Web link; some native report export paths | Native author/edit/generate and workbook configuration/template parity |
| Schedule | Web link | Native milestones create/edit/delete and progress |
| Team | Native member reads | Invitation, role/edit permissions, removal/leave flows |
| Cameras | Native viewer | Web connection/camera/evidence administration parity |
| Account/admin/search | Selected account controls | Profile/avatar, preferences, notifications, global search, client/demo/project administration audit |
| Change orders/modifications/activity | No full native workflow confirmed | Audit web exposure and implement corresponding supported actions |

## Shared workspace implementation update

The table above records the earlier native-only audit. The bounded implementation
now reuses those web workflows inside an isolated in-app online workspace, retaining
native offline Field tools. See `SHARED_WORKSPACE_RELEASE_20260917.md` for current
verification and rollout. Daily-log atomic editing and upload receipt recovery are
implemented locally to address the data-safety findings below. They must be
verified and deployed before those findings are considered closed. No action has
been marked device-verified just because its web screen is reused.

## Original release priorities (superseded by shared workspace rollout)

1. Recover queued logs safely; ship multiple same-day visibility and explicit review.
2. Implement field mutations: existing-log editing with concurrency protection,
   RFI responses/status and submittal review, attachments; verify both directions.
3. Bring remaining field modules into native screens with shared authorized services.
4. Finish report/admin/search parity as required by each tester's role. Permission
   differences remain intentional; parity never means granting additional access.
5. Complete physical iPhone tests and external distribution/review gates before
   sending a message promising full functionality. Include Caleb's concerns first.

## Automated inventory gate

`node scripts/verify-web-mobile-parity.mjs` checks every exported web action against
`WEB_MOBILE_PARITY.json`; newly added actions cannot be silently omitted.
`node scripts/verify-web-mobile-parity.mjs --require-complete` deliberately fails
until every action has verified mobile parity and all additional gates are closed.
An inventory pass does **not** mean functional parity. Human/device evidence is
required before changing a status to `verified`.

## Known data-safety work discovered by this audit

The current web daily-log update action performs parent and child changes in
separate requests and lacks an updated-at concurrency baseline. Fix this before
exposing the same edit flow in mobile. Existing web attachment retries also need
stable per-file identity and reconciliation after an ambiguous response; a failed
upload must not encourage creating another parent record. Track these as release
blockers for full write parity, not as already tested functionality.

## Future tasks and Caleb's feedback

Use this same task for Caleb's concerns while this work is active. A new task in
this repository should read AGENTS.md and the web/mobile change policy, then this
audit and the current release handoff. Paste the concern and say it applies to
both web and mobile. A new task does not automatically inherit this conversation.
