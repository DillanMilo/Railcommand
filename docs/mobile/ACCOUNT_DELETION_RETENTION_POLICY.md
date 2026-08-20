# Mobile account deletion and record-retention policy

Status: approved by accountable business owner
Last updated: 2026-08-20

## Scope

This policy defines the version-one product behavior needed for Apple and Google
submission. It separates a person's RailCommand login and personal data from
construction records owned by a contracting organization. It is an operational
product decision, not legal advice; customer contracts and applicable law take
precedence when they require longer or shorter retention.

## User-visible deletion flow

1. A signed-in user can start account deletion in **Profile > Account > Delete
   account** without contacting support.
2. The user must reauthenticate and see a plain-language summary of what will be
   deleted, retained, transferred, or anonymized.
3. The app identifies unsynchronized drafts and outbox operations. The user must
   synchronize them, reopen them, cancel deletion, or explicitly discard them
   through the existing protected discard confirmation. Nothing is silently lost.
4. A sole organization owner must transfer ownership to an eligible member or
   explicitly request organization closure before deletion can proceed.
5. Submission immediately disables new sessions and starts a 30-day recovery
   period. The user can cancel during that period after reauthentication.
6. At the end of 30 days, RailCommand deletes the authentication identity,
   personal profile fields, notification tokens, active sessions, and that
   user's private device cache at the next authenticated cleanup opportunity.
7. RailCommand confirms completion through the user's verified email address.

Google Play receives a public deletion-request page on `railcommand.io` that can
start the same authenticated flow or provide an identity-verification route when
the user cannot sign in.

## Organizational construction records

- Project records, daily logs, RFIs, safety records, QC/QA records, schedules,
  photos, signatures, and audit history created for a customer organization are
  not automatically destroyed when one user deletes their login.
- Those records remain controlled by the contracting organization and are
  retained according to its contract, configured retention schedule, legal hold,
  and applicable construction-record obligations.
- Deleted-user attribution is replaced with a stable non-login label such as
  **Former user** where identity is not legally or operationally required.
- Where attribution must be preserved for audit, safety, signature, or legal
  integrity, access credentials and unrelated profile data are deleted while the
  minimum required historical attribution is retained.
- Organization closure is a separate reviewed workflow that exports or transfers
  records, applies legal holds, and then deletes or anonymizes eligible data under
  the approved retention schedule.

## Offline classification and failure behavior

Account deletion is **offline draft/queue** until it reaches the authenticated
server. The device preserves the request intent and all entered work, clearly
shows that connectivity is required to submit deletion, and never claims the
account is deleted while offline.

- The deletion request has a client UUID and idempotency key.
- Submission revalidates authentication, organization ownership, membership, and
  queued-work state on the server.
- A server version or `updated_at` baseline detects changes made while the device
  was offline; ownership or retention conflicts stop for review.
- Sign-out cleanup remains user-scoped. Private data never enters public Cache
  Storage or global `localStorage`.
- Repeated delivery returns the original deletion request instead of creating
  duplicates.
- Storage-full, restart, token-expiry, and reconnect cases retain a visible,
  recoverable state.

## Required implementation evidence before submission

- Automated tests for reauthentication, idempotency, sole-owner blocking,
  retention classification, cancellation, and the 30-day finalization job.
- Physical iOS and Android tests covering offline initiation, reconnect,
  unfinished drafts/outbox work, protected sign-out, restart, and shared-device
  user isolation.
- A published privacy-policy update and public Google deletion-request URL.
- An auditable deletion record containing request/result identifiers and timing,
  but no deleted credentials or unnecessary personal data.

## Approval

- Accountable business owner: Dillan Milosevich
- Approval date: 2026-08-20
- Approval record: explicit approval provided in the RailCommand Phase 0 task
- Legal review: required before store submission if customer contracts or
  applicable retention obligations differ from this policy
