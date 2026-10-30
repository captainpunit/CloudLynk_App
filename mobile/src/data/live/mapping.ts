import type { Tables } from '@/lib/database.types';
import type { Channel, DriveFile, Video } from '@/domain/models';

export function mapChannel(row: Tables<'channels'>): Channel {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    visibility: row.is_private ? 'private' : row.requires_subscription ? 'premium' : 'public',
    status:
      row.status === 'published' ? 'published' : row.status === 'draft' ? 'pending' : 'hidden',
    category: row.category as Channel['category'],
    cover: row.cover_url ?? '',
    ownerId: row.created_by ?? '',
    members: 0,
  };
}
export function mapTitle(row: Tables<'titles'>): Video {
  return {
    id: row.id,
    channelId: row.channel_id,
    title: row.name,
    description: row.description,
    cover: row.cover_url ?? '',
    duration: row.kind === 'series' ? 'Series' : 'Video',
    views: 0,
    publishedAt: row.published_at ?? row.created_at,
    kind: row.kind as Video['kind'],
    seasonId: row.season_id ?? undefined,
    episodeNumber: row.episode_number ?? undefined,
  };
}
export function mapFile(row: Tables<'files'>): DriveFile {
  return {
    id: row.id,
    name: row.name,
    bytes: row.size_bytes,
    createdAt: row.created_at,
    kind: row.category === 'image' ? 'image' : row.category === 'video' ? 'video' : 'document',
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    status: row.status as DriveFile['status'],
    expiresAt: row.expires_at ?? undefined,
  };
}
export async function readPages<T>(
  load: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 200) {
    const { data, error } = await load(from, from + 199);
    if (error) throw new Error('Could not load your data. Please try again.');
    rows.push(...(data ?? []));
    if (!data || data.length < 200) return rows;
  }
}
