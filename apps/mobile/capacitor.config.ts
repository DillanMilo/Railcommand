import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const profiles = {
  development: { appId: 'io.railcommand.app.dev', appName: 'RailCommand Development' },
  staging: { appId: 'io.railcommand.app.staging', appName: 'RailCommand Staging' },
  production: { appId: 'io.railcommand.app', appName: 'RailCommand' },
} as const;

const profileName = process.env.MOBILE_BUILD_PROFILE ?? 'development';
if (!(profileName in profiles)) {
  throw new Error('MOBILE_BUILD_PROFILE must be development, staging, or production');
}
const profile = profiles[profileName as keyof typeof profiles];
if (process.env.MOBILE_APP_ID && process.env.MOBILE_APP_ID !== profile.appId) {
  throw new Error(`${profileName} Capacitor sync must use ${profile.appId}`);
}

const config: CapacitorConfig = {
  appId: profile.appId,
  appName: profile.appName,
  webDir: 'dist',
  // Capacitor's bridge logger includes plugin return payloads. Secure-storage
  // payloads contain the Supabase session, so native bridge logging must stay
  // disabled even in development builds.
  loggingBehavior: 'none',
  android: {
    minWebViewVersion: 83,
  },
  plugins: {
    Keyboard: {
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#F3F3EE',
      showSpinner: false,
    },
  },
};

// Deliberately no server.url: every native build bundles local Vite assets.
export default config;
