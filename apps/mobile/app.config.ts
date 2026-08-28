import type { ConfigContext, ExpoConfig } from 'expo/config';

const EAS_OWNER = 'creative-currents';
const EAS_PROJECT_ID = 'dda86dca-ca12-4efa-a556-6fd8411485d5';
const STAGING_LINK_HOST = 'mobile-staging.railcommand.io';

const profiles = {
  development: {
    name: 'RailCommand Development',
    identifier: 'io.railcommand.app.dev',
    linkHost: STAGING_LINK_HOST,
  },
  staging: {
    name: 'RailCommand Staging',
    identifier: 'io.railcommand.app.staging',
    linkHost: STAGING_LINK_HOST,
  },
  production: {
    name: 'RailCommand',
    identifier: 'io.railcommand.app',
    linkHost: 'railcommand.io',
  },
} as const;

const createExpoConfig = ({ config }: ConfigContext): ExpoConfig => {
  const profileName = process.env.EXPO_PUBLIC_BUILD_PROFILE;
  if (!profileName) {
    throw new Error(
      'EXPO_PUBLIC_BUILD_PROFILE is required; use development, staging, or production explicitly',
    );
  }
  if (!(profileName in profiles)) throw new Error('Invalid Expo build profile');
  const profile = profiles[profileName as keyof typeof profiles];
  const buildNumber = process.env.MOBILE_BUILD_NUMBER ?? '300001';

  return {
    ...config,
    name: profile.name,
    slug: 'railcommand',
    owner: EAS_OWNER,
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'railcommand',
    userInterfaceStyle: 'light',
    icon: './assets/images/icon-store-1024.png',
    ios: {
      bundleIdentifier: profile.identifier,
      buildNumber,
      appleTeamId: 'PQAGLH9L66',
      supportsTablet: true,
      associatedDomains: [`applinks:${profile.linkHost}`],
      config: { usesNonExemptEncryption: false },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
            NSPrivacyAccessedAPITypeReasons: ['CA92.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp',
            NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1', '3B52.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime',
            NSPrivacyAccessedAPITypeReasons: ['35F9.1'],
          },
          {
            NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace',
            NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'],
          },
        ],
        NSPrivacyCollectedDataTypes: [
          'Name',
          'EmailAddress',
          'PhotosorVideos',
          'PreciseLocation',
          'CoarseLocation',
          'UserID',
          'DeviceID',
          'OtherUserContent',
        ].map((suffix) => ({
          NSPrivacyCollectedDataType: `NSPrivacyCollectedDataType${suffix}`,
          NSPrivacyCollectedDataTypeLinked: true,
          NSPrivacyCollectedDataTypeTracking: false,
          NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality'],
        })),
      },
      infoPlist: {
        NSCameraUsageDescription: 'RailCommand uses the camera only when you attach a field photo to a record.',
        NSLocationWhenInUseUsageDescription: 'RailCommand attaches your location only when you request it for a field record.',
        NSPhotoLibraryUsageDescription: 'RailCommand lets you choose field photos to attach to a record.',
      },
    },
    android: {
      package: profile.identifier,
      versionCode: Number(buildNumber),
      blockedPermissions: [
        'android.permission.ACCESS_BACKGROUND_LOCATION',
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ],
      adaptiveIcon: {
        backgroundColor: '#0F172A',
        foregroundImage: './assets/images/icon-store-1024.png',
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [{ scheme: 'https', host: profile.linkHost, pathPrefix: '/' }],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-sqlite',
      ['expo-notifications', { color: '#F97316' }],
      ['expo-image-picker', {
        cameraPermission: 'RailCommand uses the camera only when you attach a field photo to a record.',
        photosPermission: 'RailCommand lets you choose field photos to attach to a record.',
        microphonePermission: false,
      }],
      './plugins/with-foreground-location-only',
      ['expo-location', {
        locationWhenInUsePermission: 'RailCommand attaches your location only when you request it for a field record.',
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
      }],
      ['expo-splash-screen', {
        backgroundColor: '#0F172A',
        image: './assets/images/icon-store-1024.png',
        imageWidth: 180,
      }],
    ],
    experiments: { typedRoutes: true, reactCompiler: true },
    extra: {
      buildProfile: profileName,
      linkHost: profile.linkHost,
      eas: { projectId: EAS_PROJECT_ID },
    },
  };
};

export default createExpoConfig;
