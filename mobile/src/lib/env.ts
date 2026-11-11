import Constants from 'expo-constants';

// Public values only: everything here is bundled into the app. See mobile/.env.example.
const linkHost = process.env.EXPO_PUBLIC_APP_LINK_HOST ?? '';
/** Only secure web pages are opened from the app. */
const webPage = (value?: string) => (value?.startsWith('https://') ? value : '');

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  appName: Constants.expoConfig?.name ?? '',
  appVersion: Constants.expoConfig?.version ?? '',
  privacyUrl: webPage(process.env.EXPO_PUBLIC_PRIVACY_URL),
  termsUrl: webPage(process.env.EXPO_PUBLIC_TERMS_URL),
};

export const configured =
  !!env.supabaseUrl && !!env.supabaseAnonKey && !env.supabaseUrl.includes('YOUR-PROJECT');

/** Public App Link for a route such as `/open/watch/<id>`; falls back to the app scheme. */
export function shareUrl(path: string) {
  return linkHost ? `https://${linkHost}${path}` : (Constants.linkingUri ?? '') + path.slice(1);
}
