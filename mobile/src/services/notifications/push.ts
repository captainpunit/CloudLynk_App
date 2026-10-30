import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import { call } from '@/data/live/backend';
import { supabase } from '@/lib/supabase';

const installationKey = 'cloudlynk.installation.v1';
const preferenceKey = 'cloudlynk.push.enabled.v1';
let installation: Promise<string> | undefined;
export function installationId(): Promise<string> {
  return (installation ??= (async () => {
    const saved = await AsyncStorage.getItem(installationKey);
    if (saved) return saved;
    const id = randomUUID();
    await AsyncStorage.setItem(installationKey, id);
    return id;
  })());
}
export async function enablePush(prompt = true) {
  if (Platform.OS !== 'android')
    throw new Error('Push notifications are available in the Android app.');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in before enabling notifications.');
  const notifications = await import('expo-notifications');
  await notifications.setNotificationChannelAsync('default', {
    name: 'CloudLynk updates',
    importance: notifications.AndroidImportance.DEFAULT,
  });
  let permission = await notifications.getPermissionsAsync();
  if (!permission.granted && prompt) permission = await notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error('Notifications are disabled. Enable permission in your Android settings.');
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Push notifications need an EAS project ID in this build.');
  const token = await notifications.getExpoPushTokenAsync({ projectId });
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();
  if (currentUser?.id !== user.id)
    throw new Error('Your account changed. Enable notifications again.');
  await call('register_push_token', {
    p_installation_id: await installationId(),
    p_token: token.data,
  });
  await AsyncStorage.setItem(preferenceKey, 'true');
}
export async function unregisterPush() {
  await call('unregister_push_token', { p_installation_id: await installationId() });
}
export async function disablePush() {
  await unregisterPush();
  await AsyncStorage.setItem(preferenceKey, 'false');
}
export async function pushEnabled() {
  return (await AsyncStorage.getItem(preferenceKey)) === 'true';
}
