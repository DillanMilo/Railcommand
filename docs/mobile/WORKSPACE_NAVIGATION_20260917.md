# Workspace navigation and report export — September 17, 2026

## User evidence and scope

After build 300010 became available, Dillan reports the app looks good and a newly
captured photo appears saved. This supports successful Workspace access; server
readback of that photo and report export on the phone remain unverified. Do not
claim all prior queued logs delivered or full mobile acceptance.

DFR detail already includes Export PDF; submittals, RFIs, punch lists and schedule
also use the shared PDF exporter. Schedule has project-history export. Native
Workspace forwards supported exports to the share sheet, capped at 20 MB. Weekly
Reports opens the web weekly-report workflow; its detail page does not currently
have the shared Export PDF button. Do not promise every report type has one.

## Change / platform impact

- Mobile: native More, search, module shortcuts and web-module deep links return to
  an existing Workspace screen using dismissTo; a fresh screen is created only
  when none exists. Parameter request IDs route repeated selections correctly.
- Shared web UI: a bounded internal navigation event uses Next router.push instead
  of another sign-in/bootstrap/document load. Native dirty state is checked by the
  retained web page before navigation. Offline and invalid destinations are denied.
- Field tools: select the same project before opening, then refresh in background
  rather than making navigation wait for the additional forced refresh.
- Existing 300010 clients ignore the additive ready capability. New native clients
  fall back to same-origin navigation if paired with an older web deployment.
- API/domain/database: no endpoints, migrations, auth checks, RLS or grants changed.
  No live record or stored file changes. No extra private response caching enabled.
- Account revision still remounts/destroys the Workspace on identity change; the
  existing isolated cookie store, cache policy and bounded export bridge remain.

Offline classification: **online-only** Workspace navigation. Retained input stays
in its existing mounted page; cancellation keeps it there. No navigation occurs
while disconnected. OS termination can still lose unsaved web forms. Native
**offline draft/queue** data and operation identities are unchanged.

## Validation and release

Tests cover the installed Expo stack router retaining a Workspace screen key,
updating the destination, and creating a first Workspace when absent. Web tests
cover local navigation, external/auth/traversal rejection, offline denial, dirty
cancel and explicit confirmed navigation. Broader auth/export/cache suites run too.
233 native tests and mobile TypeScript passed; 16 workspace navigation/auth/cache
tests passed. Backend production web build, TypeScript and focused ESLint passed.
Native focused lint has no errors (two pre-existing unused import warnings).
Candidate web compilation succeeded, but auto-discovery found unrelated duplicate
" 2" dependency type folders. A tracked-source snapshot with a filtered typeRoots
symlink directory passed production build and TypeScript using the same dependencies;
no source checkout dependency folders were removed. CI 35271038012 passed.

Web runtime commit 1e46401 was staged, checked through authorized Vercel preview
access, and promoted as dpl_5RfdY5kutDSpjCPkter7aWFhfPxn. Fresh railcommand.io
inspection confirms READY on that deployment. Four unauthenticated/forged-token
API checks and the opaque-Origin handoff denial passed with no-store both staged
and live. Rollback target: dpl_36LoCT8KqjExbxukXS7GbMBpLhvX. Initial direct staged
handoff check reached Vercel protection; authorized Vercel curl then verified the
actual app rejection. No real user records were written for verification.

Native commit cecbb02 finished building as 1.0.0 (300011), production build
 da0209f4-20e7-4c62-998e-a3832229d75e, auto-submission
7688001a-c020-4d1d-8dc0-bdd5cb99fb44. Last status: FINISHED / IN_QUEUE (upload pending).
Apple processing, internal assignment and physical acceptance are pending. Do not
start a duplicate build/submission merely because observation timed out.

Physical checks pending: repeated More -> Photos/Reports/Workspace switching;
unsaved form -> Field tools -> new Workspace destination -> cancel/confirm;
connection loss and recovery; account change; export/share and web photo readback.
This removes identifiable navigation overhead but is not a measured phone latency
improvement. Slow transitions inside the web menu may require separate profiling.

No external tester distribution or production record mutation is part of this work.
