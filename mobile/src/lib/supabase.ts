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

/**
 * A request that gets no answer fails after this long. Without it a dead connection at
 * launch leaves the app waiting forever instead of showing "try again".
 */
const requestTimeoutMs = 25_000;
const fetchWithTimeout: typeof fetch = async (input, init) => {
  // File transfers take as long as the file needs; only requests for data have a deadline.
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/storage/v1/')) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const outer = init?.signal;
  const forward = () => controller.abort();
  if (outer?.aborted) controller.abort();
  else outer?.addEventListener('abort', forward);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted && !outer?.aborted)
      throw new Error('No response from CloudLynk. Check your connection and try again.');
    throw cause;
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', forward);
  }
};

// createClient rejects empty values; an unconfigured build still launches and
// assertLiveConfiguration() reports the missing settings before any request.
export const supabase = createClient<Database>(
  configured ? env.supabaseUrl : 'http://unconfigured.invalid',
  configured ? env.supabaseAnonKey : 'unconfigured',
  {
    global: { fetch: fetchWithTimeout },
    auth: {
      storage,
      persistSession: configured,
      autoRefreshToken: configured,
      detectSessionInUrl: false,
    },
  },
);
