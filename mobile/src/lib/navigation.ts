import { router } from 'expo-router';

/** Direct links have no stack to pop; successful forms still need a destination. */
export function goBackOrExplore() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
