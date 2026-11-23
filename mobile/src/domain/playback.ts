/** Rules for the video player that do not depend on React or the native player. */

/** Seconds skipped by the back/forward buttons and by double-tapping. */
export const SKIP_SECONDS = 10;

/** Within this many seconds of the end, a video counts as finished. */
const END_MARGIN_SECONDS = 15;

/** 75 → "1:15", 3725 → "1:02:05". Negative or unknown values show as "0:00". */
export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** True when the position is close enough to the end to count as watched. */
export function isFinished(position: number, duration: number): boolean {
  return duration > 0 && position >= duration - Math.min(END_MARGIN_SECONDS, duration * 0.05);
}

/**
 * Where to start playing. A finished video (or one saved within its last seconds) starts
 * again from the beginning instead of at the credits.
 */
export function startPosition(saved: number, duration: number, completed = false): number {
  if (completed || !Number.isFinite(saved) || saved < 5) return 0;
  if (duration > 0 && isFinished(saved, duration)) return 0;
  return saved;
}

/** A seek target kept inside the video. */
export function clampSeek(target: number, duration: number): number {
  if (!Number.isFinite(target) || target < 0) return 0;
  return duration > 0 ? Math.min(target, Math.max(0, duration - 0.5)) : target;
}

/**
 * Whether a progress report should be saved. Reports that arrive before the player has
 * reached the resume point (it starts at 0 while the stream loads) would overwrite the
 * member's place with 0.
 */
export function shouldSaveProgress(position: number, resumeAt: number, resumed: boolean): boolean {
  if (!Number.isFinite(position) || position < 0) return false;
  if (resumed) return true;
  return resumeAt <= 0 || position >= resumeAt - 2;
}

/** Playback speeds offered in the player, slowest first. */
export const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** 1 → "Normal", 1.5 → "1.5×", 0.75 → "0.75×". */
export function speedLabel(rate: number): string {
  return rate === 1 ? 'Normal' : `${rate}×`;
}

/** How a subtitle or audio track is named in the player: its label, else its language. */
export function trackName(track: { label?: string; name?: string; language?: string }): string {
  const named = track.label?.trim() || track.name?.trim() || track.language?.trim();
  return named || 'Unnamed';
}

/**
 * The skip shown on screen. Taps on the same side while the last skip is still showing add
 * up (+10, +20, +30), the way streaming apps count them; the other side starts again.
 */
export function nextSkip(
  previous: { side: 'back' | 'forward'; amount: number } | null,
  side: 'back' | 'forward',
): { side: 'back' | 'forward'; amount: number } {
  return previous && previous.side === side
    ? { side, amount: previous.amount + SKIP_SECONDS }
    : { side, amount: SKIP_SECONDS };
}
