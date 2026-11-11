import type { ExpoConfig } from 'expo/config';

const pkg = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.cloudlynk.app';
const scheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? 'cloudlynk';
const linkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST ?? 'cloudlynk.app';
const nativeIntegrations = process.env.EXPO_PUBLIC_NATIVE_INTEGRATIONS === 'true';
const playBilling = process.env.EXPO_PUBLIC_PLAY_BILLING === 'true';

const config: ExpoConfig = {
  name: 'CloudLynk',
  slug: 'cloudlynk',
  icon: './assets/icon.png',
  version: '0.1.0',
  scheme,
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  // The night canvas (theme/tokens.ts), so launch and screen changes never flash white.
  backgroundColor: '#101219',
  android: {
    package: pkg,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-foreground.png',
      monochromeImage: './assets/adaptive-foreground.png',
      backgroundColor: '#101219',
    },
    // Android App Links, used by Meta ad deep links and shared links.
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [{ scheme: 'https', host: linkHost, pathPrefix: '/open' }],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  plugins: [
    './plugins/with-short-cmake-paths',
    './plugins/with-preview-apk',
    'expo-router',
    [
      'expo-splash-screen',
      { image: './assets/splash-mark.png', imageWidth: 160, backgroundColor: '#101219' },
    ],
    'expo-secure-store',
    'expo-document-picker',
    'expo-video',
    'expo-image',
    'expo-sharing',
    'expo-font',
    'expo-notifications',
    ...(nativeIntegrations
      ? ([
          [
            'react-native-fbsdk-next',
            {
              appID: process.env.META_APP_ID,
              clientToken: process.env.META_CLIENT_TOKEN,
              displayName: process.env.META_DISPLAY_NAME ?? 'CloudLynk',
              scheme: `fb${process.env.META_APP_ID}`,
              // We call initializeSDK() ourselves after consent, so keep auto-init off.
              isAutoInitEnabled: false,
              autoLogAppEventsEnabled: true,
              advertiserIDCollectionEnabled: true,
            },
          ],
        ] as ExpoConfig['plugins'] & unknown[])
      : []),
    // Google Play billing with the user choice screen; only in the Google Play build.
    ...(playBilling ? ['expo-iap'] : []),
    ['expo-build-properties', { android: { minSdkVersion: 24 } }],
  ],
  experiments: { typedRoutes: true },
  ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID
    ? { extra: { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } }
    : {}),
};

export default config;
