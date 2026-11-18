/**
 * True when Google Play's install referrer shows the app was installed from a Meta ad.
 * Meta ads (Facebook, Instagram, Audience Network) name themselves in utm_source.
 */
export function isMetaAdReferrer(referrer: string | null | undefined): boolean {
  if (!referrer) return false;
  let source: string | null;
  try {
    source = new URLSearchParams(referrer).get('utm_source');
  } catch {
    return false;
  }
  return !!source && /^apps\.(facebook|instagram)\.com$/i.test(source.trim());
}
