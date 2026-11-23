import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { Button, Label } from '@/components/ui';
import { call } from '@/data/live/backend';
import { useWorkspace } from '@/state/workspace-provider';
import { supabase } from '@/lib/supabase';
import { isFinished, startPosition } from '@/domain/playback';
import { colors as c } from '@/theme/tokens';
import { VideoPlayback } from './video-playback';
import { usePlaybackGrant } from './use-playback-grant';

/** Progress is saved at most this often while playing; pauses and exits save at once. */
const SAVE_EVERY_MS = 15000;

export default function LivePlayback({
  titleId,
  title,
  cover,
}: {
  titleId: string;
  title: string;
  cover?: string;
}) {
  const { state, dispatch } = useWorkspace();
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const { uri, problem, retry } = usePlaybackGrant(
    titleId,
    focused,
    `${state.profile?.id}:${state.profile?.accountStatus}`,
  );
  // Where to start, decided once per visit so later saves do not move the start.
  const resumeAt = useRef<number | null>(null);
  if (resumeAt.current === null)
    resumeAt.current = startPosition(
      state.progress[titleId] ?? 0,
      0,
      (state.completedIds ?? []).includes(titleId),
    );
  const savedAt = useRef(0);
  const lastSaved = useRef(-1);

  function save(seconds: number, duration: number, final = false) {
    if (!final && Date.now() - savedAt.current < SAVE_EVERY_MS) return;
    if (Math.abs(seconds - lastSaved.current) < 1) return;
    savedAt.current = Date.now();
    lastSaved.current = seconds;
    const userId = state.profile?.id;
    if (!userId) return;
    void (async () => {
      const saved = await call('save_watch_progress', {
        p_title_id: titleId,
        p_position_seconds: seconds,
      });
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id === userId)
        dispatch({
          type: 'progress',
          id: titleId,
          seconds,
          completed: saved?.completed ?? (duration > 0 && isFinished(seconds, duration)),
        });
    })()
      // A missed save is retried on the next one; never interrupt the video for it.
      .catch(() => undefined);
  }

  if (uri)
    return (
      <VideoPlayback
        uri={uri}
        title={title}
        resumeAt={resumeAt.current}
        onProgress={save}
        onRetry={retry}
      />
    );
  const plusEnded = problem?.code === 'subscription_required';
  return (
    <View style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: c.player }}>
      {!!cover && (
        <Image source={cover} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />
      )}
      <View
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: problem ? c.scrim : c.scrimSoft,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          gap: 12,
        }}
      >
        {problem ? (
          <>
            <Label accessibilityRole="alert" style={{ color: c.white, textAlign: 'center' }}>
              {plusEnded ? 'Your Plus has ended. Renew it to keep watching.' : problem.message}
            </Label>
            {plusEnded ? (
              <Button
                compact
                variant="plus"
                title="Renew Plus"
                onPress={() => router.push('/premium')}
              />
            ) : (
              <Button compact title="Try again" onPress={retry} />
            )}
          </>
        ) : (
          <ActivityIndicator size="large" color={c.white} accessibilityLabel="Loading video" />
        )}
      </View>
    </View>
  );
}
