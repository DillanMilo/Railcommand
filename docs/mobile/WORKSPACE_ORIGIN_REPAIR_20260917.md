# iPhone Workspace handoff repair — September 17, 2026

Build 300009 user acceptance failed: Workspace displayed expired sign-in immediately
when opened, including from Photos. Live logs show successful authenticated ticket
issuance (200) followed within seconds by handoff rejection (403). Request bodies,
credentials and actual phone request headers were not captured or logged.

## Cause and bounded fix

The native initial POST specified Content-Type but no Origin. WebKit's official
FrameLoader adds an opaque Origin to non-GET/HEAD requests when an origin is absent;
it preserves an explicit Origin. The server deliberately rejects Origin: null.
This is a concrete code-level incompatibility consistent with the phone failure,
not a captured-header assertion. Regression tests reproduce rejection of the opaque
origin and successful one-use exchange with the explicit same-origin header.

- Native request factory now sends the exact configured HTTPS Workspace origin.
  Tickets stay in the POST body, never the URL. Reject malformed origins/tickets.
- The generic failure message no longer asserts every rejection is session expiry.
- Server origin, cross-site, pilot, verified identity, MFA and one-use OTP checks are
  unchanged. No relaxation to accept null origins; no cookie/session sharing added.
- No live records, stored files, queued operations, memberships or passwords changed.

Web impact: server runtime unchanged, only a regression test added. Mobile impact:
bundled request change requires a new production TestFlight build; 300009 cannot
receive this through a web deployment. Shared API contract unchanged.
Offline classification: online-only session handoff. Native drafts/queues and their
identities are unchanged; update in place, never uninstall/sign out to troubleshoot.
Existing Workspace forms retain the prior online-only limitations.

## Validation and release status

- Native: 231 tests and mobile TypeScript passed.
- Server handoff/cache/ticket tests: 13 passed. Covers opaque rejection, first-party
  successful cookie issuance, one-use replay denial, identity changes, revoked pilot,
  MFA, missing authentication and cache boundaries. These use real SDK transport
  with synthetic Auth responses; they are not physical-device evidence.
- Candidate web build, root TypeScript and focused lint passed; server CI
  35255446664 passed on f15c0aa. Native runtime commit: dbc59b9.
- Production iOS build 1.0.0 (300010): 229143d5-703e-45c0-b77f-02a56fbdef49.
  Auto-submission: 07af68ba-dd02-4971-80a4-57035f4d7ad6. Production profile,
  existing signing credentials. Build FINISHED and IPA bundle/version verified.
  SHA-256: fa6b8b93178083632fedf2690b0944f9e66334de8df1782ae1a9503b524e3b93.
  Signed archive also contains the new factory/error-message strings.
  Submission FINISHED. Apple build b6da7948-cc59-4d33-9f66-7b1bfffe5815 is VALID
  and IN_BETA_TESTING. Assignment to internal group
  b92ba7eb-1a88-40ec-8af2-f38c499dee30 was written and read back successfully;
  membership verified as only dillanxx@gmail.com. No external release performed.
  Do not call the repair installed or accepted before the user's iPhone opens
  Workspace successfully.
- No web deployment or database migration required for this native repair.
- External tester distribution remains separately gated.

Primary implementation evidence:
https://github.com/WebKit/WebKit/blob/main/Source/WebCore/loader/FrameLoader.cpp
(`addHTTPOriginIfNeeded`, `updateRequestAndAddExtraFields`). Installed
react-native-webview 13.16.1 forwards source headers via RCTConvert NSURLRequest.
