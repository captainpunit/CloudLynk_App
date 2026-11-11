import type { Video, Workspace } from './models';

export function compactNumber(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(value);
}
export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const unit = bytes >= 1024 ** 3 ? 3 : bytes >= 1024 ** 2 ? 2 : 1;
  return `${(bytes / 1024 ** unit).toFixed(1)} ${['B', 'KB', 'MB', 'GB'][unit]}`;
}
export const kindLabels = { movie: 'Movie', series: 'Series', episode: 'Episode' } as const;
export function videoLabel(video: Pick<Video, 'kind' | 'episodeNumber'>): string {
  if (video.kind === 'episode' && video.episodeNumber) return `Episode ${video.episodeNumber}`;
  return video.kind ? kindLabels[video.kind] : '';
}
/** What Plus offers today, from active plans and the published catalogue. Null without plans. */
export function plusSummary({ plans = [], channels }: Pick<Workspace, 'plans' | 'channels'>) {
  if (!plans.length) return null;
  const count = channels.filter(
    (channel) => channel.status === 'published' && channel.visibility === 'premium',
  ).length;
  const quota = Math.max(...plans.map((plan) => plan.quotaBytes));
  const watch = count
    ? `Watch ${count === 1 ? 'the Plus channel' : `all ${count} Plus channels`}`
    : 'Watch every Plus channel';
  return quota > 0 ? `${watch}, with up to ${fileSize(quota)} of storage.` : `${watch}.`;
}
/** A date such as "10 Dec 2026". */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
export function validateChannel(name: string, description: string): string | null {
  if (name.trim().length < 3) return 'Use at least 3 characters for your channel name.';
  if (name.trim().length > 60) return 'Keep your channel name under 60 characters.';
  if (description.trim().length < 12) return 'Add a description of at least 12 characters.';
  return null;
}
