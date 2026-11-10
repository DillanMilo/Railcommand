# Phase1 local iPhone acceptance — 4 November 2026

The remaining core iPhone checks passed against the persistent local backend.
This supersedes the device-blocked end state in
[the November 3 readiness record](TCO_PHASE1_READINESS_20261103.md).
No hosted database, production app, deployment, TestFlight upload, push or merge
was used. This is local functional acceptance for the web/iPhone pilot, not
production rollout approval or independent peer review.

## Tested build and scope

- Branch: `codex/tco-inventory-audit-phase-1`; starting HEAD
  `77851a77668719bb0d941321e3f8b8edaf887d78`.
- Installed separate app: `io.railcommand.app.phase1`, build `610004`, bundled
  application source `fd99183299160f8774ea2fbf1c62ccf03db5da17`.
- Physical iPhone 17 Pro Max, iOS 27.0, controlled through Device Hub.
- Existing synthetic local identities and project `QA1029 ACCESS - LOCAL TEST ONLY`.
  All ties, contracts, commitments and requests below are test fixtures, with no
  real stock or spending.
- Existing local Docker backend and LAN HTTPS proxy; trusted local certificate.
  No reset, reseed, schema migration, install, uninstall or production app launch
  was necessary today.

## Observed results

| Check | Result and evidence |
| --- | --- |
| Supply Chain threshold | Request #9 began at `awaiting_supply_chain`, version 3, with stock 100. The iPhone displayed the assigned Supply Chain action. Tapping it produced `posted`, version 4, and stock 99. The real device POST returned 200 at 18:21:17 UTC. |
| Contract-year spend | The phone showed the July 15 anniversary period, external approved baseline 45,000, prior tracked commitment 6,000 and proposed request 45,000: total USD 96,000. A distinct Supply Chain actor was required after PM approval before stock moved. Exactly-50,000 and cent boundaries remain covered by the previously passed real database suite; they were not separately recreated on the phone today. |
| Likely split warning | The phone displayed “Likely split purchases: review linked distinct source evidence.” The two distinct subthreshold tracked sources were 6,000 and 45,000, totaling 51,000 on the same contract. The UI explains that splitting is prohibited and that a flag calls for review rather than establishing fraud. |
| Carrying cost | The phone showed active policy 5% annually and USD 50,000 threshold. For the new lot, opening acquisition value 10,000 and 366 elapsed days produced 501.37 before release: `10000 × .05 × 366 / 365`. After both test releases, web showed 491.34 for the remaining 98 ties: `9800 × .05 × 366 / 365`. Storage remains separate. |
| Foreman access | Operational stock, request input and trail were available. Finance and organization settings were absent; the real API returned no finance object. The foreman could submit but could not verify or authorize their own request. |
| Inventory lead and PM | Recovered request #10 was submitted by the foreman, verified through the physical phone as the distinct inventory lead, then posted through the phone as the assigned distinct PM. States advanced `submitted` v1 → `verified` v2 → `posted` v3. Stock remained 99 until authorization, then became 98. |
| Previously committed source | Request #10 reused the already committed source: incremental exposure was zero, annual total stayed 96,000 and tracked commitments stayed 51,000. It still required lead and PM review; it did not create a duplicate commitment or require another spending sign-off for zero new spending. |
| Admin organization controls | The phone displayed admin-only project cost-view access, reviewed policy version, editable annual rate `.05`, threshold `50000` and currency `USD`. No policy or access grant was changed today. Prior database tests cover save, stale version, grant/revoke and denied-role behavior. |
| Engineer restrictions | The engineer whose cost grant is revoked saw operational history, with no finance, cost editor or organization controls. Fresh API reads confirmed `finance: false`, `canManage: false`. |
| Append-only trail | The phone displayed the new Supply Chain event after the previous foreman/lead/PM events. Backend readback retained those earlier events and recorded the fourth distinct actor. Request #10 separately retained all three physical-phone steps and their financial snapshots. |
| Web/mobile refresh | The real local browser displayed requests #9 and #10 posted, their distinct actors and timestamps, stock 98, unchanged annual total and the continuing split warning. This verifies phone → server → web readback. The server-prepared request #9 and its rules were also refreshed and acted on by the phone. |

## Offline acceptance

Classification remains **offline draft/queue for operational input**, with
**offline read-only stock**. Submission, approvals, finance and settings require
an online authenticated server decision. Inventory drafts do not automatically
release stock when a connection returns.

1. Selected the synthetic lot as foreman and entered quantity 1, location
   `QA Nov4  TEST`, and a synthetic reason.
