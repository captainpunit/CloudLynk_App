import { Platform } from 'react-native';
import { PlayInstallReferrer } from 'react-native-play-install-referrer';
import { AppEventsLogger } from 'react-native-fbsdk-next';
import { supabase } from '@/lib/supabase';

/**
 * Reads the Google Play install referrer once and sends it to the
 * track-install function. For Meta app install ads the referrer carries
 * Meta's encrypted campaign data, which the backend stores for attribution.
 */
export async function captureInstallAttribution(): Promise<void> {
  if (Platform.OS !== 'android') return;
  // TODO: skip if already sent (persist a flag in SecureStore).
  const referrer = await new Promise<string | null>((resolve) =>
    PlayInstallReferrer.getInstallReferrerInfo((info, error) =>
      resolve(error ? null : (info?.installReferrer ?? null)),
    ),
  );
  const anonId = await AppEventsLogger.getAnonymousID();
  await supabase.functions.invoke('track-install', {
    body: { platform: 'android', installReferrer: referrer, metaAnonId: anonId },
  });
}
