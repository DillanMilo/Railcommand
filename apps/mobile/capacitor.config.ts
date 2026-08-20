import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.railcommand.app.dev',
  appName: 'RailCommand Development',
  webDir: 'dist',
  android: {
    minWebViewVersion: 83,
  },
};

// Deliberately no server.url: every native build bundles local Vite assets.
export default config;