2. Enabled Airplane Mode; Wi-Fi and cellular disconnected. Reopened only Phase1
   with `devicectl --terminate-existing`, without deleting its container.
3. The app showed “Offline · device drafts,” cached quantities marked read-only,
   disabled refresh/submission and the restored fields.
4. Added ` stock` to the reason while offline. Restarted Phase1 again while still
   disconnected; quantity, selected lot, location and the edited reason survived.
5. Restored the prior Wi-Fi/cellular connection and submitted the saved draft.
   Exactly one request (#10) was created, retaining the entered values. Draft
   input cleared only after server confirmation. Its later verification and
   authorization did not duplicate the request or source commitment.

Device Hub rapid keyboard injection occasionally delivered only part of a long
input; the visible fields were checked and completed using short input chunks.
The saved/reopened/submitted values matched the visible completed draft. This
does not establish a normal touchscreen typing defect, nor separately accept all
keyboard/dictation methods. An empty numeric field also displayed `NaN` after
keyboard navigation during automation; no such request was submitted. Track
ordinary keyboard/numeric-input polish during the invited pilot rather than
claiming every input method was tested.

No sign-out, draft discard, queue purge, real-user login or unrelated phone app
was used. Keyboard capture was turned off and the phone left online in the
synthetic foreman Inventory view.

## Data preservation

Private evidence and full before/after Phase1 container copies are saved under
the persistent runtime's `private/backups/20261104-checks/` (not in Git).

- Today's full local database dump restored successfully to a separate local
  verification database. The initial restore with the non-superuser role failed
  on schema ownership; a fresh verification database restored successfully using
  the existing local administrative role. The running application database was
  never restored or overwritten.
- Compared all 66 public tables: 405 existing rows matched byte-equivalent JSON
  values. The only two existing rows changed were the intended synthetic lot
  `821f5b3c-1eed-4afb-823d-9ed18149a444` and request
  `db36b0ee-869c-43cf-bbab-f5f1d549488d`. Added rows are the expected synthetic
  request, movement, commitment, receipt and approval records.
- All ten current Phase1 SQLite databases passed integrity checks. Every
  pre-existing draft, outbox, photo and sync-history table remained identical.
  Only expected synthetic operational cache refreshes changed prior cache rows;
  new databases belong to the test identities used today. No drafts or queued
  operations remain pending at the end.
- Complete before/after metadata for all four RailCommand app installations is
  identical: production `300015`, development `600001`, staging `300004`, and
  separate Phase1 `610004`. Other app containers were not opened or modified.
- Original dirty checkout branch, HEAD, main ref, porcelain status and binary
  diff hash all match today's starting baseline.
- Temporary loopback QA sign-in helper was stopped. Persistent local testing
  services remain running. Docker can be quit safely when testing is finished;
  the persistent volumes retain the test data. Restart with the existing
  `Start Phase1 Local.command` before another local session. The local test
  certificate expires November 10 and requires renewal/trust setup if testing
  continues beyond that date.

## Impact record and remaining release work

- Web/native/shared API/database: existing code exercised together; no runtime
  code or database schema changes today. Only acceptance documentation changes.
- Installed-client compatibility and populated-queue upgrade acceptance: prior
  compatibility/database tests remain valid. Today's device had no pre-existing
  queued work; this is not a populated-queue upgrade pass.
- Builds/tests: the November 3 production build, root/native TypeScript and
  focused suites remain the source verification baseline. They were not rerun
  for this documentation-only handoff. Physical results above are new evidence.
- Android/iPad and broader input/device coverage remain explicit follow-ups
  outside the current web/iPhone pilot. Phase 3 retention, exports and flag
  investigation ownership remain deferred.
- No new Phase 2/3 work is required to prove these basics. Before a live invited
  pilot, finish actual production migration/ACL/rollback preflight and release
  review, then obtain explicit rollout approval and deliver/verify the proper
  signed tester build. Independent peer review has not been performed.
- Follow the existing [staged rollout runbook](TCO_PHASE1_ROLLOUT_20261103.md):
  prepare finance bridge first, compatible web/API next, then transactional
  inventory migrations. Do not deploy this local runtime or use a blanket
  database restore as rollback.
- Pilot setup still needs Mark's introduction to Spike Sambol, the invited org/
  project and named lead, PM and Supply Chain assignments, plus accepted opening
  stock and contract commitments. Keep invite-link access.

The implemented core is ready for continued local web/iPhone beta testing.
Production release remains a separate, unperformed step.
