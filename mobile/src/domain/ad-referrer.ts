function referrerParam(referrer: string | null | undefined, name: string): string | null {
  if (!referrer) return null;
  try {
    return new URLSearchParams(referrer).get(name)?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * True when Google Play's install referrer shows the app was installed from a Meta ad.
 * Meta ads (Facebook, Instagram, Audience Network) name themselves in utm_source.
 */
export function isMetaAdReferrer(referrer: string | null | undefined): boolean {
  const source = referrerParam(referrer, 'utm_source');
  return !!source && /^apps\.(facebook|instagram)\.com$/i.test(source);
}

/**
 * True when the app was installed from the Play link on our /open/ad fallback page
 * (website/build.mjs), so someone who tapped an ad link before installing still counts.
 */
export function isAdLinkReferrer(referrer: string | null | undefined): boolean {
  return (
    referrerParam(referrer, 'utm_source') === 'cloudlynk' &&
    referrerParam(referrer, 'utm_medium') === 'ad_link'
  );
}
