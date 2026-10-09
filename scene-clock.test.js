import test from 'node:test';
import assert from 'node:assert/strict';
import { createSceneClock } from './scene-clock.js';

test('focus advances scene time at 15 percent and resumes without jumping', () => {
  let real = 100;
  const clock = createSceneClock(() => real);
  real += 200;
  assert.equal(clock.now(), 300);
  clock.focus(true);
  real += 1000;
  assert.equal(clock.now(), 450);
  clock.focus(true);
  real += 1000;
  clock.focus(false);
  assert.equal(clock.now(), 600);
  real += 320;
  assert.equal(clock.now(), 920);
  clock.focus(false);
  assert.equal(clock.now(), 920);
});
