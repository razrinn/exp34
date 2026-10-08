import test from 'node:test';
import assert from 'node:assert/strict';
import { enemyPose } from './animation.js';

test('enemy winds up then swings toward the player at impact', () => {
  assert.deepEqual(enemyPose(1500, 1500), { x: 0, y: -0, rotation: 0 });
  assert.deepEqual(enemyPose(240, 1500), { x: 12, y: -10, rotation: 25 });
  assert.deepEqual(enemyPose(0, 1500), { x: -50, y: 0, rotation: -45 });
  assert.deepEqual(enemyPose(-100, 1500), enemyPose(0, 1500));
  assert.equal(enemyPose(120, 400).x, -19);
});

import { actionPose } from './animation.js';
test('player actions move and return to rest without changing combat timing', () => {
  for (const kind of ['attack', 'heavy', 'counter', 'dodge', 'parry', 'hit', 'heal']) {
    const middle = actionPose(kind, 150);
    assert.ok(middle.active);
    assert.ok([middle.x, middle.lift, middle.lean, middle.sword].some(v => Math.abs(v) > .01));
    const finished = actionPose(kind, 500);
    assert.equal(finished.active, false);
    for (const key of ['x', 'lift', 'lean', 'sword']) assert.ok(Math.abs(finished[key]) < 1e-10);
  }
  assert.ok(actionPose('attack', 150).x > 0);
  assert.ok(actionPose('dodge', 150).x < 0);
});
