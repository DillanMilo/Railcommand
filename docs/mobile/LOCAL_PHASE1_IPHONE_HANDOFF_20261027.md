# Local Phase1 iPhone target — 27 October 2026

This bounded change prepares a separate local test application from reviewed Phase1
source d412dae319a1518b2c011de00229551b85731abe. It changes no feature rules,
server endpoints, schema or existing app data. No worker signed, installed,
uploaded, pushed, merged, deployed or changed a hosted resource.

## Identity and connection

Select this target explicitly at build time:

```text
MOBILE_LOCAL_PHASE1=1
EXPO_PUBLIC_LOCAL_PHASE1=1
EXPO_PUBLIC_BUILD_PROFILE=development
EXPO_PUBLIC_SUPABASE_URL=https://<Mac-private-IPv4>:44321/supabase
EXPO_PUBLIC_API_BASE_URL=https://<same-Mac-private-IPv4>:44321
EXPO_PUBLIC_EXPECTED_SUPABASE_PROJECT_REF=local
EXPO_PUBLIC_EXPECTED_API_HOST=<same-Mac-private-IPv4>
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<local-public-client-key>
```

Omit MOBILE_DISTRIBUTION_TARGET. Staging, beta and production combinations are
rejected. The real certificate/private keys stay outside source and the app.
Local TLS must verify normally; the device must trust the local test certificate
through the separately managed explicit user procedure. No self-signed-certificate
bypass, arbitrary ATS exception or public tunnel is added. Rebuild if the Mac's
private address changes. A valid local legacy anon JWT is accepted; server-role
JWTs and secret keys are rejected for this target. The key is not an authorization
boundary: local auth, current membership, role and RLS remain server requirements.

The installed name is **RailCommand Phase1**, identifier
`io.railcommand.app.phase1`. Both the bundled opt-in and native application identity
must match before the private-network configuration is accepted; an environment
flag alone cannot enable it. Only an exact HTTPS RFC1918 IPv4 origin is allowed,
with the API root and Supabase /supabase path on the same port/host. User info,
query, fragment, another origin, public/loopback/link-local address, DNS hostname,
wrong path and cleartext LAN connections fail closed. Existing hard-coded
production denylists and ordinary loopback/staging/release guards remain.

The sole project custom scheme is `railcommandphase1`. Auth callbacks and reset
requests use `railcommandphase1://auth/callback`; the local target rejects normal
railcommand and hosted universal-link callbacks before credential exchange. Normal
installed clients retain their original scheme, verified link hosts and legacy
recovery routing. The unique bundle-id scheme emitted by Expo is also isolated.

No production/staging associated domains, app groups, shared keychain groups,
push entitlement or EAS project ID are attached to this local target. The
local-only config plugin removes Expo's default broad ATS allowances and shared
service entitlements from generated native configuration. Notifications plugin
selection/cloud registration/QA registration are disabled only for this target;
Account explains that cloud notifications are unavailable. Google discovery and
OAuth are disabled here; local invitation/sign-in/reset handling remains. Existing
ordinary development, staging, beta and production targets keep their configuration.

## Web/mobile/shared/offline impact

- Web: source UI and auth handlers unchanged. The parent local web runtime and
  backend use synthetic data on the same isolated database as the phone.
- Native: opt-in app configuration, strict endpoint validation, callback handling,
  local-network permission explanation and local cloud-notification controls.
  Sign-in identifies the local synthetic-test environment. Existing installed
  development/staging/production applications and their identities are untouched.
- Shared API/domain/database: unchanged. Existing shared deep-link parser is reused
  by a native helper after verifying/normalizing the local scheme. No server API,
  grants/RLS, migrations, finance rule, budget or approval state is changed.
- Offline: operational input remains **offline draft/queue, draft only**; cached
  operational stock is **offline read-only**. Financial actions, approval, posting
  and settlement remain **online-only**. No inventory outbox, replay, data scrub,
  queue migration or idempotency-identity change. Existing private storage APIs
  stay unchanged; the separate application sandbox and default keychain access
  isolate this app from already-installed app sessions, drafts, logs and photos.
- Compatibility/rollback: ordinary target identities, custom scheme, associated
  domains/cloud IDs and release guards are exercised by regressions. Removing the
  new local app or opting out of the two local-target flags does not modify an old
  app, database or server ledger. Do not uninstall or reset an existing app.

## Local source verification

Root/shared/backend480 tests; native272 tests and native typecheck; root production
web build and standalone TypeScript; unsigned local iOS export; generated Expo
introspection; static grant inventory79 definitions/47 files and parity inventory
130 actions passed. Focused lint passed with0 errors/0 warnings. Existing broader parity
and physical-device acceptance are not inferred from these inventories. No schema
change requires a new migration or hosted advisor/fixture.

Executed security tests cover the bundled/installed identity, normal target
compatibility, RFC1918 boundaries, same HTTPS origin/path/port, no user-info/query/
fragment, public keys versus server-role JWTs, old/new callback separation, actual
provider reset routing, and actual native-intent routing. Expo introspection proves
empty entitlements, absent ATS exceptions, no EAS project/associated domains and no
registered old app scheme. Current build logs and exact SHA are recorded in
`.codex-loop/reports/TIA-LOCAL-IPHONE/build.md`.

The React checklist was applied to the small touched auth/account screens: no new
persistent state, subscription, waterfall, inline component or permission expansion;
existing effect cleanup/session invalidation remains. Local disabled controls are
explained, and network failures retain existing recovery behavior.

## Parent-only installation/acceptance gates

The user authorized zero-extra-cost local backend restore and a separate iPhone
installation. The parent owns the persistent runtime, private TLS/signing material,
local auth fixtures, device checks, local signed build/install and handoff. These
source checks do not establish an installed or connected physical app. Before
installing, inspect generated app bundle identity, URL schemes, ATS/entitlements,
provisioning/profile and absence of private server credentials. Verify the unique
bundle ID is absent so no current app is replaced. Use existing local signing only;
no paid cloud build, App Store/TestFlight upload, Apple Portal resource creation,
production endpoint substitution or existing-device-data purge.

After installation, verify local TLS/network permission, invite-only distinct
synthetic identities, web-to-phone and phone-to-web same-record reads/writes,
5% carrying/annual-contract/second-sign-off/split flags, field finance omission,
offline draft survival and current authorization. Preserve old apps and their
queued work. Record actual app/version, signing/install and physical verification
outcomes separately. Pending physical iPhone/iPad/Android restart/network/privacy,
old-queue and wider parity gates remain pending until observed.
