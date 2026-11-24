import type { ExpoConfig } from 'expo/config';

const pkg = process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.cloudlynk.app';
const scheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? 'cloudlynk';
const linkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST ?? 'cloudlynk.app';
const nativeIntegrations = process.env.EXPO_PUBLIC_NATIVE_INTEGRATIONS === 'true';
const playBilling = process.env.EXPO_PUBLIC_PLAY_BILLING === 'true';

// A store build missing one of these still builds, but signs in nowhere, has no push or
// breaks Meta. Stop the build on the EAS server with the names instead (docs/LAUNCH_CHECKLIST.md).
if (process.env.EAS_BUILD === 'true' && nativeIntegrations) {
  const missing = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_EAS_PROJECT_ID',
    'EXPO_PUBLIC_APP_LINK_HOST',
    'EXPO_PUBLIC_PRIVACY_URL',
    'EXPO_PUBLIC_TERMS_URL',
    'META_APP_ID',
    'META_CLIENT_TOKEN',
    'GOOGLE_SERVICES_JSON',
  ].filter((name) => !process.env[name]);
  if (missing.length)
    throw new Error(`Set these EAS environment variables before building: ${missing.join(', ')}`);
  if (process.env.EXPO_PUBLIC_SAMPLE_VIDEO_URL)
    throw new Error('EXPO_PUBLIC_SAMPLE_VIDEO_URL is for client test builds only. Remove it.');
}

const config: ExpoConfig = {
  name: 'CloudLynk',
  slug: 'cloudlynk',
  icon: './assets/icon.png',
  version: '1.0.0',
  scheme,
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  // The night canvas (theme/tokens.ts), so launch and screen changes never flash white.
  backgroundColor: '#101219',
  // Client-only web build. SDK 58 defaults to server rendering, which would run the
  // Supabase session storage (window.localStorage) on the server.
  web: { output: 'single' },
  android: {
    package: pkg,
    versionCode: 1,
    // "Draw over other apps" is only for React Native's debug overlay; keep it out of builds.
    blockedPermissions: ['android.permission.SYSTEM_ALERT_WINDOW'],
    // Firebase config for push notifications: an EAS file secret named GOOGLE_SERVICES_JSON.
    ...(process.env.GOOGLE_SERVICES_JSON
      ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
      : {}),
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
    [
      'expo-image-picker',
      {
        // Covers come from the photo library only; no camera or microphone access.
        photosPermission: 'CloudLynk uses your photos to set channel and title cover images.',
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
    ['expo-video', { supportsPictureInPicture: true }],
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
              // Nothing runs before consent: we call initializeSDK() and switch automatic
              // events and the advertising ID on (resumeMetaSdk) only after the member allows.
              isAutoInitEnabled: false,
              autoLogAppEventsEnabled: false,
              advertiserIDCollectionEnabled: false,
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
