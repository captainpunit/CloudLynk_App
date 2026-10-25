import { Redirect, useLocalSearchParams } from 'expo-router';
export default function WatchLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/watch/[id]', params: { id } }} />;
}
