# Field beta parity and daily-log recovery — September 17

Status: implementation in progress; not an external-beta readiness declaration.

## Product decision and research

Support multiple independent daily logs per project/date. A log belongs to its
author and retains its UUID, children and attachments. A calendar day is a group,
not the identity of a record. Do not merge summaries or overwrite another log.

This recommendation follows Autodesk's documented multiple-log workflow for
different shifts/areas, and Procore's daily-log segments by crew/shift/location.
These examples support the choice; they do not establish a universal standard.

- https://blogs.autodesk.com/bim360-release-notes/2020/09/24/multiple-daily-logs/
- https://help.autodesk.com/cloudhelp/ENU/BIM360D-Field-Management/files/GUID-CDBFE508-C833-42AB-9A36-A67999BBE58E.html
- https://support.procore.com/products/online/user-guide/project-level/daily-log

## Implementation sequence

1. Audit date uniqueness assumptions in web/mobile calendars, reports, exports,
   API reads and writes. Make all same-day records individually accessible.
2. Add explicit review/confirmation of a queued same-day log. Preserve the
   original client UUID, idempotency key, date, fields, photo manifest and files.
   Review is required before allowing a second same-day queued operation; older
   apps must continue to fail safely rather than silently submit ambiguous work.
3. Replace only project/date uniqueness with a non-unique lookup index. Retain
   primary-key and author/idempotency uniqueness, RLS and all foreign keys. The
   authenticated RPC serializes same-day checks, rechecks permission on retries,
   and requires explicit same-day confirmation for an additional new record.
4. Test synthetic records in a transaction/staging: two independent logs, exact
   retry, payload failure atomicity, unauthorized access and unchanged old log.
   Never use real field records as disposable test fixtures.
5. Verify web/mobile builds and focused tests; deploy compatible web/API before
   schema rollout and new signed mobile build. Verify physical-device recovery
   before declaring the user's two logs delivered.

## Offline classification and safeguards

Native daily-log creation/recovery: **offline draft/queue**. Review of the device entry
works offline; authoritative existing records require an online refresh (cached
records are visibly read-only). Explicit confirmation is durably saved locally;
delivery waits for connectivity. No input or photos are deleted on error.
Server-assigned data remains server-assigned; auth/membership/RLS are rechecked.
Photos wait for their original parent UUID; no parent remapping is needed.
Confirmed retries use the original identity and return the existing receipt.
No public-cache, user-partition, quota or sign-out cleanup behavior is relaxed.
After app restart the same outbox payload remains usable. Network interruptions
must not reset consent or duplicate a server-confirmed record.

Released web create form: **online-only submission**, with values retained in the
mounted form during a connection failure and submission visibly disabled offline.
It does not acquire the separate root branch's durable browser draft/outbox work
in this patch. Browser restart durability remains a parity/release follow-up.

## Parity gate

The mobile app does **not** yet have all web functionality. Current native routes
include daily-log creation/read, RFI/submittal creation/read, RailBot, cameras and
team reads. Several More modules open the website; this is not native parity.
Audit each action (read/create/edit/respond/upload/export/admin), not just routes.
Track missing functionality and device acceptance in a machine-readable matrix,
and block a claim of full parity while any required capability is missing or
unverified. Include Caleb's concerns when supplied. Do not send an external-beta
readiness email based solely on a successful internal TestFlight build.

## Future tasks

Read AGENTS.md, docs/WEB_MOBILE_CHANGE_POLICY.md, this plan and the latest release
handoff. Web/backend source is .mobile-recovery/live-backend; native/shared source
is .mobile-recovery/candidate. Root contains unrelated work in progress. Preserve
those changes. Policy commits currently exist locally on all three branches;
canonical-branch integration and hosted enforcement remain outstanding.
