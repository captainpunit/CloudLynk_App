/** UI-facing models. Database rows are mapped at the repository boundary. */
/** Free text chosen by the channel owner (backend: 1-40 characters). */
export type Category = string;
export type ChannelVisibility = 'public' | 'premium' | 'private';
export type ChannelStatus = 'published' | 'pending' | 'hidden';
export interface Channel {
  id: string;
  name: string;
  description: string;
  category: Category;
  cover: string;
  members: number;
  ownerId: string;
  visibility: ChannelVisibility;
  status: ChannelStatus;
}
export interface Video {
  id: string;
  channelId: string;
  title: string;
  description: string;
  cover: string;
  duration: string;
  views: number;
  publishedAt: string;
  kind?: 'movie' | 'series' | 'episode';
  seasonId?: string;
  episodeNumber?: number;
}
export interface DriveFile {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'document' | 'folder';
  bytes: number;
  createdAt: string;
  uri?: string;
  parentId?: string;
  storagePath?: string;
  mimeType?: string;
  status?: 'pending' | 'ready';
  expiresAt?: string;
}
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'admin';
  accountStatus: 'active' | 'restricted';
  canPublish?: boolean;
  birthDate?: string;
}
export interface Workspace {
  version: 1;
  profile: Profile | null;
  channels: Channel[];
  videos: Video[];
  joinedIds: string[];
  savedIds: string[];
  files: DriveFile[];
  progress: Record<string, number>;
  noticesRead: boolean;
  seasons?: { id: string; seriesId: string; number: number; name: string }[];
  driveUsage?: {
    used_bytes: number;
    reserved_bytes: number;
    quota_bytes: number;
    max_file_bytes: number;
    can_upload: boolean;
  };
  notices?: { id: string; title: string; body: string; readAt: string | null; createdAt: string }[];
  subscribed?: boolean;
  completedIds?: string[];
}
export type AccessDecision =
  | 'allowed'
  | 'sign_in_required'
  | 'account_restricted'
  | 'channel_unavailable'
  | 'subscription_required'
  | 'membership_required'
  | 'private_channel';
