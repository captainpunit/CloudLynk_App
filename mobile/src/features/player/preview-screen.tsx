import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Caption, Screen } from '@/components/ui';
import { gutter } from '@/theme/tokens';
import LivePlayback from './live-playback';

/**
 * Plays a title in any state (draft, in review, rejected) for an administrator reviewing
 * it or the creator checking their upload. The backend decides who may preview.
 */
export default function PreviewScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  return (
    <Screen tone="dark" back title="Preview">
      <View style={{ marginHorizontal: -gutter }}>
        <LivePlayback titleId={id} title={name ?? 'Preview'} />
      </View>
      <Caption>
        Only administrators and the video&apos;s creator can watch it before it is published.
      </Caption>
    </Screen>
  );
}
