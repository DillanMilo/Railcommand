# Store reviewer notes and walkthrough

## Copy into reviewer notes

RailCommand is a B2B field application for authorized rail and construction teams.
There is no public signup, social login, advertising, in-app purchase, or consumer
subscription. Use the supplied synthetic organization account. It contains no customer
data and has at least one synthetic project.

After sign-in, select **Synthetic US Track Renewal**. The dashboard and cached records
are available. Open **Logs > New Daily Log**, enter a work summary, optionally attach
foreground location and a photo, then queue the log. If the device is offline, Sync
Center shows the daily log and photo as pending. Reconnect and tap **Synchronize Now**;
exactly one log and one copy of each photo move to synchronized history.

Existing records are read-only offline. Administration, billing, full document or
schedule editing, EarthCam administration, and RailBot voice are intentionally not
part of this mobile v1.

Account deletion is under **Account > Request account deletion**. It requires an
internet connection, current password, and zero unsynchronized device items. The
public deletion resource is `https://railcommand.io/account-deletion`. The account has
another synthetic organization administrator so the sole-admin protection will not
block review.

RailCommand qualifies for Apple Guideline 4.8's existing enterprise-account exception:
accounts are issued/invited by customer organizations, and the app offers no social
login or public account creation.

## Private values — never commit

Enter the reviewer email, password, support contact phone, recovery inbox owner, and
any review-only URL in `docs/mobile/private/RELEASE_RUNBOOK.md` and the store consoles.
The permanent account must not expire, require MFA, contain customer data, or be shared
with ordinary QA. Verify it immediately before submission and keep the staging/review
backend available until review completes.

## Three-minute reviewer video script

1. Show the app version/build and synthetic account sign-in (hide the password).
2. Show the synthetic project list, online badge, cached recent logs, and Sync Center at zero.
3. Enable airplane mode; create a daily log with text, optional location, and one photo.
4. Force-close/reopen; show the retained draft/outbox and one pending log plus one pending photo.
5. Reconnect; synchronize; show zero queued items and two synchronized history items.
6. Open Privacy, Support, and Account Deletion; show the offline block and local-work safeguard without submitting deletion.
7. End on Account with the build number visible. Do not reveal credentials, tokens, GPS coordinates, or real project/customer information.

Record from an authenticated synthetic session so the password is never captured. For
an iOS Simulator release candidate, run:

```sh
npm run record:store:reviewer-video -- \
  --device <booted-simulator-udid> \
  --duration 180
```

The recorder writes only to the gitignored `docs/mobile/private` directory and rejects
wrong orientation, sub-1080px output, unsupported codecs, and videos outside 45–240
seconds. A physical-iPhone recording may instead be copied into that private directory
and checked with `npm run verify:store:reviewer-video -- <video.mp4>`.

The automated check cannot detect sensitive content. Before sharing, watch the entire
video at normal speed and confirm there is no password, token, precise coordinate,
customer information, debug-only control, notification preview, or unrelated device UI.
