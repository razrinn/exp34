import test from 'node:test';
import assert from 'node:assert/strict';
import { attackMarker, attackTiming, timeAttack, advanceAttack, attackQuality } from './attack-timing.js';

test('three correct timed keys yield full quality; partial and untouched sequences lose damage', () => {
  let timing = attackTiming(100, () => 0);
  for (const [index, code] of timing.keys.entries()) timing = timeAttack(timing, code, 800 + index * 900);
  assert.equal(attackQuality(timing), 1);
  assert.equal(attackQuality(timeAttack(attackTiming(0, () => 0), 'KeyI', 700)), 1 / 3);
  assert.deepEqual(advanceAttack(attackTiming(0, () => 0), 2700).results, [false, false, false]);
  assert.equal(attackQuality(advanceAttack(attackTiming(0, () => 0), 2700)), 0);
});

test('timing boundaries are inclusive and each beat permits one attempt', () => {
  for (const now of [580, 820]) assert.equal(timeAttack(attackTiming(0, () => 0), 'KeyI', now).results[0], true);
  for (const now of [579, 821]) assert.equal(timeAttack(attackTiming(0, () => 0), 'KeyI', now).results[0], false);
  let timing = timeAttack(attackTiming(0, () => 0), 'KeyO', 700);
  timing = timeAttack(timing, 'KeyI', 700);
  assert.equal(timing.results[0], false);
  timing = timeAttack(timing, 'KeyI', 1600);
  assert.deepEqual(timing.results, [false, true, null]);
  assert.deepEqual(timeAttack(timing, 'KeyP', 4000).results, [false, true, false]);
});

test('prompts randomize independently among I/O/P and require the shown key', () => {
  const random = [.99, 0, .5][Symbol.iterator]();
  const timing = attackTiming(0, () => random.next().value);
  assert.deepEqual(timing.keys, ['KeyP', 'KeyI', 'KeyO']);
  assert.equal(timeAttack(timing, 'KeyI', 700).results[0], false);
  assert.equal(timeAttack(timing, 'KeyP', 700).results[0], true);
});

test('marker travels clockwise from top and matches the entire upper-left timing segment', () => {
  assert.deepEqual(attackMarker(0), { x: 50, y: 6 });
  assert.deepEqual(attackMarker(580 / 3), { x: 94, y: 50 });
  assert.deepEqual(attackMarker(580 * 2 / 3), { x: 50, y: 94 });
  assert.deepEqual(attackMarker(580), { x: 6, y: 50 });
  assert.deepEqual(attackMarker(700), { x: 28, y: 28 });
  assert.deepEqual(attackMarker(820), { x: 50, y: 6 });
  assert.deepEqual(attackMarker(900), attackMarker(820));
});
