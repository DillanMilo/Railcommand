# TestFlight preparation — sending held by owner

**Current instruction (September 23): “Don't send anything yet. Just let me know
when it's ready.” This supersedes earlier permission to send invitations when
ready. Do not send TestFlight invitations, notification emails or the custom email
until the owner explicitly releases this hold.**

## Prepared and verified

Direct Apple API readback at 17:10 UTC, September 23, 2026:

- App: 6803576049, RailCommand 1.0.0, approved build **300012**.
- Build/review ID: `63f090af-3c0d-49d9-93c6-2eded1603260`; review **APPROVED**.
- Existing external group renamed from **Dillan Preview** to
  **RailCommand Field Beta**, ID `35f5c4a4-8577-47bf-8e93-8c6d8d9f2383`.
- Existing membership preserved: `caleb@lenaserv.com`,
  `mark.allen@a5rail.com`, `dillan@creativecurrents.io`.
- Every external tester remains **NOT_INVITED** after preparation.
- Build automatic notifications were enabled; now explicitly **false**, confirmed
  by a fresh read. Public invitation link remains **disabled**.
- **No build assigned to this external group yet.** The approved build already has
  an active external-testing state, so its final association with the populated
  group is deliberately reserved for the authorized sending step.
- The internal group and Dillan's installed build were not changed.
- [iPhone instruction email](FIELD_TESTER_EMAIL_DRAFT_20260923.md) is prepared as a
  local draft. Uses the owner's first-person voice and the existing RailCommand
  login/live-data workflow. No email or invitation link has been sent/generated.

## Readiness boundary and next action

Invitation preparation is complete. Distribution and full physical-device
acceptance are not complete. Retain the on-phone save/photo, web readback, DFR PDF
export and relevant offline/restart checks recorded in
[external readiness](EXTERNAL_TESTFLIGHT_READINESS_20260922.md). The designated
fictional [review project](APPLE_REVIEW_ACCOUNT_20260922.md) is available for safe
testing; do not use customer work as disposable test data or discard device queues.

When those checks pass **and the owner releases the sending hold**, recheck Apple
approval, build identity, group roster and notification settings. Assign 300012 to
the intended external group, then perform the explicitly authorized invitation
step and verify each recipient's resulting state. Do not substitute global admin
roles, public links, or the Apple-review login for the testers' existing accounts.

## Impact and verification

- User-visible change: group organization and an unsent instruction draft only.
- Web, shared APIs/domain/database: no application or customer-data changes.
- Mobile: distribution settings only; same approved native binary and existing
  account/project permissions. No new build or backend deployment.
- Offline classification: **online-only** Apple release administration. Native and
  web drafts, queues and installed-client compatibility are unchanged.
- Verification: Apple approval, notification-off setting, group name/public-link
  setting and unchanged NOT_INVITED roster read back directly. No notification,
  tester-creation or build-assignment endpoint was called.
- Application tests/builds were not rerun for this metadata/documentation-only
  preparation; prior account/API/build checks remain in the linked handoffs.
- SDK note: its BuildBetaDetail.updateAsync sends obsolete/read-only attributes
  and Apple rejects it. The successful update used the documented PATCH endpoint
  with only `attributes: { autoNotifyEnabled: false }`. No credentials logged.
- No automatic monitor or future sending job was created.
