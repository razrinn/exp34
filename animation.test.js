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
    const finished = actionPose(kind, 720);
    assert.equal(finished.active, false);
    for (const key of ['x', 'lift', 'lean', 'sword']) assert.ok(Math.abs(finished[key]) < 1e-10);
  }
  assert.ok(actionPose('attack', 150).x > 0);
  assert.ok(actionPose('dodge', 150).x < 0);
});


import { playerClipProgress, enemyAttackPose, PLAYER_IMPACT_MS, PLAYER_ACTION_MS } from './animation.js';
test('approach reaches contact at damage time, then retreats with the clip', () => {
  for (const [kind, contact] of [['attack', .2], ['heavy', .65], ['counter', .35]]) {
    assert.equal(actionPose(kind, 0).x, 0);
    assert.equal(actionPose(kind, PLAYER_IMPACT_MS).x, 1.4);
    assert.equal(playerClipProgress(kind, PLAYER_IMPACT_MS), contact);
    assert.equal(playerClipProgress(kind, PLAYER_ACTION_MS), 1);
    assert.equal(actionPose(kind, PLAYER_ACTION_MS).x, 0);
  }
});

test('enemy arrives at the same contact pose for slow and fast strikes', () => {
  for (const duration of [400, 1500, 2400]) {
    assert.deepEqual(enemyAttackPose(duration, duration, 0), { x: 0, clip: 0 });
    assert.deepEqual(enemyAttackPose(0, duration, 0), { x: 1.4, clip: .65 });
    assert.deepEqual(enemyAttackPose(-100, duration, 0), enemyAttackPose(0, duration, 0));
    assert.equal(enemyAttackPose(duration, duration, 1).x, 1.4);
  }
});
