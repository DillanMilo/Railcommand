const { withInfoPlist } = require('expo/config-plugins');

/**
 * expo-location declares Apple's "always" usage strings even when background
 * location is disabled. RailCommand only asks for a one-time foreground fix,
 * so remove those unused declarations after the package plugin runs.
 */
module.exports = function withForegroundLocationOnly(config) {
  return withInfoPlist(config, (result) => {
    delete result.modResults.NSLocationAlwaysUsageDescription;
    delete result.modResults.NSLocationAlwaysAndWhenInUseUsageDescription;
    return result;
  });
};
