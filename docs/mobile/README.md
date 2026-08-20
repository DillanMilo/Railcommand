# RailCommand mobile program

The mobile program is intentionally isolated from the production RailCommand
application and its users.

Start here:

- [Phase 0 decision gate](./PHASE_0_DECISION_GATE.md)
- [Production safety boundary](./PRODUCTION_SAFETY.md)
- [Account deletion and retention policy](./ACCOUNT_DELETION_RETENTION_POLICY.md)

No native mobile project may connect to the production backend during Phase 0
or the architecture spike. Phase 1 starts only after the blocking items in both
documents are approved.

## Offline classification

RailCommand mobile version 1 is **offline-capable with scoped functionality**:

- The bundled shell is available offline.
- Previously synchronized project, team-reference, and recent daily-log data is
  offline read-only.
- New daily logs, drafts, location, and photos are offline-capable through the
  existing user-scoped draft and outbox design.
- Existing-record edits and deferred modules are initially online-only.

The mobile program must not be described as full offline project management.
