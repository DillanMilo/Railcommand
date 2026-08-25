import type { ConfigContext, ExpoConfig } from 'expo/config';

const profiles = {
  development: {
    name: 'RailCommand Development',
    identifier: 'io.railcommand.app.dev',
  },
  staging: {
    name: 'RailCommand Staging',
    identifier: 'io.railcommand.app.staging',
  },
  production: {
    name: 'RailCommand',
    identifier: 'io.railcommand.app',
  },
} as const;

const createExpoConfig = ({ config }: ConfigContext): ExpoConfig => {
  const profileName = process.env.EXPO_PUBLIC_BUILD_PROFILE ?? 'development';
  if (!(profileName in profiles)) throw new Error('Invalid Expo build profile');
  const profile = profiles[profileName as keyof typeof profiles];
  const buildNumber = process.env.MOBILE_BUILD_NUMBER ?? '300001';

  return {
    ...config,
    name: profile.name,
    slug: 'railcommand',
    owner: process.env.EXPO_OWNER,
    version: '0.3.0',
    orientation: 'portrait',
    scheme: 'railcommand',
    userInterfaceStyle: 'light',
    icon: './assets/images/icon.png',
    ios: {
      bundleIdentifier: profile.identifier,
      buildNumber,
      supportsTablet: true,
      associatedDomains: ['applinks:railcommand.io'],
      config: { usesNonExemptEncryption: false },
      infoPlist: {
        NSCameraUsageDescription: 'RailCommand uses the camera only when you attach a field photo to a record.',
        NSLocationWhenInUseUsageDescription: 'RailCommand attaches your location only when you request it for a field record.',
        NSPhotoLibraryUsageDescription: 'RailCommand lets you choose field photos to attach to a record.',
      },
    },
    android: {
      package: profile.identifier,
      versionCode: Number(buildNumber),
      adaptiveIcon: {
        backgroundColor: '#111827',
        foregroundImage: './assets/images/android-icon-foreground.png',
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: 'railcommand.io', pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-sqlite',
      ['expo-notifications', { color: '#ff6b00' }],
      ['expo-image-picker', {
        cameraPermission: 'RailCommand uses the camera only when you attach a field photo to a record.',
        photosPermission: 'RailCommand lets you choose field photos to attach to a record.',
        microphonePermission: false,
      }],
      ['expo-location', {
        locationWhenInUsePermission: 'RailCommand attaches your location only when you request it for a field record.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      }],
      ['expo-splash-screen', {
        backgroundColor: '#111827',
        image: './assets/images/splash-icon.png',
        imageWidth: 180,
      }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      buildProfile: profileName,
      eas: process.env.EXPO_PUBLIC_EAS_PROJECT_ID
        ? { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID }
        : undefined,
    },
  };
};

export default createExpoConfig;
