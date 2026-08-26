# Private mobile release runbook template

Copy this file to `docs/mobile/private/RELEASE_RUNBOOK.md` before entering any
account identifiers. That directory is gitignored. Do not put credentials,
private keys, recovery codes, or passwords in either copy.

## Apple

- Legal organization/seller name:
- Account Holder name:
- Account Holder contact:
- Team ID:
- D-U-N-S number, if applicable:
- App Store Connect App Manager:
- App Store Connect Developer:
- Agreements status/date checked:
- Production App ID registration status:
- App Store Connect record status:
- Distribution decision (public/unlisted/custom):
- APNs credential owner and secure-store location:

## Google Play

- Legal developer name:
- Developer Account ID:
- Account type and creation date:
- Identity verification status:
- Production access status:
- 12-testers/14-days requirement applies:
- Package registration status:
- Play App Signing status:
- Upload-key owner and secure-store location:
- Firebase production credential owner and secure-store location:

## Domain and links

- `railcommand.io` registrar/account owner:
- DNS administrator:
- Apple association-file owner:
- Android association-file owner:
- Support URL:
- Privacy URL:
- Account-deletion URL:

## Staging safety evidence

- Staging Supabase project reference:
- Production Supabase project reference used only for rejection checks:
- Staging API origin:
- Production API origin used only for rejection checks:
- Staging Vercel project:
- Staging Firebase project:
- Synthetic QA account owner:
- Last A -> B -> A isolation test:

## Store review access and final release tests

- Permanent synthetic reviewer email (do not put password here):
- Reviewer password secret-manager reference:
- Reviewer organization/project names:
- Reviewer account expiry/MFA check:
- Reviewer backend availability owner:
- Reviewer verification command/date (`npm run verify:store:reviewer`):
- Reviewer walkthrough-video private URL:
- Password-recovery staging inbox owner:
- Password-recovery delivery/expiry/one-use test date:
- Physical iPhone deletion-flow test date/build:
- Physical Android exception or test date/build:

Store only non-secret identifiers here. Reference the approved secret manager for
credential locations; never paste credential values into this file.
