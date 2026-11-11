import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { invokeBackend } from '@/data/live/invoke-backend';
import { installationId } from '@/services/notifications/push';
import {
  deviceInfo,
  saveMeasurementChoice,
  startMeasurement,
  stopMeasurement,
} from '@/services/meta/measurement';

/**
 * Records the member's choice about advertising measurement. When they agree, it reads
 * the Google Play install referrer (for Meta install ads it carries Meta's encrypted
 * campaign data), starts the Meta SDK and sends both to the track-install function, so
 * the backend can attribute a later confirmed payment. When they decline, the backend
 * clears what it held and nothing is collected.
 */
export async function captureInstallAttribution(consent: boolean): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in before changing your privacy preferences.');
  let referrer: string | null = null;
  if (consent) {
    if (Platform.OS !== 'android')
      throw new Error('Advertising measurement can be enabled from the Android app.');
    const { PlayInstallReferrer } = await import('react-native-play-install-referrer');
    referrer = await new Promise<string | null>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Install information could not be read. Try again.')),
        10000,
      );
      PlayInstallReferrer.getInstallReferrerInfo((info, error) => {
        clearTimeout(timeout);
        if (error) reject(new Error('Install information could not be read. Try again.'));
        else resolve(info?.installReferrer ?? null);
      });
    });
  }
  const {
    data: { user: current },
  } = await supabase.auth.getUser();
  if (current?.id !== user.id) throw new Error('Your account changed. Please try again.');
  await invokeBackend('track-install', {
    platform: 'android',
    installationId: await installationId(),
    trackingConsent: consent,
    ...(consent
      ? {
          installReferrer: referrer,
          metaAnonId: await startMeasurement(user.id),
          extinfo: deviceInfo(),
        }
      : {}),
  });
  if (!consent) await stopMeasurement();
  await saveMeasurementChoice(user.id, consent);
}
