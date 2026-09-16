# Mobile queued logs and RailBot Back incident

User reports two queued logs and a crash leaving RailBot; requests a new icon.

Offline classifications: daily logs remain offline draft/queue, with stable IDs and
server authorization on retry. RailBot retains offline text/audio drafts; execution
is online-only. The icon is offline-capable bundled UI. No queue purge, automatic
merge, record overwrite, or database migration is part of this fix.

Findings:
- Production daily-log sync calls return HTTP 400. Live read-only schema inspection
  confirms UNIQUE(project_id, log_date). The user's September 16 Tester log remains
  present. Exact pending item error/date and desired multiple-log behavior have been
  requested; duplicate-date rejection is a hypothesis until confirmed on-device.
- Expo useAudioRecorder releases its shared object in its own earlier cleanup.
  RailBot's later cleanup read recorder.uri and called stop(), causing access to a
  released object even when dictation was never used. Removed native-object access
  after unmount; Expo's native sharedObjectWillRelease stops active recording. The
  draft URI is persisted before recording starts. Async preparation is checked again
  after awaits, and failed audio-mode resets are caught.
- Replaced iOS robotic.vacuum with a bundled robot mark shared by the floating
  RailBot button and More menu.
- Server duplicate-key errors now return sanitized HTTP 409 conflicts. A known
  project/date collision explains the existing-log rule and explicitly says queued
  input/photos remain untouched. Idempotent retries still require the exact receipt.

Validation: 223 mobile tests including actual screen cleanup-order regression;
mobile TypeScript; iPhone Hermes export; 27 focused server sync tests; production
backend TypeScript and build passed. Physical phone Back/dictation/restart checks
remain required after the new TestFlight update. Existing pending logs are untouched.

Release progress:
- Native source `13c2fa8`; EAS build 300008 `f4a86ae9-50fd-4543-b883-c7753ac24895` is building.
- Backend source `117e376`; staged deployment `dpl_EEtfNpANoeoMTwCzcSTVhSW1SpmS`
  passed the Vercel build and unauthenticated/invalid-signature/non-pilot no-store
  endpoint checks. Promotion requested, rollback `dpl_ECZ7fmPh16iKKCmsU9YJ3oNrPQdh`.
- Fresh Apple check: internal group still only dillanxx@gmail.com, installed 300007.
- Supabase read-only query confirms original Tester September 16 log
  `a8871e0b-cf2c-4bf9-847b-6010efccebf2` remains. No submitted phone payloads read,
  records mutated, queue discarded, or uniqueness rule changed.

- Backend promotion completed; live unauthorized/invalid-signature/non-pilot checks
  passed with no-store responses. Duplicate-date confirmation from phone still needed.
- Build 300008 finished and passed deep strict Apple signature, production entitlements
  (debug disabled), bundle/version, microphone purpose, privacy AudioData and live
  profile checks. IPA SHA256
  `3240b6a1ac763ee5c28ae2f70a1fff69ef0c09497605e9bbf0a57a48bed71d2d`.
- Apple upload started for the exact EAS build; internal assignment remains pending
  processing. No storage schema/version changes or purge operations included.

- Apple accepted submission `e597d168-b9e5-4017-8f3d-6ecf2f7d3a93`.
  Build 300008 visibly Processing at 5:08 PM CDT. Release is internal only.
