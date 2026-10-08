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
