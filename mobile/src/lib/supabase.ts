import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { env } from './env';
import type { Database } from './database.types';

const storage = {
  getItem: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(
  env.supabaseUrl || 'https://unconfigured.supabase.co',
  env.supabaseAnonKey || 'unconfigured-public-key',
  {
    auth: {
      storage,
      persistSession: env.mode === 'live',
      autoRefreshToken: env.mode === 'live',
      detectSessionInUrl: false,
    },
  },
);
