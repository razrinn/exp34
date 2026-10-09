import test from 'node:test';
import assert from 'node:assert/strict';
import { attackMarker, attackTiming, timeAttack, advanceAttack, attackQuality } from './attack-timing.js';

test('three correct timed keys yield full quality; partial and untouched sequences lose damage', () => {
  let timing = attackTiming(100, 3, () => 0);
  for (const [index, code] of timing.keys.entries()) timing = timeAttack(timing, code, 1300 + index * 2400);
  assert.equal(attackQuality(timing), 1);
  assert.equal(attackQuality(timeAttack(attackTiming(0, 3, () => 0), 'KeyI', 1200)), 1 / 3);
  assert.deepEqual(advanceAttack(attackTiming(0, 3, () => 0), 7200).results, [false, false, false]);
  assert.equal(attackQuality(advanceAttack(attackTiming(0, 3, () => 0), 7200)), 0);
});

test('timing boundaries are inclusive and each beat permits one attempt', () => {
  for (const now of [950, 1450]) assert.equal(timeAttack(attackTiming(0, 3, () => 0), 'KeyI', now).results[0], true);
  for (const now of [949, 1451]) assert.equal(timeAttack(attackTiming(0, 3, () => 0), 'KeyI', now).results[0], false);
  let timing = timeAttack(attackTiming(0, 3, () => 0), 'KeyO', 1200);
  timing = timeAttack(timing, 'KeyI', 1200);
  assert.equal(timing.results[0], false);
  timing = timeAttack(timing, 'KeyI', 3600);
  assert.deepEqual(timing.results, [false, true, null]);
  assert.deepEqual(timeAttack(timing, 'KeyP', 8000).results, [false, true, false]);
});

test('prompts randomize independently among I/O/P and require the shown key', () => {
  const random = [.99, 0, .5][Symbol.iterator]();
  const timing = attackTiming(0, 3, () => random.next().value);
  assert.deepEqual(timing.keys, ['KeyP', 'KeyI', 'KeyO']);
  assert.equal(timeAttack(timing, 'KeyI', 1200).results[0], false);
  assert.equal(timeAttack(timing, 'KeyP', 1200).results[0], true);
});

test('marker travels clockwise from top and matches the entire upper-left timing segment', () => {
  assert.deepEqual(attackMarker(0), { x: 50, y: 6 });
  assert.deepEqual(attackMarker(950 / 3), { x: 94, y: 50 });
  assert.deepEqual(attackMarker(950 * 2 / 3), { x: 50, y: 94 });
  assert.deepEqual(attackMarker(950), { x: 6, y: 50 });
  assert.deepEqual(attackMarker(1200), { x: 28, y: 28 });
  assert.deepEqual(attackMarker(1450), { x: 50, y: 6 });
  assert.deepEqual(attackMarker(1600), attackMarker(1450));
});

test('prompt count follows 2/3/4 strikes and future prompts cannot be consumed during recovery', () => {
  for (const count of [2, 3, 4]) {
    let timing = attackTiming(0, count, () => 0);
    assert.equal(timing.keys.length, count);
    for (let index = 0; index < count; index++) timing = timeAttack(timing, 'KeyI', index * 2400 + 1200);
    assert.equal(attackQuality(timing), 1);
  }
  let timing = timeAttack(attackTiming(0, 4, () => 0), 'KeyI', 1200);
  timing = timeAttack(timing, 'KeyP', 1800);
  assert.deepEqual(timing.results, [true, null, null, null]);
});
