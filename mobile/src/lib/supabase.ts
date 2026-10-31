import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { configured, env } from './env';
import type { Database } from './database.types';

const storage = {
  getItem: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

// createClient rejects empty values; an unconfigured build still launches and
// assertLiveConfiguration() reports the missing settings before any request.
export const supabase = createClient<Database>(
  configured ? env.supabaseUrl : 'http://unconfigured.invalid',
  configured ? env.supabaseAnonKey : 'unconfigured',
  {
    auth: {
      storage,
      persistSession: configured,
      autoRefreshToken: configured,
      detectSessionInUrl: false,
    },
  },
);
