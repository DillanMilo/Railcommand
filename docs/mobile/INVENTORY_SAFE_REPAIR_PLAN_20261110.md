# Local preservation and release preparation — 10 November 2026

Scope: prepare and rehearse only. No hosted database reads/writes, merge, push, deployment,
TestFlight upload, new invitations or installation over existing apps. Use the
saved database archive and existing local signing materials, with no cloud build.
A local export may use the existing Apple account to obtain its signing profile;
its destination is export, never upload, with remote build-number management off.

## Smallest safe correction

The owner's recollection that the missing project may be from setup is useful
context, not evidence of its organization, ownership or original permissions.
Keep all missing-project records and history in place; create no fake project or
user and grant no access. Do not weaken/recreate foreign keys to hide old errors.
A clean historical-reference result cannot be claimed without authoritative data.

The real-copy rehearsal established that punch-item assignees cannot be NULL.
The initial unassignment attempt rolled back completely. Do not relax that
constraint or add a placeholder account to make a cleanup pass.

Prepare a manual, local-only correction template requiring an unchanged snapshot
and explicit owner-confirmed replacements. Each replacement must be a real profile
and a current member of the item's existing project. Record the complete original
and resulting rows in an operator-only append-only journal. Retain project, item
IDs, status, contents and access. Missing projects or unknown replacement owners
stop the correction; an empty approval map must fail before any mutation. No
customer-row repair is currently authorized by an actual owner mapping.

Leave the missing project's history and child records in place, listed as existing
exceptions. Restoring those links needs authoritative old project data, including
organization and ownership; the creation message and a possible setup origin are
insufficient. Do not ship the operator template as an automatic app migration.

## Acceptance

- The original archive remains unchanged. All 83 original tables match before work.
- All history entries, including the 21 flagged events, are byte/value equivalent.
- Only authorized snapshot-matching rows with absent profiles can be corrected;
  unknown/new/changed rows stop the transaction. No guessed owner, new membership,
  role change, fake parent, data deletion or trigger suppression in the correction.
- Each changed row has immutable before/after evidence; reruns do nothing, concurrent
  or changed input fails, and an error rolls back journal plus corrections together. Successful writes are verified using
  synthetic records; the real copy must remain untouched when no owner-confirmed map exists.
- Existing access, policies, functions and contracts remain unchanged. Journal is
  outside public API schemas, has RLS and no application-role access. Check journal
  mutation denial and new grants with disposable synthetic data.
- Rehearse on the saved local copy and compare all original tables/access afterward,
  requiring all 83 original tables to remain unchanged without approved mappings.
- Review inherited privileged functions narrowly; prove anonymous/nonmember denial
  and supported member behavior locally without customer-account sign-in or broad
  revokes. Record residual findings rather than claiming them fixed.
- Run web build, TypeScript, Inventory/backend/native tests and grant gates; build
  a local iOS release archive. Record signing/export and physical-device gaps honestly.

## Platform and offline assessment

Web/native: no UI changes planned; preserve the existing required-assignee contract.
Shared API/domain: unchanged. Database: manual repair rehearsal plus a deliberate
restriction on the new, unshipped Inventory request-number sequence. No migration
replay against the persistent local backend. Installed clients retain existing payloads.
Offline classification: **online-only administrative correction** on a disconnected
local copy; no user input, drafts or queues are read, cleared or rewritten. Existing
Inventory stock caching and durable request drafts remain unchanged. Permissions
must still be checked by the server when any old client later synchronizes.

Final handoff must separate prepared source/builds from rollout, and retain the
missing-project decision and physical acceptance as explicit release conditions.
