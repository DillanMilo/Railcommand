# Apple App Store submission answers

Use this as the reviewed source of truth when completing App Store Connect. Recheck it
against the archived release binary before pressing **Submit for Review**.

## App record

- Name: **RailCommand**
- Subtitle: **Offline rail field logs**
- Primary category: **Business**
- Secondary category: **Productivity**
- Bundle ID: `io.railcommand.app`
- Availability: United States only
- Price: Free; no in-app purchases or subscriptions
- Support URL: `https://railcommand.io/support`
- Marketing URL: `https://railcommand.io/`
- Privacy URL: `https://railcommand.io/privacy`
- Account deletion URL: `https://railcommand.io/account-deletion`
- Copyright: `© 2026 Creative Currents. All rights reserved.`
- Age rating proposal: **4+**, subject to the current App Store questionnaire
- Release: manual release after approval

## App Privacy answers

All listed data is linked to the user's organization account, is used only for App
Functionality, and is **not** used for tracking.

| Apple data type | Actual use |
| --- | --- |
| Name | Team reference and record attribution |
| Email address | Sign-in, invitations, team reference, recovery/support |
| User ID | Authentication, authorization, user-partitioned cache/outbox |
| Device ID | Expo notification-token/device registration |
| Photos or videos | User-selected daily-log field attachments |
| Precise location | Optional one-time daily-log geotag |
| Coarse location | Optional one-time geotag when the user grants approximate location only |
| Other user content | Daily-log weather, summary, safety notes, and related field entries |

Not collected by the native v1 client: contacts, health/fitness, financial/payment
data, browsing/search history, advertising data, microphone/audio, or background
location, or diagnostics sent to a third-party crash reporter. RailCommand does not
sell data or perform cross-app tracking.

The bundled `PrivacyInfo.xcprivacy` declares no tracking, the data above, and required
reason APIs aggregated from the exact Expo SDK dependency set. Verify the archived app
and TestFlight privacy report before submission. Apple reference:
<https://developer.apple.com/app-store/app-privacy-details/>.

## Sign-in and encryption review position

App Review Guideline 4.8's business/enterprise existing-account exception applies.
RailCommand is a B2B field client that requires an account issued or invited by a
contracting organization. It has no Facebook/Google/social login, consumer signup, or
anonymous paid content. Reviewer notes must state this directly.

`ITSAppUsesNonExemptEncryption` is `false`. RailCommand does not implement proprietary
cryptography; it relies on exempt standard HTTPS/TLS and Apple platform security APIs.
Reassess if VPN, custom cryptography, end-to-end encrypted messaging, or another crypto
feature is added. Apple reference:
<https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/>.

## Review access

Provide a permanent synthetic reviewer account in App Review Information. Keep the
email/password only in App Store Connect and the gitignored private runbook. The
account must have at least one synthetic project and permission to create daily logs. The
review backend and all link-association endpoints must remain available throughout
review. Never provide a customer account.
