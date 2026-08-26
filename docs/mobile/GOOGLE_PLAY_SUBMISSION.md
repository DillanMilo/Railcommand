# Google Play submission answers

Use this as the reviewed source of truth for Play Console. Reconcile it with the final
merged release manifest and current SDK inventory before production submission.

## Store and policy declarations

- App name: **RailCommand**
- Category: **Business**
- United States distribution only
- App: free; no in-app products or subscriptions
- Ads: **No**
- Target audience: **18 and over**; not designed for children
- News, health, financial, dating, gambling, government, and COVID features: **No**
- User-generated content: organization-private construction field entries/photos;
  users cannot publish them to a public community
- App access: all core screens require the permanent synthetic reviewer credentials
- Privacy policy: `https://railcommand.io/privacy`
- Account deletion: `https://railcommand.io/account-deletion`
- Support: `https://railcommand.io/support`

## Data Safety answers

Data is encrypted in transit. Users can request account deletion. RailCommand does not
sell data, use it for advertising, or share it for third-party advertising/analytics.
Service providers process data only to deliver app functionality.

| Google category | Collected | Purpose |
| --- | --- | --- |
| Personal info — name, email, user IDs | Yes | Account management, app functionality |
| Photos and videos | Optional | Daily-log attachment |
| Location — approximate and precise | Optional | User-requested daily-log geotag |
| App activity — other user-generated content | Yes | Daily logs, safety notes, field records |
| Device or other IDs | Optional | Push-token/device registration |
| Crash logs, diagnostics, advertising ID | No | No reporter or advertising SDK in v1 |

Supabase, Resend, Expo notification delivery, Apple, and Google are service providers,
not data-sale or advertising recipients. Reopen this answer if any SDK is added.
Google reference: <https://support.google.com/googleplay/android-developer/answer/10787469>.

## Permissions declaration

- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`: one foreground position after the
  user taps **Attach location**; optional and removable from the draft.
- Camera/photo access: capture or select a user-requested field attachment. Denial
  preserves the draft. Legacy media permissions, if present for older supported
  Android versions, are limited by `maxSdkVersion`.
- Notifications: optional field notifications after education and consent.
- Internet/vibration: authenticated synchronization and haptic feedback.
- Explicitly absent/blocked: background location, microphone, contacts, call logs,
  SMS, all-files access, advertising ID, exact alarm, accessibility service.

No background-location declaration or permission video is required. Confirm this from
the final AAB's merged manifest in Play Console before answering.

## Content rating proposal

Complete the IARC questionnaire truthfully for a business productivity app. Proposed
answers are no violence, sexual content, profanity, controlled substances, gambling,
or public social interaction. Private organization field text/photos do not constitute
a public user-generated-content network. Expected rating: **Everyone**, subject to the
questionnaire-generated result.
