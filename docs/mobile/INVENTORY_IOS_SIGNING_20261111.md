# Inventory iPhone signing completed locally — 11 November 2026

**Signed package verified locally. No TestFlight upload, installation, merge, push
or deployment occurred. Inventory is still not enabled in the regular team app.**

The owner reviewed and accepted the pending Apple Developer Program agreement.
The account page's restriction disappeared, membership resources became available,
and the signing/profile request succeeded for Creative Currents LLC, team
`PQAGLH9L66`. The earlier August acceptance was a historical entry; a different
pending agreement was accessible through the banner's Review agreement button.

The first export from the earlier unsigned archive passed signature validation but
omitted the app's existing notification and associated-domain entitlements. It was
rejected and retained privately with DO NOT DISTRIBUTE labels. The current source
was then archived with normal automatic signing and exported again, using
`destination=export` and remote version/build management disabled. Only the final
verified package below is a release candidate. No runtime code or capability was
added to work around signing, and no unrelated app's profile was used.

## Verified artifact

- Version/build: **1.0.0 (610009)**; bundle ID `io.railcommand.app`.
- Source commit: `1f6f4aba1e6a7b2fd4c81f58e966534cf0c82932`.
- Native source tree: `4d2fd35d19e630df6a31ec5879899770d87f1f23`, identical to the
  previously tested release candidate.
- Deep, strict code-signature verification and ZIP CRC: passed.
- Matching App Store distribution profile; debugging disabled; no device-specific
  development profile substituted. Profile expires 27 August 2027 at 20:15:41 UTC.
- Existing push entitlement is production; associated domains retain
  `applinks:railcommand.io`.
- Packaged JavaScript matches the signed archive. Scan for existing server credential
  values passed; the build uses the selected public production client configuration.
- IPA size: 15,943,302 bytes.
- SHA-256: `b3d52dbffaa17842dd3b0658703491ff77fbcb37455eba12898d08346ad361aa`.

Private artifact:
`~/Library/Application Support/RailCommand/Phase1Local/private/release-prep-20261111/store-export/RailCommand.ipa`.
Signed archive, verification evidence and logs remain outside Git in that dated
folder. No signing private keys or customer rows were copied into the repository.
No cloud build, paid service, subscription change or new spending was used.

## Limits and next release steps

Apple signing is complete; this supersedes the earlier agreement/profile blocker.
The build number has not been checked against Apple's current remote build list.
Before any upload, verify it is available and complete the release review. This is
an App Store distribution package, not a directly installable development app.
No upload or tester assignment is authorized by agreement acceptance alone.

Final physical iPhone acceptance and the existing legacy integrity/privilege review
remain pending. The safeguarded legacy assignment repair still requires confirmed
replacement owners; none were guessed or changed. All original history remains
preserved. The reviewed backend/web rollout must precede team use of Inventory in
the signed app; none of the pending Inventory SQL was applied to live or persistent
local databases during this signing work.

## Platform, offline and preservation record

Web, shared API/domain, database and installed-client payloads: unchanged. Native:
packaging/signing only, with existing capabilities verified. No installed app,
project record, membership, private draft or outbox was opened, cleared or replaced.
The protected original checkout still matches its prior branch/HEAD/main/status
and binary-diff fingerprint. The source branch remains local and unmerged.

Signing is **online-only administrative work**, requiring Apple's account service;
it adds no app offline operation. Existing Inventory read-only cached stock and
durable request drafts remain unchanged; receiving/import/cost/approval stay
online-only. Earlier automated app/database results remain in the linked handoff;
this round adds archive/export/signature/entitlement/credential-scan verification,
not new physical-device or Android acceptance.

See [release preparation](INVENTORY_RELEASE_PREPARATION_20261110.md) and
[release checklist](INVENTORY_BETA_RELEASE_20261110.md).
