# Store release media

These folders hold the final RailCommand 1.0 store screenshots captured from the
archived release candidate with synthetic staging data. Never place credentials,
customer records, precise coordinates, notification tokens, or internal QA controls
in these files.

## Capture targets

- Apple iPhone: iPhone 17 Pro Max simulator, accepted 6.9-inch portrait dimensions.
- Apple iPad: iPad Pro 13-inch simulator, accepted 13-inch portrait dimensions.
- Google phone: Android emulator configured to `1080 × 1920` portrait.
- Google tablet: Android emulator configured to `1080 × 1920` portrait or
  `1920 × 1080` landscape.

Capture the six approved storyboard states from `../STORE_ASSET_PLAN.md`. The capture
command normalizes the iOS status bar, prevents accidental overwrite, and rejects the
wrong image size or format:

```sh
node scripts/capture-store-screenshot.mjs \
  --target apple-iphone \
  --device <simulator-udid> \
  --story field-dashboard
```

Before capture, generate and launch an isolated staging Release bundle. The helper
validates the staging backend and app identifier, refuses production, embeds the
JavaScript bundle, avoids Metro/development-client callbacks, and uses local simulator
signing only so SecureStore works:

```sh
env MOBILE_BUILD_PROFILE=staging \
  MOBILE_APP_ID=io.railcommand.app.staging \
  MOBILE_EXPECTED_APP_ID=io.railcommand.app.staging \
  node --env-file=.env.mobile.local scripts/expo-staging.mjs prebuild-ios

env MOBILE_BUILD_PROFILE=staging \
  MOBILE_APP_ID=io.railcommand.app.staging \
  MOBILE_EXPECTED_APP_ID=io.railcommand.app.staging \
  node --env-file=.env.mobile.local scripts/expo-staging.mjs \
  run-ios-simulator <simulator-udid>
```

`build-ios-simulator` remains the unsigned CI-equivalent build. Do not install it for
authenticated screenshot work because unsigned simulator apps cannot access the
Keychain entitlements required by SecureStore.

Valid targets are `apple-iphone`, `apple-ipad`, `google-phone`, and `google-tablet`.
Valid story slugs are `field-dashboard`, `daily-log-draft`, `offline-protection`,
`sync-center`, `synchronized-history`, and `privacy-controls`.

Run `npm run verify:store:media` for a non-failing inventory while work is in progress.
Run `npm run verify:store:media:strict` on the archived release candidate; all 24
required files must exist and pass format/dimension validation before submission.
