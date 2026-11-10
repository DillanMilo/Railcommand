# Existing history investigation — 10 November 2026

**Local investigation complete; INV-REL-04 remains open for a history-preserving
resolution. No live connection, live data/access change, merge, push or deployment
was used for this investigation. Inventory is not yet available in the regular app.**

## What the 21 entries mean

All 21 history entries refer to one absent project. Its original creation entry
records a project name; that name, original IDs and complete records remain in the
private evidence, outside Git. The entries date from 4–19 March 2026 UTC, before the
Inventory work. They cover one project creation, six daily-log events, five punch
item events, four RFI events, three submittal events and two milestone events.

These events reference ten distinct entities, including the missing project.
Only one of those entities, a milestone, remains in the snapshot. None points to a
record reassigned to a different existing project. All 21 actor fields are null;
that does not establish who originally performed the actions or why attribution is
absent. No project membership remains for this project.

Several closely spaced creation events have different descriptions. Current source
contains both application-side activity logging and database activity triggers,
which is a plausible explanation for paired creation messages, not proof of their
historical cause. Preserve both messages; do not deduplicate the audit history.
The project ID/name was not found in the checked-in supabase, docs, scripts, src,
apps or packages trees. Test-like wording alone does not establish disposable data.

## Wider local check

Checking all 124 declared foreign keys in the restored snapshot found the following
missing parents. A row can fail more than one relationship, so these counts must
not be summed as a count of distinct records.

| Records | Missing parent | Affected rows |
| --- | --- | ---: |
| Activity/history | Project | 21 |
| Attachments (metadata) | Project | 1 |
| Daily logs | Project | 48 |
| Entity numbering sequences | Project | 3 |
| Milestones | Project | 61 |
| Punch items | Project | 48 |
| RFIs | Project | 36 |
| Submittals | Project | 48 |
| Daily-log equipment | Daily log | 1 |
| Daily-log personnel | Daily log | 1 |
| Daily-log work items | Daily log | 1 |
| Punch-item assignments | User profile | 24 |

All missing-project references point to the same absent project. The three
missing daily-log parent references point to one of the absent logs represented
in the original 21 history entries. All missing assignee references point to one
absent profile, with no corresponding Auth account or project memberships in the
snapshot. Twelve of these punch items belong to one existing project; the other
twelve belong to the missing project. This therefore cannot be dismissed as only
inaccessible old history. One surviving milestone for the missing project also
contains nonzero budget fields; do not classify it as disposable test data.

The source manifest marks these foreign keys validated, but their saved rows do
not satisfy them. The archive and current source code cannot establish when or
how this happened, whether old imports/deletions bypassed checks, or whether the
source trigger state differed. Restored trigger state is not evidence of the
historical live trigger state. Do not assert the original cause or blame Inventory:
these inconsistencies exist in the saved pre-Inventory database.

## Preservation and recommended handling

- Preserve every original row, identifier, actor field, timestamp, access rule and
  attachment reference. Do not delete history, fabricate projects/profiles, change
  ownership or reassign entries to a current project to make validation pass.
- Keep INV-REL-04 open. Before a live rollout, obtain a separately reviewed decision
  on preserving the absent project's records and correcting the twelve current
  project assignments without guessing ownership. No repair is implemented here.
- Use the existing saved copy for any proposed repair rehearsal. Capture proposed
  changes and evidence explicitly before seeking permission for live changes.
- Do not broaden history access. Current application reads require project
  membership; saved history SELECT policy also requires membership. There is no
  membership for the missing project. Direct/operator access remains unchanged.
- RFQ wireframes have not been started. This report completes the requested local
  investigation; it does not authorize implementation of a history repair.

## Verification and private evidence

A new isolated PostgreSQL container restored the existing private archive, with no
network, published ports, existing volume or app/mail/Auth workers. The saved
archive checksum was verified before restore. Investigation queries ran in
read-only transactions with an eight-second statement timeout. No production
queries or second database download were needed.

All 83 original tables' row counts and original-column value hashes match the
saved snapshot after the investigation. Full metadata comparison passed for
original table/column access, policies, constraints, functions, extensions, roles
and role memberships. Effective default owner grants are normalized as in the
original recovery check. No customer accounts were signed in for testing.

Detailed evidence is saved with private permissions outside Git in
`~/Library/Application Support/RailCommand/Phase1Local/private/backup-setup/history-investigation-20261110/`.
The original database backup remains in its existing private backup folder.
The generated investigation container was removed after verification; the
persistent Phase1 backend and installed apps were not altered.

## Inventory readiness and platform impact

Inventory/TCO Phase 1 web, native and database changes are built in the local release
candidate. The earlier rehearsal applied all seven pending Inventory/preparation
files, adding 24 Inventory tables while retaining all 83 original tables and
original access definitions. That is evidence for an additive rollout, not a need
for a wholesale backend replacement. It is not a production rollout or a guarantee
that no release issue can occur.

The production backend and regular team app have not received Inventory. Existing
privilege review, the history resolution decision, independent release review and
final client acceptance remain open. The bundled native Inventory screens require
a signed team build. Do not invite field testers to use the ordinary app for
Inventory until the approved backend/web/mobile rollout and access checks complete.

This task changes documentation only: web/native screens, shared API/domain,
database definitions, installed-client contracts and user access are unchanged.
Offline classification for this investigation: **online-only administrative work**,
performed entirely against a saved local copy; no app offline action is introduced.
Existing Inventory offline read-only stock and saved request drafts remain as
previously documented. No drafts, queues, client IDs or retry behavior change.
Documentation receives content/link review and `git diff --check`; no application
rebuild or new physical-device acceptance is claimed.

See [backup and rehearsal results](INVENTORY_BACKUP_RESULT_20261110.md) and
[release checklist](INVENTORY_BETA_RELEASE_20261110.md).
