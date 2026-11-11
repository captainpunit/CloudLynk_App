import type { Channel, Video, Workspace } from '@/domain/models';

type Catalogue = Pick<Workspace, 'channels' | 'videos' | 'seasons'>;

const newestFirst = (a: Video, b: Video) => b.publishedAt.localeCompare(a.publishedAt);

/** Published channels anyone can find; private channels are reached by invitation. */
export function listedChannels({ channels }: Pick<Workspace, 'channels'>): Channel[] {
  return channels.filter(
    (channel) => channel.status === 'published' && channel.visibility !== 'private',
  );
}

export function channelOf({ channels }: Pick<Workspace, 'channels'>, video: Video) {
  return channels.find((channel) => channel.id === video.channelId);
}

/**
 * Titles worth a poster, newest first: movies, series and loose videos. Episodes stay inside
 * their series when the series is loaded.
 */
export function browsableVideos(state: Catalogue, channelIds?: Set<string>): Video[] {
  const seasons = new Set((state.seasons ?? []).map((season) => season.id));
  const listed = channelIds ?? new Set(listedChannels(state).map((channel) => channel.id));
  return state.videos
    .filter(
      (video) =>
        listed.has(video.channelId) &&
        !(video.kind === 'episode' && video.seasonId && seasons.has(video.seasonId)),
    )
    .sort(newestFirst);
}

/** Started and not finished, most recent first. */
export function continueWatching(
  state: Catalogue & Pick<Workspace, 'progress' | 'completedIds'>,
): Video[] {
  const completed = new Set(state.completedIds ?? []);
  const published = new Set(
    state.channels.filter((channel) => channel.status === 'published').map((item) => item.id),
  );
  return state.videos
    .filter(
      (video) =>
        published.has(video.channelId) &&
        (state.progress[video.id] ?? 0) > 0 &&
        !completed.has(video.id),
    )
    .sort(newestFirst);
}

/** "Resume at 4:05" or "Resume at 1:02:09". */
export function resumeLabel(seconds: number): string {
  const whole = Math.floor(seconds);
  const parts = [Math.floor(whole / 3600), Math.floor(whole / 60) % 60, whole % 60];
  const clock = parts[0]
    ? `${parts[0]}:${String(parts[1]).padStart(2, '0')}:${String(parts[2]).padStart(2, '0')}`
    : `${parts[1]}:${String(parts[2]).padStart(2, '0')}`;
  return `Resume at ${clock}`;
}

/** "1 video", "12 videos". */
export function count(value: number, noun: string): string {
  return `${value} ${noun}${value === 1 ? '' : 's'}`;
}
