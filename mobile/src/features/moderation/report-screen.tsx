import { goBackOrExplore } from '@/lib/navigation';
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, ErrorNote, Field, Label, Pill, Screen } from '@/components/ui';
import { useWorkspace } from '@/state/workspace-provider';
import { createId } from '@/domain/format';
import { unavailable } from '@/data/live/cloud-api';
import { colors as c } from '@/theme/tokens';

export default function ReportScreen() {
  const { videoId } = useLocalSearchParams<{ videoId: string }>();
  const { state, demo, dispatch, requireIdentity, notify } = useWorkspace();
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState<string | null>(null);
  function submit() {
    if (!requireIdentity()) return;
    if (!reason) {
      setError('Choose a reason for your report.');
      return;
    }
    if (!state.videos.some((video) => video.id === videoId)) {
      setError('This video is no longer available.');
      return;
    }
    try {
      if (!demo) unavailable('Content reporting');
      dispatch({
        type: 'report-added',
        report: {
          id: createId('report'),
          videoId,
          reason,
          details: details.trim(),
          createdAt: new Date().toISOString(),
          resolved: false,
        },
      });
      notify('Report recorded in your local preview workspace');
      goBackOrExplore();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit report.');
    }
  }
  return (
    <Screen title="Help keep this space good." subtitle="Tell us what doesn’t belong." back>
      <Label style={{ color: c.muted }}>Choose the reason that best describes the problem.</Label>
      <View style={{ gap: 10 }}>
        {['Copyright concern', 'Harmful content', 'Spam or misleading', 'Something else'].map(
          (item) => (
            <Pill
              key={item}
              title={item}
              selected={item === reason}
              onPress={() => setReason(item)}
            />
          ),
        )}
      </View>
      <Field
        label="Anything else we should know?"
        value={details}
        onChangeText={setDetails}
        placeholder="Add helpful details (optional)"
        multiline
        numberOfLines={4}
        maxLength={1000}
      />
      <ErrorNote message={error} />
      <Button title={demo ? 'Record preview report' : 'Submit report'} onPress={submit} />
      <Label style={{ color: c.muted, fontSize: 11 }}>
        {demo
          ? 'Preview reports are saved on this device and can be reviewed using the local admin simulation.'
          : 'Reports are reviewed by the moderation team when the live endpoint is available.'}
      </Label>
    </Screen>
  );
}
