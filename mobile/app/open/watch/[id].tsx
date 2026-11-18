import { useEffect } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { rememberAdLink } from '@/services/attribution/ad-audience';
export default function WatchLink() {
  const { id, ad } = useLocalSearchParams<{ id: string; ad?: string }>();
  // Links in adverts carry ad=1; see services/attribution/ad-audience.ts.
  useEffect(() => {
    if (ad === '1') void rememberAdLink();
  }, [ad]);
  return <Redirect href={{ pathname: '/watch/[id]', params: { id } }} />;
}
