import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadName } from '../files';

test('downloads keep their own names, in any language', () => {
  assert.equal(downloadName('भारत की रसोई.mp4'), 'भारत की रसोई.mp4');
  assert.equal(downloadName('Résumé 2026.pdf'), 'Résumé 2026.pdf');
});

test('only characters a file name cannot hold are replaced', () => {
  assert.equal(downloadName('a/b\\c.pdf'), 'a_b_c.pdf');
  assert.equal(downloadName('tab\there.txt'), 'tab_here.txt');
  assert.equal(downloadName('   '), 'file');
});
