// A fresh checkout is usable without credentials. Live mode must be explicit.
export const env = {
  mode: process.env.EXPO_PUBLIC_DATA_MODE === 'live' ? ('live' as const) : ('demo' as const),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  androidPackage: process.env.EXPO_PUBLIC_ANDROID_PACKAGE ?? 'com.cloudlynk.app',
};
