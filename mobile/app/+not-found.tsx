import { router } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';
export default function NotFound() {
  return (
    <Screen title="Page not found" back>
      <EmptyState
        title="That page isn’t here"
        body="The link may be old, or the page was removed."
        action="Back to Home"
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
