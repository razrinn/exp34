import test from 'node:test';
import assert from 'node:assert/strict';
import { newCombat, nextFight, attack, heavyStrike, parry, dodge, retaliate, advanceEnemy, ENEMIES, PARRY_WINDOW_MS, DODGE_WINDOW_MS } from './combat.js';

function perfectCombo(state) {
  for (const offset of state.hits) {
    const impact = state.comboStartedAt + offset.time;
    state = advanceEnemy(parry(state, impact), impact);
  }
  return state;
}

test('misses resolve individually and the turn ends after the final hit', () => {
  let state = attack(newCombat(), 100);
  assert.equal(attack(state), state);
  assert.equal(advanceEnemy(state, 1599), state);
  state = advanceEnemy(state, 1600);
  assert.equal(state.playerHp, 37);
  assert.equal(state.hitIndex, 1);
  assert.equal(state.impactAt, 2300);
  assert.equal(state.phase, 'enemy');
  state = advanceEnemy(state, 3200);
  assert.equal(state.playerHp, 29);
  assert.equal(state.enemyHp, 40);
  assert.equal(state.phase, 'player');
});

test('parries block individual hits; only a perfect combo counters', () => {
  const incoming = attack(newCombat(), 100);
  const first = advanceEnemy(parry(incoming, incoming.impactAt), incoming.impactAt);
  assert.equal(first.playerHp, 40);
  assert.equal(first.enemyHp, 40);
  assert.equal(first.defenseResult, null);
  const result = perfectCombo(incoming);
  assert.equal(result.playerHp, 40);
  assert.equal(result.enemyHp, 36);
  assert.equal(result.phase, 'player');
});

test('missing a middle hit prevents a counter even with a final parry', () => {
  let state = attack(newCombat());
  state = advanceEnemy(parry(state, 1500), 1500);
  state = advanceEnemy(state, 2200);
  state = advanceEnemy(parry(state, 3100), 3100);
  assert.equal(state.playerHp, 37);
  assert.equal(state.enemyHp, 40);
  assert.equal(state.allParried, false);
  assert.equal(state.phase, 'player');
});

test('timing boundaries work; early attempts cannot be retried on the same hit', () => {
  const incoming = attack(newCombat(), 100);
  for (const now of [incoming.impactAt - PARRY_WINDOW_MS, incoming.impactAt]) {
    assert.equal(parry(incoming, now).defenseResult, 'parry');
  }
  const early = parry(incoming, incoming.impactAt - PARRY_WINDOW_MS - 1);
  assert.equal(early.defenseResult, 'miss');
  assert.equal(parry(early, incoming.impactAt), early);
  const late = parry(incoming, incoming.impactAt + 1);
  assert.equal(late.playerHp, 37);
  assert.equal(late.hitIndex, 1);
  assert.equal(late.defenseResult, 'miss');
});

test('lethal hits stop the combo; lethal counters stop combat', () => {
  const dead = advanceEnemy(attack({ ...newCombat(), playerHp: 2 }), 9999);
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
  const missed = advanceEnemy(attack({ ...newCombat(), playerHp: 40, playerMaxHp: 40 }), 9999);
  const next = attack(missed, 10000);
  assert.equal(next.allParried, true);
  assert.equal(next.hitIndex, 0);
  assert.equal(next.defenseResult, null);
  assert.equal(next.impactAt, 11800);
  assert.equal(newCombat().playerHp, 40);
});

test('attack upgrades persist, retain current health, and increase enemy health', () => {
  const won = { ...newCombat(), playerHp: 12, enemyHp: 0, phase: 'victory' };
  const next = nextFight(won, 'attack');
  assert.equal(next.fight, 2);
  assert.equal(next.playerHp, 12);
  assert.equal(next.playerMaxHp, 40);
  assert.equal(next.attackDamage, 10);
  assert.equal(next.enemyHp, 56);
  assert.equal(next.enemyMaxHp, 56);
  assert.equal(next.phase, 'player');
  assert.equal(attack(next).enemyHp, 46);
  const third = nextFight({ ...next, phase: 'victory', enemyHp: 0 }, 'attack');
  assert.equal(third.attackDamage, 12);
  assert.equal(third.enemyMaxHp, 64);
});

test('health upgrades heal fully and cannot be purchased outside victory', () => {
  const won = { ...newCombat(), playerHp: 6, enemyHp: 0, phase: 'victory' };
  const next = nextFight(won, 'health');
  assert.equal(next.playerHp, 46);
  assert.equal(next.playerMaxHp, 46);
  assert.equal(next.attackDamage, 8);
  assert.equal(nextFight(next, 'health'), next);
  assert.equal(nextFight(won, 'unknown'), won);
  const dead = { ...newCombat(), phase: 'defeat', playerHp: 0 };
  assert.equal(nextFight(dead, 'health'), dead);
  assert.equal(newCombat().fight, 1);
  assert.equal(newCombat().attackDamage, 8);
});

test('enemies alternate and the Duelist uses its own rhythm', () => {
  const initial = newCombat();
  assert.equal(initial.enemy, ENEMIES[0]);
  const second = nextFight({ ...initial, phase: 'victory', enemyHp: 0 }, 'health');
  assert.equal(second.enemy, ENEMIES[1]);
  let incoming = attack(second, 100);
  assert.equal(incoming.impactAt, 1300);
  incoming = advanceEnemy(parry(incoming, 1300), 1300);
  assert.equal(incoming.impactAt, 1700);
  incoming = advanceEnemy(parry(incoming, 1700), 1700);
  assert.equal(incoming.impactAt, 2900);
  assert.equal(advanceEnemy(incoming, 2800), incoming);
  const result = advanceEnemy(parry(incoming, 2900), 2900);
  assert.equal(result.playerHp, 46);
  assert.equal(result.enemyHp, 44);
  assert.equal(result.phase, 'player');
  const third = nextFight({ ...second, phase: 'victory', enemyHp: 0 }, 'attack');
  assert.equal(third.enemy, ENEMIES[0]);
});

