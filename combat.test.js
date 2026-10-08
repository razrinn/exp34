import test from 'node:test';
import assert from 'node:assert/strict';
import { newCombat, attack, parry, retaliate, advanceEnemy, ENEMY_ATTACK, PARRY_WINDOW_MS } from './combat.js';

function perfectCombo(state) {
  for (const offset of ENEMY_ATTACK.impactTimes) {
    const impact = state.comboStartedAt + offset;
    state = advanceEnemy(parry(state, impact), impact);
  }
  return state;
}

test('misses resolve individually and the turn ends after the final hit', () => {
  let state = attack(newCombat(), 100);
  assert.equal(attack(state), state);
  assert.equal(advanceEnemy(state, 1599), state);
  state = advanceEnemy(state, 1600);
  assert.equal(state.playerHp, 24);
  assert.equal(state.hitIndex, 1);
  assert.equal(state.impactAt, 2300);
  assert.equal(state.phase, 'enemy');
  state = advanceEnemy(state, 3200);
  assert.equal(state.playerHp, 12);
  assert.equal(state.enemyHp, 16);
  assert.equal(state.phase, 'player');
});

test('parries block individual hits; only a perfect combo counters', () => {
  const incoming = attack(newCombat(), 100);
  const first = advanceEnemy(parry(incoming, incoming.impactAt), incoming.impactAt);
  assert.equal(first.playerHp, 30);
  assert.equal(first.enemyHp, 16);
  assert.equal(first.parryResult, null);
  const result = perfectCombo(incoming);
  assert.equal(result.playerHp, 30);
  assert.equal(result.enemyHp, 12);
  assert.equal(result.phase, 'player');
});

test('missing a middle hit prevents a counter even with a final parry', () => {
  let state = attack(newCombat());
  state = advanceEnemy(parry(state, 1500), 1500);
  state = advanceEnemy(state, 2200);
  state = advanceEnemy(parry(state, 3100), 3100);
  assert.equal(state.playerHp, 24);
  assert.equal(state.enemyHp, 16);
  assert.equal(state.allParried, false);
  assert.equal(state.phase, 'player');
});

test('timing boundaries work; early attempts cannot be retried on the same hit', () => {
  const incoming = attack(newCombat(), 100);
  for (const now of [incoming.impactAt - PARRY_WINDOW_MS, incoming.impactAt]) {
    assert.equal(parry(incoming, now).parryResult, 'success');
  }
  const early = parry(incoming, incoming.impactAt - PARRY_WINDOW_MS - 1);
  assert.equal(early.parryResult, 'miss');
  assert.equal(parry(early, incoming.impactAt), early);
  const late = parry(incoming, incoming.impactAt + 1);
  assert.equal(late.playerHp, 24);
  assert.equal(late.hitIndex, 1);
  assert.equal(late.parryResult, 'miss');
});

test('lethal hits stop the combo; lethal counters stop combat', () => {
  const dead = advanceEnemy(attack({ ...newCombat(), playerHp: 3 }), 9999);
  assert.equal(dead.playerHp, 0);
  assert.equal(dead.hitIndex, 1);
  assert.equal(dead.phase, 'defeat');
  const won = perfectCombo(attack({ ...newCombat(), enemyHp: 10 }));
  assert.equal(won.enemyHp, 0);
  assert.equal(won.phase, 'victory');
  const directWin = attack({ ...newCombat(), enemyHp: 8 });
  assert.equal(directWin.phase, 'victory');
  for (const state of [dead, won, directWin]) {
    assert.equal(attack(state), state);
    assert.equal(parry(state, 9999), state);
    assert.equal(retaliate(state), state);
  }
});

test('new turns reset combo history and new fights reset health', () => {
  const missed = advanceEnemy(attack(newCombat()), 9999);
  const next = attack(missed, 10000);
  assert.equal(next.allParried, true);
  assert.equal(next.hitIndex, 0);
  assert.equal(next.parryResult, null);
  assert.equal(next.impactAt, 11500);
  assert.equal(newCombat().playerHp, 30);
});
