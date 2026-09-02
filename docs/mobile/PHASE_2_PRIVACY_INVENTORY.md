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

## Expo PDF export follow-up — isolated visual-parity branch

The current Expo client uses user-scoped SQLite and app-owned files, not the
Capacitor IndexedDB locations described in the historical Phase 2 table above.
The following addition is implemented locally and is not yet in internal build
300003 or a store submission:

- `expo-sharing` provides **outgoing** RFI/Submittal PDF sharing only. No incoming
  share extension, app group, broad photo-library permission, analytics, or
  crash-reporting integration is configured by this addition.
- The authenticated mobile API receives selected project/record IDs, checks live
  membership and RLS, and renders a report containing project/record text and
  relevant participant names. The response is private/no-store and bounded to
  2 MiB; it is not placed in a public cache or stored as a server artifact.
- Native files use generated filenames in app Documents under
  `railcommand/<authenticated-user-id>/exports`. Neither server filenames nor
  supplied paths control the local location. Account/project changes before
  sharing cancel the operation.
- The user chooses the destination in the OS share sheet. A receiver can retain
  a copy; RailCommand sign-out cannot revoke a copy deliberately shared outside
  the app. No recipient or public upload is chosen automatically.
- Normal share completion/cancellation/error removes the temporary local file;
  safe sign-out removes the user's entire app-owned directory. If the process
  terminates before cleanup, its private PDF can remain until sign-out. Android
  receiver read timing and process-death cleanup require device verification.
- Export is online-only and never silently queued. Existing filters and device
  drafts are preserved on offline, auth, download, storage and share errors.

Before beta/store distribution, reconcile this outgoing-file use and the exact
autolinked dependency's privacy manifest with the current store disclosures.
This note is an implementation inventory, not a claim of legal or store approval.

### Native record detail follow-up — local, not released

Previously opened RFI/Submittal detail text, participant display names, response
text, review notes, milestone labels and attachment metadata are cached in the
existing user/build-profile SQLite database (50-record/30-day bounds, 2 MiB per
record). Explicit serializers exclude transport URLs, access tokens, emails and
unrequested profile fields. Sign-out removes the user database with other private
device data. The cache is not an authorization boundary; online refresh and
attachment opening revalidate membership and caller RLS access.

Attachment previews are online-only and use short-lived, scope-checked Storage
links in component memory, with `expo-image` caching set to `none`. No attachment
blob or signed URL is added to the text cache. Native image-cache behavior still
requires installed-device verification. Other files open only after the user
confirms browser handoff; browser downloads/history are outside RailCommand's
sign-out cleanup and this is disclosed before handoff. No new telemetry or third-
party analytics processor was introduced. Reconcile these additions with final
store privacy disclosures before any beta/release.

### Native creation draft follow-up — local, not released

RFI/Submittal form input (title, question/description, assignee ID, priority,
specification section, due date and milestone ID) is saved in user/build-profile
SQLite, partitioned by project and record kind. Client UUID and optional server
creation receipt support safe retries. Drafts have no automatic expiry and are
included in sign-out unsynced-work inspection and full user-database cleanup.
Project reference caches contain only IDs/display names and expire after seven
days; no tokens, emails, signed URLs or attachment bytes enter this store.

Only explicit online creation sends the text to the configured backend using
the user's bearer session. These forms never automatically enqueue or submit
on reconnection. No new telemetry, email processor or native permission was
added. File/photo creation is not implemented for these forms. Device-level
storage failure, background/sign-out races and lifecycle cleanup are still
acceptance items; reconcile the new text retention with final disclosures.
