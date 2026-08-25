# Universal Links and Android App Links

The app already declares `railcommand://` and `https://railcommand.io` callbacks.
Verified HTTPS links additionally require association files on the public domain.
Do not publish either template automatically from a mobile feature branch.

## Apple

Review `apple-app-site-association.template.json`, replace or remove any application
flavor that will not be installed, and publish it with `application/json` and no redirect
at either:

- `https://railcommand.io/.well-known/apple-app-site-association`
- `https://railcommand.io/apple-app-site-association`

The current Apple Team ID is `PQAGLH9L66`. Confirm it in the signed Xcode account before
publishing. Test both a cold launch and an already-running callback.

## Android

Copy `assetlinks.template.json`, replace every `REPLACE_WITH_*_SHA256_CERT_FINGERPRINT`
value with the exact SHA-256 fingerprint for that package's signing certificate, and
publish it with `application/json` and no redirect at:

- `https://railcommand.io/.well-known/assetlinks.json`

Development/debug, Play App Signing, and any upload certificate have different
fingerprints. Include only fingerprints that should be trusted. Verify each installed
package with Android's App Links tooling before a release.

## Accepted callback scope

Only `railcommand.io` HTTPS URLs and the `railcommand://` custom scheme are parsed by the
shared domain contract. Auth callbacks must contain a valid PKCE `code` or a complete
access/refresh token pair; incomplete or foreign callbacks are rejected.
