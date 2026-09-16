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
