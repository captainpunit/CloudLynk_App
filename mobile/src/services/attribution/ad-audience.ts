import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { call } from '@/data/live/backend';
import { isMetaAdReferrer } from '@/domain/ad-referrer';

/**
 * Some channels are shown only to members who came from an advert. A member counts as
 * coming from an advert when either:
 * - Google Play's install record shows the app was installed from a Meta ad, or
 * - the app was opened from a CloudLynk ad link (any /open/... link with `ad=1`).
 *
 * The finding is kept on this device and sent to the backend once the member is signed
 * in. The backend only ever moves a member from organic to ads, and an administrator can
 * change it either way. Nothing here is shared with Meta.
 */
export type AdSource = 'install_referrer' | 'ad_link';

const sourceKey = 'cloudlynk.adSource.v1';
const referrerCheckedKey = 'cloudlynk.adReferrerChecked.v1';

/** Called by the /open/... routes when the link carries `ad=1`. */
export async function rememberAdLink(): Promise<void> {
  try {
    if (!(await AsyncStorage.getItem(sourceKey))) await AsyncStorage.setItem(sourceKey, 'ad_link');
  } catch {
    // Storage unavailable: the member stays organic, which hides nothing they could see before.
  }
}

/** Reads Google Play's install record once per installation. */
async function readInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  const { PlayInstallReferrer } = await import('react-native-play-install-referrer');
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 10000);
    PlayInstallReferrer.getInstallReferrerInfo((info, error) => {
      clearTimeout(timeout);
      resolve(error ? null : (info?.installReferrer ?? null));
    });
  });
}

/** What this device knows about coming from an advert, or null. */
export async function detectAdSource(): Promise<AdSource | null> {
  const saved = await AsyncStorage.getItem(sourceKey);
  if (saved === 'ad_link' || saved === 'install_referrer') return saved;
  if (await AsyncStorage.getItem(referrerCheckedKey)) return null;
  const referrer = await readInstallReferrer().catch(() => null);
  // The install record does not change, so one successful read is enough.
  if (referrer !== null || Platform.OS !== 'android')
    await AsyncStorage.setItem(referrerCheckedKey, '1');
  if (!isMetaAdReferrer(referrer)) return null;
  await AsyncStorage.setItem(sourceKey, 'install_referrer');
  return 'install_referrer';
}

/**
 * Tells the backend this member came from an advert. Returns true when their group
 * changed, so the caller can reload the catalogue.
 */
export async function reportAdAudience(): Promise<boolean> {
  const source = await detectAdSource();
  if (!source) return false;
  const audience = await call('mark_ad_audience', { p_source: source });
  return audience === 'ads';
}
