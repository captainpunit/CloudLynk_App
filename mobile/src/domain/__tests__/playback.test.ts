import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampSeek,
  formatTime,
  isFinished,
  nextSkip,
  shouldSaveProgress,
  speedLabel,
  startPosition,
  trackName,
} from '../playback';

test('times read like a video player', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(9.7), '0:09');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(-3), '0:00');
  assert.equal(formatTime(Number.NaN), '0:00');
});

test('a video counts as finished in its last seconds', () => {
  assert.equal(isFinished(590, 600), true);
  assert.equal(isFinished(500, 600), false);
  // Short clips use a smaller margin, so a 60 s clip is not finished at 45 s.
  assert.equal(isFinished(45, 60), false);
  assert.equal(isFinished(58, 60), true);
  assert.equal(isFinished(10, 0), false);
});

test('playback resumes where the member stopped, except at the very start or end', () => {
  assert.equal(startPosition(312, 1200), 312);
  assert.equal(startPosition(3, 1200), 0);
  assert.equal(startPosition(1195, 1200), 0);
  assert.equal(startPosition(600, 1200, true), 0);
  // Duration not known yet: trust the saved place.
  assert.equal(startPosition(312, 0), 312);
});

test('seeking stays inside the video', () => {
  assert.equal(clampSeek(-10, 600), 0);
  assert.equal(clampSeek(700, 600), 599.5);
  assert.equal(clampSeek(120, 600), 120);
  assert.equal(clampSeek(120, 0), 120);
});

test('the loading position never overwrites the resume point', () => {
  // Resuming at 5:12: the player reports 0 while the stream loads.
  assert.equal(shouldSaveProgress(0, 312, false), false);
  assert.equal(shouldSaveProgress(311, 312, false), true);
  // Once resumed, rewinding to the start is saved like anything else.
  assert.equal(shouldSaveProgress(0, 312, true), true);
  // Nothing to resume: save from the start.
  assert.equal(shouldSaveProgress(4, 0, false), true);
});

test('speeds read as Normal or a multiple', () => {
  assert.equal(speedLabel(1), 'Normal');
  assert.equal(speedLabel(1.5), '1.5×');
  assert.equal(speedLabel(0.75), '0.75×');
});

test('tracks are named by label, then name, then language', () => {
  assert.equal(trackName({ label: 'English', language: 'en' }), 'English');
  assert.equal(trackName({ label: ' ', name: 'Director', language: 'en' }), 'Director');
  assert.equal(trackName({ label: '', language: 'hi' }), 'hi');
  assert.equal(trackName({}), 'Unnamed');
});

test('repeated skips on one side add up; the other side starts again', () => {
  const first = nextSkip(null, 'forward');
  assert.deepEqual(first, { side: 'forward', amount: 10 });
  const second = nextSkip(first, 'forward');
  assert.deepEqual(second, { side: 'forward', amount: 20 });
  assert.deepEqual(nextSkip(second, 'forward'), { side: 'forward', amount: 30 });
  assert.deepEqual(nextSkip(second, 'back'), { side: 'back', amount: 10 });
});
