import type { AccessDecision, Channel, Profile } from './models';

/** Demo policy only. Live access always comes from the server's my_access RPC. */
export function demoAccess(
  profile: Profile | null,
  channel: Channel | undefined,
  subscribed: boolean,
  joined: boolean,
  action: 'join' | 'watch',
): AccessDecision {
  if (!profile) return 'sign_in_required';
  if (profile.accountStatus !== 'active') return 'account_restricted';
  if (!channel || channel.status !== 'published') return 'channel_unavailable';
  if (channel.visibility === 'private' && channel.ownerId !== profile.id) return 'private_channel';
  if (channel.visibility === 'premium' && !subscribed) return 'subscription_required';
  if (action === 'watch' && !joined) return 'membership_required';
  return 'allowed';
}

export const accessMessages: Record<AccessDecision, string> = {
  allowed: '',
  sign_in_required: 'Sign in to keep your channels, files and watchlist together.',
  account_restricted: 'Your account is restricted. Please contact support.',
  channel_unavailable: 'This channel is not available right now.',
  subscription_required: 'Unlock this channel with CloudLynk Plus.',
  membership_required: 'Join this channel to start watching.',
  private_channel: 'This channel is private. Only its owner can open it.',
};
