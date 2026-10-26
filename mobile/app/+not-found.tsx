import { router } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
export default function NotFound() {
  return (
    <Screen title="A little off the path." back>
      <EmptyState
        title="That page isn’t here"
        body="Let’s get you back to something good."
        action="Back to Explore"
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
