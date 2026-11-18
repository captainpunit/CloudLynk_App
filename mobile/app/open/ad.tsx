import { useEffect } from 'react';
import { Redirect } from 'expo-router';
import { rememberAdLink } from '@/services/attribution/ad-audience';

/** https://<app link host>/open/ad: the link for adverts that do not point at one channel. */
export default function AdLink() {
  useEffect(() => {
    void rememberAdLink();
  }, []);
  return <Redirect href="/" />;
}
