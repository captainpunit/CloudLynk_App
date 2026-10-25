/** UI-facing models. Database rows are mapped at the repository boundary. */
export type Category = 'All' | 'Travel' | 'Films' | 'Design' | 'Music' | 'Lifestyle';
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
  /** Only demo assets use a public URI. Production playback requires a signed token. */
  demoUri?: string;
}
export interface DriveFile {
  id: string;
  name: string;
  kind: 'image' | 'video' | 'document' | 'folder';
  bytes: number;
  createdAt: string;
  uri?: string;
  parentId?: string;
}
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'admin';
  accountStatus: 'active' | 'restricted';
}
export interface Plan {
  id: string;
  name: string;
  priceLabel: string;
  period: string;
  storageLabel: string;
  featured?: boolean;
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
  demoPlanId: string | null;
  noticesRead: boolean;
  reports: ContentReport[];
}
export interface ContentReport {
  id: string;
  videoId: string;
  reason: string;
  details: string;
  createdAt: string;
  resolved: boolean;
}
export type AccessDecision =
  | 'allowed'
  | 'sign_in_required'
  | 'account_restricted'
  | 'channel_unavailable'
  | 'subscription_required'
  | 'membership_required'
  | 'private_channel';
