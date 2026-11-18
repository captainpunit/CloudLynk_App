import { Redirect } from 'expo-router';
import { useAdLink } from '@/services/attribution/ad-audience-sync';

/** https://<app link host>/open/ad: the link for adverts that do not point at one channel. */
export default function AdLink() {
  useAdLink(true);
  return <Redirect href="/" />;
}
