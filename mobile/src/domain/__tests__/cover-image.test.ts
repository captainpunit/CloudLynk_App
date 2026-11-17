import assert from 'node:assert/strict';
import test from 'node:test';
import { coverMimeType } from '../cover-image';

test('uses the type the picker reports', () => {
  assert.equal(coverMimeType({ uri: 'file:///a', mimeType: 'image/png' }), 'image/png');
  assert.equal(coverMimeType({ uri: 'file:///a', mimeType: 'IMAGE/WEBP' }), 'image/webp');
});

test('treats image/jpg as image/jpeg', () => {
  assert.equal(coverMimeType({ uri: 'file:///a', mimeType: 'image/jpg' }), 'image/jpeg');
});

test('falls back to the file extension when no type is reported', () => {
  assert.equal(coverMimeType({ uri: 'file:///photos/IMG_1.JPEG' }), 'image/jpeg');
  assert.equal(coverMimeType({ uri: 'file:///photos/cover.png?size=2' }), 'image/png');
  assert.equal(coverMimeType({ uri: 'file:///photos/cover.webp', mimeType: null }), 'image/webp');
});

test('rejects types the covers bucket does not accept', () => {
  assert.equal(coverMimeType({ uri: 'file:///a.heic', mimeType: 'image/heic' }), null);
  assert.equal(coverMimeType({ uri: 'file:///a.gif' }), null);
  assert.equal(coverMimeType({ uri: 'file:///no-extension' }), null);
});
