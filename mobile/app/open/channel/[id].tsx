import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAdLink } from '@/services/attribution/ad-audience-sync';
export default function ChannelLink() {
  const { id, ad } = useLocalSearchParams<{ id: string; ad?: string }>();
  // Links in adverts carry ad=1; see services/attribution/ad-audience.ts.
  useAdLink(ad === '1');
  return <Redirect href={{ pathname: '/channel/[id]', params: { id } }} />;
}
