import type { AccessDecision } from './models';

/** Access decisions always come from the server's my_access RPC; these are their messages. */
export const accessMessages: Record<AccessDecision, string> = {
  allowed: '',
  sign_in_required: 'Sign in to keep your channels, files and watchlist together.',
  account_restricted: 'Your account is restricted. Please contact support.',
  channel_unavailable: 'This channel is not available right now.',
  subscription_required: 'Unlock this channel with CloudLynk Plus.',
  membership_required: 'Join this channel to start watching.',
  private_channel: 'This channel is private. Only its owner can open it.',
};
