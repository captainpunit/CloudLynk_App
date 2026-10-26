import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoAccess } from '../access';
import type { Channel, Profile } from '../models';
const member: Profile = {
  id: 'member',
  name: 'Test member',
  email: 'test@example.com',
  role: 'member',
  accountStatus: 'active',
};
const channel: Channel = {
  id: 'channel',
  name: 'Channel',
  description: 'Test',
  category: 'Travel',
  cover: '',
  members: 0,
  ownerId: 'owner',
  visibility: 'public',
  status: 'published',
};
test('guests must sign in even with a preview plan', () =>
  assert.equal(demoAccess(null, channel, true, true, 'watch'), 'sign_in_required'));
test('restricted accounts cannot watch', () =>
  assert.equal(
    demoAccess({ ...member, accountStatus: 'restricted' }, channel, true, true, 'watch'),
    'account_restricted',
  ));
test('unpublished channels stay unavailable', () =>
  assert.equal(
    demoAccess(member, { ...channel, status: 'pending' }, true, true, 'watch'),
    'channel_unavailable',
  ));
test('membership does not replace an entitlement', () =>
  assert.equal(
    demoAccess(member, { ...channel, visibility: 'premium' }, false, true, 'watch'),
    'subscription_required',
  ));
test('entitlement does not replace membership', () =>
  assert.equal(
    demoAccess(member, { ...channel, visibility: 'premium' }, true, false, 'watch'),
    'membership_required',
  ));
test('admins do not get free premium access', () =>
  assert.equal(
    demoAccess(
      { ...member, role: 'admin' },
      { ...channel, visibility: 'premium' },
      false,
      true,
      'watch',
    ),
    'subscription_required',
  ));
test('private channels stay private with Plus', () =>
  assert.equal(
    demoAccess(member, { ...channel, visibility: 'private' }, true, true, 'watch'),
    'private_channel',
  ));
test('public channels can be joined before watching', () =>
  assert.equal(demoAccess(member, channel, false, false, 'join'), 'allowed'));
test('joined subscribed members can watch premium', () =>
  assert.equal(
    demoAccess(member, { ...channel, visibility: 'premium' }, true, true, 'watch'),
    'allowed',
  ));
