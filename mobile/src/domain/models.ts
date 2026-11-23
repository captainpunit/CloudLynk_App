/** UI-facing models. Database rows are mapped at the repository boundary. */
/** Free text chosen by the channel owner (backend: 1-40 characters). */
export type Category = string;
export type ChannelAudience = 'organic' | 'ads' | 'both';
export type ChannelVisibility = 'public' | 'premium' | 'private';
export type ChannelStatus = 'published' | 'pending' | 'hidden';
export interface Channel {
  id: string;
  name: string;
  description: string;
  category: Category;
  cover: string;
  ownerId: string;
  visibility: ChannelVisibility;
  status: ChannelStatus;
  /** Who the channel is shown to; members who came from an advert see every channel. */
  audience: ChannelAudience;
  /** Why an administrator hid the channel; shown to its owner. */
  reviewNote?: string;
}
export interface Video {
  id: string;
  channelId: string;
  title: string;
  description: string;
  cover: string;
  publishedAt: string;
  kind?: 'movie' | 'series' | 'episode';
  seasonId?: string;
  episodeNumber?: number;
}
export interface DriveFile {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'audio' | 'document' | 'other' | 'folder';
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
  /** 'ads' when the member came from an advert. */
  audience?: 'organic' | 'ads';
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
  /** When each title was last watched (ISO time), for ordering "Continue watching". */
  lastWatched?: Record<string, string>;
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
  /** When the current Plus period ends; null without Plus. */
  subscribedUntil?: string | null;
  completedIds?: string[];
  plans?: Plan[];
}
/** A plan that can be bought now: active and priced in the backend. */
export interface Plan {
  productId: string;
  name: string;
  billingPeriod: string;
  quotaBytes: number;
  pricePaise: number;
}
export type AccessDecision =
  | 'allowed'
  | 'sign_in_required'
  | 'account_restricted'
  | 'channel_unavailable'
  | 'subscription_required'
  | 'membership_required'
  | 'private_channel';
