import { Dimensions, PixelRatio, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

/**
 * Advertising measurement (Meta). Nothing here runs until the member agrees, and the
 * native SDK is imported only then, so builds without it and the web app are unaffected.
 * Money events are never sent from the app: the backend reports a payment to Meta after
 * it has been confirmed (see docs/META_ADS_TRACKING.md).
 */
export const measurementAvailable =
  Platform.OS === 'android' && process.env.EXPO_PUBLIC_NATIVE_INTEGRATIONS === 'true';

export type MeasurementChoice = 'allowed' | 'declined' | 'unanswered';

const choiceKey = (userId: string) => `cloudlynk.tracking.v1:${userId}`;
let started = false;

export async function measurementChoice(userId: string): Promise<MeasurementChoice> {
  const saved = await AsyncStorage.getItem(choiceKey(userId));
  return saved === 'true' ? 'allowed' : saved === 'false' ? 'declined' : 'unanswered';
}

export async function saveMeasurementChoice(userId: string, allowed: boolean) {
  await AsyncStorage.setItem(choiceKey(userId), String(allowed));
}

/** Starts the Meta SDK for a member who agreed. Returns Meta's anonymous install ID. */
export async function startMeasurement(userId: string): Promise<string | null> {
  if (!measurementAvailable) return null;
  const meta = await import('./metaEvents');
  if (!started) meta.initMetaSdk();
  started = true;
  meta.setMetaUser(userId);
  return meta.anonymousId();
}

/** Stops app events for the rest of this session; nothing starts on the next launch. */
export async function stopMeasurement() {
  if (!started) return;
  started = false;
  (await import('./metaEvents')).pauseMetaSdk();
}

export function logPlansViewed() {
  if (started) void import('./metaEvents').then((meta) => meta.logViewPlans());
}

export function logCheckoutStarted(productId: string) {
  if (started) void import('./metaEvents').then((meta) => meta.logCheckoutStarted(productId));
}

/**
 * Device details in the order Meta's Conversions API expects for Android app events
 * ("extinfo"). Values the app cannot read are sent empty, as Meta allows.
 */
export function deviceInfo(): string[] {
  const { width, height } = Dimensions.get('screen');
  const scale = PixelRatio.get();
  const options = Intl.DateTimeFormat().resolvedOptions();
  const version = Constants.expoConfig?.version ?? '';
  return [
    'a2',
    Constants.expoConfig?.android?.package ?? '',
    version,
    String(Constants.expoConfig?.android?.versionCode ?? version),
    String(Platform.Version),
    String((Platform.constants as { Model?: string }).Model ?? ''),
    options.locale.replace('-', '_'),
    '',
    '',
    String(Math.round(width * scale)),
    String(Math.round(height * scale)),
    scale.toFixed(2),
    '',
    '',
    '',
    options.timeZone,
  ];
}
