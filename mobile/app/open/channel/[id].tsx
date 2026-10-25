import { Redirect, useLocalSearchParams } from 'expo-router';
export default function ChannelLink() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/channel/[id]', params: { id } }} />;
}
