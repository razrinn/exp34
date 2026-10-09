import test from 'node:test';
import assert from 'node:assert/strict';
import { attackTiming, timeAttack, advanceAttack, attackQuality } from './attack-timing.js';

test('three correct timed keys yield full quality; partial and untouched sequences lose damage', () => {
  let timing = attackTiming(100);
  for (const [index, code] of ['KeyI', 'KeyO', 'KeyP'].entries()) timing = timeAttack(timing, code, 800 + index * 900);
  assert.equal(attackQuality(timing), 1);
  assert.equal(attackQuality(timeAttack(attackTiming(0), 'KeyI', 700)), 1 / 3);
  assert.deepEqual(advanceAttack(attackTiming(0), 2700).results, [false, false, false]);
  assert.equal(attackQuality(advanceAttack(attackTiming(0), 2700)), 0);
});

test('timing boundaries are inclusive and each beat permits one attempt', () => {
  for (const now of [580, 820]) assert.equal(timeAttack(attackTiming(0), 'KeyI', now).results[0], true);
  for (const now of [579, 821]) assert.equal(timeAttack(attackTiming(0), 'KeyI', now).results[0], false);
  let timing = timeAttack(attackTiming(0), 'KeyO', 700);
  timing = timeAttack(timing, 'KeyI', 700);
  assert.equal(timing.results[0], false);
  timing = timeAttack(timing, 'KeyO', 1600);
  assert.deepEqual(timing.results, [false, true, null]);
  assert.deepEqual(timeAttack(timing, 'KeyP', 4000).results, [false, true, false]);
});
