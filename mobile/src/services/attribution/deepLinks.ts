import * as Linking from 'expo-linking';

/**
 * Maps incoming links (Meta ad deep links, App Links, shared links) to
 * app routes. Example: https://cloudlynk.app/open/channel/<id>
 * TODO: handle Meta deferred deep links after first launch.
 */
export function routeFromUrl(url: string): string | null {
  const { path } = Linking.parse(url);
  if (!path) return null;
  const clean = path.replace(/^open\//, '');
  if (clean.startsWith('channel/') || clean.startsWith('plans')) return `/${clean}`;
  return null;
}
