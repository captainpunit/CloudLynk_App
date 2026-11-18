import assert from 'node:assert/strict';
import test from 'node:test';
import { isMetaAdReferrer } from '../ad-referrer';

test('Meta ad installs are recognised from the Play install referrer', () => {
  assert.equal(
    isMetaAdReferrer('utm_source=apps.facebook.com&utm_campaign=fb4a&utm_content=%7B%7D'),
    true,
  );
  assert.equal(isMetaAdReferrer('utm_source=apps.instagram.com&utm_campaign=ig4a'), true);
  assert.equal(isMetaAdReferrer('utm_source=APPS.FACEBOOK.COM'), true);
});

test('other installs are organic', () => {
  assert.equal(isMetaAdReferrer('utm_source=google-play&utm_medium=organic'), false);
  assert.equal(isMetaAdReferrer('utm_source=apps.facebook.com.evil.example'), false);
  assert.equal(isMetaAdReferrer('utm_source=facebook'), false);
  assert.equal(isMetaAdReferrer(''), false);
  assert.equal(isMetaAdReferrer(null), false);
});
