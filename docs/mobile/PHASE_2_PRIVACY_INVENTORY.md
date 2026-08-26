# Phase 2 mobile privacy inventory

Status: **reviewed for the Phase 2 foundation**. No third-party crash/error reporting
SDK has been selected or initialized.

## Data present on a mobile device

| Data | Purpose | Local location | Network behavior | Removal |
| --- | --- | --- | --- | --- |
| Supabase access/refresh session | Authentication and session restoration | iOS Keychain or Android Keystore-backed secure storage, partitioned by environment | Sent only to the approved Supabase project and mobile API over HTTPS | Cleared on safe sign-out; environment partition prevents cross-flavor restore |
| User and project identifiers | Partition cache and authorize operations | Authenticated-user IndexedDB | Sent to the mobile API; membership/RLS revalidated | Current user's database removed on confirmed sign-out |
| Cached project and daily-log summaries | Offline read-only use | Authenticated-user IndexedDB | Refreshed from the mobile API | Expiry policy or confirmed sign-out |
| Daily-log draft text | Preserve field work offline | User/project IndexedDB draft | Sent only when queued/synchronized | Removed after atomic draft-to-outbox move or confirmed discard |
| Outbox UUID, idempotency key, retry state | Safe reconnect delivery | User-scoped IndexedDB outbox | Sent to the mobile API | Removed after confirmed synchronization or explicit discard |
| Photos | Offline daily-log attachment | Compressed/lossless Blob in user-scoped IndexedDB | Uploaded through short-lived, revalidated authorization | Blob removed atomically after sync or explicit discard |
| Current location | Optional field context | Draft/outbox only after the user taps **Attach location** | Sent as part of the queued daily log | Same lifecycle as its draft/outbox; no background tracking |
| Connectivity state | Explain offline/pending UI and trigger foreground sync | Memory only | Not uploaded | Ends with process |
| Development error message | Local debugging without field data | Console only in development | Not uploaded | Ends with local log lifecycle |

## Permission posture

- Camera, photo-library, and location are requested at the point of use.
- Permission denial or device unavailability returns a clear message and preserves all
  draft input.
- Location captures one current position on request and can be removed from the draft.
  There is no background location, location history, continuous watch, advertising
  identifier, contacts, microphone, or analytics collection in this phase.
- Sharing invokes the operating-system share sheet for a public project link. If the
  sheet is unavailable or cancelled, the app leaves the workflow unchanged.

## Crash/error reporting decision gate

Phase 2 intentionally uses no external crash reporter. Before selecting one, the team
must approve the vendor, hosting/transfer geography, subprocessors, retention,
deletion controls, access roles, sampling, cost, and applicable App Store/Google Play
privacy disclosures.

Any future reporter must enforce structured allowlisting. It must never transmit:

- access/refresh tokens, cookies, authorization headers, API keys, or signed URLs;
- email addresses, names, project/customer names, draft text, safety notes, or record
  bodies;
- raw photo bytes, photo filenames/paths, GPS coordinates, or IndexedDB contents;
- request/response bodies from authenticated Supabase or mobile API calls.

Permitted diagnostic fields should be limited to app version/build, environment,
platform/OS version, device class, safe error code, route/workflow identifier, and a
random installation/session diagnostic ID that is not an authorization identity.

## Store disclosure follow-up

Phase 4 reconciles this inventory in `APPLE_STORE_SUBMISSION.md` and
`GOOGLE_PLAY_SUBMISSION.md`. The v1 client adds no crash-reporting, analytics,
advertising, microphone, contacts, or background-location SDK or permission. It adds
an Apple privacy manifest containing the approved linked/app-functionality data types
and required-reason APIs from the exact Expo dependency set. Any new SDK or device
permission reopens this review before TestFlight, Play testing, or submission.