test('each enemy cycles through three distinct patterns and all support perfect counters', () => {
  for (const enemy of ENEMIES) {
    assert.equal(enemy.patterns.length, 3);
    assert.equal(new Set(enemy.patterns.map(pattern => JSON.stringify(pattern))).size, 3);
    let state = { ...newCombat(), enemy, enemyHp: 100, enemyMaxHp: 100 };
    for (let turn = 0; turn < 4; turn++) {
      state = attack(state, turn * 10000);
      assert.equal(state.patternIndex, turn % 3);
      assert.equal(state.hits, enemy.patterns[turn % 3]);
      assert.equal(state.impactAt, turn * 10000 + state.hits[0].time);
      for (const impact of state.hits) {
        state = advanceEnemy(parry(state, state.comboStartedAt + impact.time), state.comboStartedAt + impact.time);
      }
      assert.equal(state.playerHp, 40);
      assert.equal(state.enemyHp, 100 - (turn + 1) * 12);
      assert.equal(state.phase, 'player');
    }
    const next = nextFight({ ...state, phase: 'victory', enemyHp: 0 }, 'health');
    assert.equal(next.enemyTurns, 0);
    assert.equal(attack(next).patternIndex, 0);
  }
});

test('starting balance requires four perfect rounds and exposes all three patterns', () => {
  let state = newCombat();
  for (let turn = 0; turn < 4; turn++) {
    state = attack(state, turn * 10000);
    assert.equal(state.phase, 'enemy');
    assert.equal(state.patternIndex, turn % 3);
    state = perfectCombo(state);
    assert.equal(state.playerHp, 40);
    assert.equal(state.enemyHp, 48 - (turn + 1) * 12);
    assert.equal(state.phase, turn === 3 ? 'victory' : 'player');
  }
});

test('dodge has a wider inclusive window and shares the one-attempt limit', () => {
  const state = attack(newCombat());
  for (const now of [state.impactAt - DODGE_WINDOW_MS, state.impactAt]) {
    const dodged = dodge(state, now);
    assert.equal(dodged.defenseResult, 'dodge');
    assert.equal(parry(dodged, state.impactAt), dodged);
    assert.equal(advanceEnemy(dodged, state.impactAt).playerHp, 40);
  }
  assert.equal(parry(state, state.impactAt - DODGE_WINDOW_MS).defenseResult, 'miss');
  const early = dodge(state, state.impactAt - DODGE_WINDOW_MS - 1);
  assert.equal(early.defenseResult, 'miss');
  assert.equal(parry(early, state.impactAt), early);
  assert.equal(dodge(early, state.impactAt), early);
  assert.equal(advanceEnemy(early, state.impactAt).playerHp, 37);
  const late = dodge(state, state.impactAt + 1);
  assert.equal(late.playerHp, 37);
  assert.equal(late.defenseResult, 'miss');
  const idle = newCombat();
  assert.equal(dodge(idle, 0), idle);
});

test('one dodge among parries blocks damage but forfeits the combo counter', () => {
  for (let dodgeIndex = 0; dodgeIndex < 3; dodgeIndex++) {
    let state = attack(newCombat());
    for (let hit = 0; hit < 3; hit++) {
      const impact = state.impactAt;
      state = (hit === dodgeIndex ? dodge : parry)(state, impact);
      state = advanceEnemy(state, impact);
    }
    assert.equal(state.playerHp, 40);
    assert.equal(state.enemyHp, 40);
    assert.equal(state.allParried, false);
    assert.equal(state.phase, 'player');
  }
});

test('basic attacks build energy and a heavy strike spends it and starts the enemy turn', () => {
  let state = { ...newCombat(), enemyHp: 100, enemyMaxHp: 100 };
  for (let turn = 0; turn < 3; turn++) {
    state = perfectCombo(attack(state, turn * 10000));
    assert.equal(state.energy, turn + 1);
  }
  const result = heavyStrike(state, 30000);
  assert.equal(result.energy, 0);
  assert.equal(result.enemyHp, state.enemyHp - 20);
  assert.equal(result.phase, 'enemy');
  assert.equal(result.impactAt, 31500);
  assert.equal(result.enemyTurns, 4);
});

test('heavy strike rejects unaffordable and out-of-turn actions; lethal damage clamps', () => {
  for (const energy of [0, 1, 2]) {
    const state = { ...newCombat(), energy };
    assert.equal(heavyStrike(state), state);
  }
  for (const phase of ['enemy', 'victory', 'defeat']) {
    const state = { ...newCombat(), energy: 5, phase };
    assert.equal(heavyStrike(state), state);
  }
  const result = heavyStrike({ ...newCombat(), energy: 4, enemyHp: 10 });
  assert.equal(result.enemyHp, 0);
  assert.equal(result.energy, 1);
  assert.equal(result.phase, 'victory');
  assert.equal(nextFight(result, 'attack').energy, 0);
  assert.equal(newCombat().energy, 0);
});

test('each hit applies its own damage, including the stronger finisher', () => {
  for (const enemy of ENEMIES) {
    let state = attack({ ...newCombat(), enemy });
    for (const expectedHp of [37, 34, 29]) {
      state = advanceEnemy(state, state.impactAt);
      assert.equal(state.playerHp, expectedHp);
    }
    assert.equal(state.phase, 'player');
  }
});
