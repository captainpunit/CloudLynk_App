import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { Button, ErrorNote, Label, Surface } from '@/components/ui';
import { call, playbackToken } from '@/data/live/backend';
import { useWorkspace } from '@/state/workspace-provider';
import { VideoPlayback } from './video-playback';
import { supabase } from '@/lib/supabase';

export default function LivePlayback({ titleId }: { titleId: string }) {
  const { state, dispatch } = useWorkspace();
  const [grant, setGrant] = useState<Awaited<ReturnType<typeof playbackToken>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [focused, setFocused] = useState(false);
  const position = useRef(state.progress[titleId] ?? 0);
  const savedAt = useRef(0);
  const saving = useRef(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    position.current = state.progress[titleId] ?? 0;
    savedAt.current = 0;
  }, [titleId]);
  useEffect(() => {
    if (!focused) {
      setGrant(null);
      return;
    }
    let disposed = false,
      sequence = 0;
    let renewal: ReturnType<typeof setTimeout> | undefined;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    let lastExpiry = '';
    const clear = () => {
      clearTimeout(renewal);
      clearTimeout(expiry);
    };
    const load = async () => {
      const current = ++sequence;
      clearTimeout(renewal);
      try {
        const next = await playbackToken(titleId);
        if (disposed || current !== sequence) return;
        const remaining = Date.parse(next.expiresAt) - Date.now();
        if (!Number.isFinite(remaining) || remaining <= 0 || !next.hlsUrl.startsWith('https://'))
          throw new Error('Playback authorization expired.');
        clearTimeout(expiry);
        setGrant(next);
        setError(null);
        expiry = setTimeout(() => {
          setGrant(null);
          setError('Playback authorization expired. Retry to check your access.');
        }, remaining);
        // A subscription-bounded grant cannot be extended by repeatedly issuing
        // the same expiry. Always stop at the server's expiration.
        if (remaining > 40000 && next.expiresAt !== lastExpiry) {
          renewal = setTimeout(() => void load(), remaining - 20000);
        }
        lastExpiry = next.expiresAt;
      } catch (cause) {
        if (!disposed && current === sequence) {
          setGrant(null);
          setError((cause as Error).message);
        }
      }
    };
    setGrant(null);
    setError(null);
    void load();
    const foreground = AppState.addEventListener('change', (status) => {
      if (status === 'active') void load();
      else {
        ++sequence;
        clear();
        setGrant(null);
      }
    });
    return () => {
      disposed = true;
      ++sequence;
      clear();
      foreground.remove();
    };
  }, [titleId, attempt, focused, state.profile?.id, state.profile?.accountStatus]);

  function saveProgress(seconds: number) {
    position.current = seconds;
    if (saving.current || Date.now() - savedAt.current < 15000) return;
    saving.current = true;
    savedAt.current = Date.now();
    const userId = state.profile?.id;
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!userId || session?.user.id !== userId) return;
      const saved = await call('save_watch_progress', {
        p_title_id: titleId,
        p_position_seconds: seconds,
      });
      const current = await supabase.auth.getSession();
      if (current.data.session?.user.id === userId)
        dispatch({ type: 'progress', id: titleId, seconds, completed: saved?.completed });
    })()
      .catch(() =>
        setError('Your watch position could not be saved. It will retry while you watch.'),
      )
      .finally(() => {
        saving.current = false;
      });
  }
  return (
    <Surface>
      {grant ? (
        <VideoPlayback
          key={grant.hlsUrl}
          uri={grant.hlsUrl}
          resumeAt={position.current}
          onProgress={saveProgress}
          privateStream
          onRetry={() => setAttempt((value) => value + 1)}
        />
      ) : (
        <Label>{error ? 'Playback is unavailable.' : 'Preparing secure playback…'}</Label>
      )}
      <ErrorNote message={error} />
      {error && <Button title="Retry playback" onPress={() => setAttempt((value) => value + 1)} />}
    </Surface>
  );
}
