import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { playbackToken } from '@/data/live/backend';
import { BackendError } from '@/data/live/invoke-backend';

export type PlaybackProblem = {
  message: string;
  /** subscription_required means Plus ended: offer to renew instead of retrying. */
  code?: string;
};

/** Seconds of validity left, by the server's clock when it says so. */
function secondsLeft(grant: { expiresAt: string; expiresIn?: number }, receivedAt: number) {
  if (typeof grant.expiresIn === 'number' && Number.isFinite(grant.expiresIn))
    return grant.expiresIn - (Date.now() - receivedAt) / 1000;
  return (Date.parse(grant.expiresAt) - Date.now()) / 1000;
}

/**
 * The signed stream address for a title, kept valid while the screen is open.
 *
 * The address changes when it is renewed; the player swaps it in place, so renewal never
 * interrupts the picture. A renewal that fails is retried until the old address really
 * expires. Leaving the screen drops the address; the next visit asks again.
 */
export function usePlaybackGrant(titleId: string, active: boolean, identity: string | undefined) {
  const [uri, setUri] = useState<string | null>(null);
  const [problem, setProblem] = useState<PlaybackProblem | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = useRef<{ expiresAt: string; expiresIn?: number; receivedAt: number } | null>(
    null,
  );

  useEffect(() => {
    if (!active) {
      setUri(null);
      current.current = null;
      return;
    }
    let disposed = false;
    let sequence = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (seconds: number) => {
      clearTimeout(timer);
      timer = setTimeout(() => void load(), Math.max(5, seconds) * 1000);
    };
    const load = async (failures = 0): Promise<void> => {
      const request = ++sequence;
      clearTimeout(timer);
      try {
        const grant = await playbackToken(titleId);
        if (disposed || request !== sequence) return;
        if (!grant.hlsUrl.startsWith('https://')) throw new Error('Invalid stream address.');
        const receivedAt = Date.now();
        const previous = current.current;
        current.current = { ...grant, receivedAt };
        setUri(grant.hlsUrl);
        setProblem(null);
        const left = secondsLeft(grant, receivedAt);
        // The same expiry again means it is capped by the end of Plus: nothing to extend.
        if (previous?.expiresAt === grant.expiresAt) return;
        if (left > 60) schedule(left - 45);
      } catch (cause) {
        if (disposed || request !== sequence) return;
        const code = cause instanceof BackendError ? cause.code : undefined;
        const held = current.current;
        const left = held ? secondsLeft(held, held.receivedAt) : 0;
        // Keep playing on the address we have while it lasts; try again shortly.
        if (!code && left > 20 && failures < 4) {
          timer = setTimeout(() => void load(failures + 1), Math.min(15, left / 3) * 1000);
          return;
        }
        if (!held || left <= 0 || code) setUri(null);
        setProblem({
          message:
            cause instanceof Error && cause.message
              ? cause.message
              : 'The video could not be loaded. Check your connection and try again.',
          code,
        });
      }
    };
    void load();
    // Back from the background: the address may have run out while the phone slept.
    const foreground = AppState.addEventListener('change', (status) => {
      const held = current.current;
      if (status === 'active' && (!held || secondsLeft(held, held.receivedAt) < 90)) void load();
    });
    return () => {
      disposed = true;
      ++sequence;
      clearTimeout(timer);
      foreground.remove();
    };
  }, [titleId, active, identity, attempt]);

  return { uri, problem, retry };
}
