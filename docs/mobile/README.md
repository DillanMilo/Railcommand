# RailCommand mobile program

The mobile program is intentionally isolated from the production RailCommand
application and its users.

Start here:

- [Phase 0 decision gate](./PHASE_0_DECISION_GATE.md)
- [Production safety boundary](./PRODUCTION_SAFETY.md)
- [Account deletion and retention policy](./ACCOUNT_DELETION_RETENTION_POLICY.md)
- [Phase 0 evidence](./PHASE_0_EVIDENCE.md)
- [Phase 1 architecture spike](./PHASE_1_ARCHITECTURE_SPIKE.md)
- [Phase 2 mobile foundation](./PHASE_2_FOUNDATION.md)
- [Phase 2 privacy inventory](./PHASE_2_PRIVACY_INVENTORY.md)
- [Phase 2 device acceptance](./PHASE_2_DEVICE_ACCEPTANCE.md)
- [Phase 3 Expo v1 field workflows](./PHASE_3_EXPO_V1.md)
- [Phase 4 store compliance](./PHASE_4_STORE_COMPLIANCE.md)
- [Apple submission answers](./APPLE_STORE_SUBMISSION.md)
- [Google Play submission answers](./GOOGLE_PLAY_SUBMISSION.md)
- [Store metadata](./STORE_METADATA.md)
- [Reviewer notes](./REVIEWER_NOTES.md)
- [Store asset plan](./STORE_ASSET_PLAN.md)

No native mobile project may connect to the production backend during Phase 0
or the architecture spike. Phase 1 starts only after the blocking items in both
documents are approved.

## Offline classification

RailCommand mobile version 1 is **offline-capable with scoped functionality**. The
Phase 3 production client is Expo/React Native; the Phase 1–2 Capacitor client is kept
under `apps/mobile-capacitor-spike` as an architecture reference only.

- The bundled shell is available offline.
- Previously synchronized project, team-reference, and recent daily-log data is
  offline read-only.
- New daily logs, drafts, location, and photos are offline draft/queue workflows in a
  user-partitioned native SQLite database and app-owned document storage.
- Existing-record edits and deferred modules are initially online-only.

The mobile program must not be described as full offline project management.
