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


import { playerClipProgress, enemyAttackPose, PLAYER_IMPACT_MS, PLAYER_ACTION_MS, HOME_X, STRIKE_REACH, ENEMY_STEP_BACK_MS, retreatDistance } from './animation.js';
test('approach reaches contact at damage time, then retreats with the clip', () => {
  for (const [kind, contact] of [['attack', .2], ['heavy', .65], ['counter', .35]]) {
    assert.equal(actionPose(kind, 0).x, 0);
    assert.equal(actionPose(kind, PLAYER_IMPACT_MS).x, STRIKE_REACH);
    assert.equal(playerClipProgress(kind, PLAYER_IMPACT_MS), contact);
    assert.equal(playerClipProgress(kind, PLAYER_ACTION_MS), 1);
    assert.equal(actionPose(kind, PLAYER_ACTION_MS).x, 0);
  }
});

test('enemy arrives at the same contact pose for slow and fast strikes', () => {
  for (const duration of [400, 1500, 2400]) {
    assert.deepEqual(enemyAttackPose(duration, duration, 0), { x: 0, clip: 0 });
    assert.deepEqual(enemyAttackPose(0, duration, 0), { x: STRIKE_REACH, clip: .65 });
    assert.deepEqual(enemyAttackPose(-100, duration, 0), enemyAttackPose(0, duration, 0));
    assert.equal(enemyAttackPose(duration, duration, 1).x, duration <= 500 ? STRIKE_REACH - 1 : 0);
  }
});

import { ENEMY_ATTACKS } from './animation.js';
import { ENEMIES, BOSS } from './combat.js';
test('every enemy selects three distinct clips and reaches its contact pose at each hit', () => {
  for (const enemy of [...ENEMIES, BOSS]) {
    assert.equal(new Set(enemy.attackStyles.map(style => ENEMY_ATTACKS[style].clip)).size, 3);
    for (const [patternIndex, hits] of enemy.patterns.entries()) {
      const style = enemy.attackStyles[patternIndex];
      const attack = ENEMY_ATTACKS[style];
      for (const [hitIndex, hit] of hits.entries()) {
        const duration = hit.time - (hits[hitIndex - 1]?.time || 0);
        const start = enemyAttackPose(duration, duration, hitIndex, style);
        const contact = enemyAttackPose(0, duration, hitIndex, style);
        assert.equal(start.clip, 0);
        assert.equal(contact.clip, attack.contact);
        assert.equal(contact.x, STRIKE_REACH);
        assert.deepEqual(enemyAttackPose(-20, duration, hitIndex, style), contact);
      }
    }
  }
});

test('delayed thrust holds its drawn-back pose until the final swing', () => {
  const early = enemyAttackPose(1800, 2400, 0, 'thrust');
  const held = enemyAttackPose(400, 2400, 0, 'thrust');
  assert.equal(early.clip, .2);
  assert.equal(held.clip, early.clip);
  assert.equal(enemyAttackPose(180, 2400, 0, 'thrust').clip, .2);
  assert.ok(enemyAttackPose(90, 2400, 0, 'thrust').clip > held.clip);
});


test('fast follow-ups step back briefly while slower strikes retreat fully', () => {
  assert.ok(2 * HOME_X > STRIKE_REACH);
  for (const duration of [400, 700, 1500]) {
    assert.equal(enemyAttackPose(duration, duration, 1).x, duration <= 500 ? STRIKE_REACH - 1 : 0);
    const hold = duration <= 500 ? STRIKE_REACH - 1 : 0;
    assert.equal(enemyAttackPose(duration - ENEMY_STEP_BACK_MS, duration, 1).x, hold);
    assert.equal(retreatDistance(ENEMY_STEP_BACK_MS, ENEMY_STEP_BACK_MS, hold), hold);
    assert.equal(retreatDistance(0, ENEMY_STEP_BACK_MS), STRIKE_REACH);
    assert.equal(retreatDistance(ENEMY_STEP_BACK_MS, ENEMY_STEP_BACK_MS), 0);
    assert.equal(retreatDistance(300, ENEMY_STEP_BACK_MS), 0);
    assert.equal(enemyAttackPose(0, duration, 1).x, STRIKE_REACH);
  }
});


import { attackEffects } from './animation.js';
test('charge builds before impact and each cue is brief, including fast follow-ups', () => {
  for (const duration of [400, 700, 1400, 2400]) {
    const lead = Math.min(650, duration - 80);
    const end = Math.min(320, duration * .35);
    assert.equal(attackEffects(duration, duration).cue, false);
    assert.equal(attackEffects((lead + end) / 2, duration).cue, true);
    assert.equal(attackEffects(end, duration).cue, false);
    assert.equal(attackEffects(0, duration).cue, false);
    assert.equal(attackEffects(-20, duration).charge, 0);
    assert.ok(attackEffects(50, duration, 'chop').charge > attackEffects(200, duration, 'chop').charge);
    assert.ok(attackEffects(50, duration, 'chop').charge > attackEffects(50, duration, 'slash').charge);
  }
});


import { enemyWindupPose } from './animation.js';
test('three wind-ups prepare early, hold distinct stances, and release at contact', () => {
  const poses = ['slash', 'chop', 'thrust'].map(style => enemyWindupPose(900, 1500, style));
  assert.ok(poses[0].twist > 0);
  assert.ok(poses[1].lift > 0);
  assert.ok(poses[2].lean < poses[0].lean);
  assert.ok(poses[2].twist < 0);
  for (const style of ['slash', 'chop', 'thrust']) {
    assert.deepEqual(enemyWindupPose(900, 1500, style), enemyWindupPose(600, 1500, style));
    const contact = enemyWindupPose(0, 1500, style);
    for (const value of Object.values(contact)) assert.equal(Math.abs(value), 0);
    assert.equal(enemyAttackPose(900, 1500, 0, style).clip, ENEMY_ATTACKS[style].windup);
  }
});


import { deathClipProgress, DEATH_MS } from './animation.js';
test('death clip advances once and holds its final skeletal pose', () => {
  assert.equal(deathClipProgress(-320), 0);
  assert.equal(deathClipProgress(0), 0);
  assert.equal(deathClipProgress(DEATH_MS / 2), .5);
  assert.equal(deathClipProgress(DEATH_MS), 1);
  assert.equal(deathClipProgress(DEATH_MS + 10000), 1);
});

test('basic slash stays low while Heavy jumps and lands before recovery ends', () => {
  assert.ok(actionPose('attack', 160).lift < 0);
  assert.ok(actionPose('heavy', 160).lift > .5);
  assert.ok(actionPose('heavy', PLAYER_IMPACT_MS).lift > .5);
  assert.equal(actionPose('heavy', 500).lift, 0);
  assert.equal(actionPose('heavy', PLAYER_ACTION_MS).lift, 0);
  assert.equal(actionPose('attack', PLAYER_IMPACT_MS).x, STRIKE_REACH);
  assert.equal(actionPose('heavy', PLAYER_IMPACT_MS).x, STRIKE_REACH);
});
