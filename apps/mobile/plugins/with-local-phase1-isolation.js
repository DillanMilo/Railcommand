// eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo config plugins use CommonJS.
const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

// This plugin is selected only by the explicit local Phase1 development target.
// Wildcard offline development signing must not claim shared or hosted services.
module.exports = function withLocalPhase1Isolation(config) {
  config = withInfoPlist(config, (mod) => {
    // This embedded bundle uses verified local HTTPS, not the Metro HTTP server.
    delete mod.modResults.NSAppTransportSecurity;
    return mod;
  });
  return withEntitlementsPlist(config, (mod) => {
    for (const key of ['aps-environment', 'com.apple.developer.associated-domains',
      'com.apple.security.application-groups', 'keychain-access-groups']) {
      delete mod.modResults[key];
    }
    return mod;
  });
};
