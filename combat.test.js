import test from 'node:test';
import assert from 'node:assert/strict';
import { newCombat, nextFight, attack, heavyStrike, heal, parry, dodge, retaliate, advanceEnemy, ENEMIES, BOSS, RUN_LENGTH, PARRY_WINDOW_MS, DODGE_WINDOW_MS } from './combat.js';

function perfectCombo(state) {
  if (state.phase !== 'enemy') return state;
  for (const offset of state.hits) {
    const impact = state.comboStartedAt + offset.time;
    state = advanceEnemy((offset.parryable === false ? dodge : parry)(state, impact), impact);
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
  assert.equal(late.defenseResult, null);
});

test('lethal hits stop the combo; lethal counters stop combat', () => {
  const dead = advanceEnemy(attack({ ...newCombat(), playerHp: 1 }), 9999);
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

test('rewards stack, recover health equally, and reset energy to the build starting value', () => {
  const won = { ...newCombat(), playerHp: 12, energy: 7, enemyHp: 0, phase: 'victory' };
  for (const upgrade of ['counter', 'energy', 'heavy']) {
    const next = nextFight(won, upgrade);
    assert.equal(next.playerHp, 22);
    assert.equal(next.playerMaxHp, 40);
    assert.equal(next.fight, 2);
    assert.equal(next.enemyHp, 60);
    assert.equal(next.attackDamage, 8);
    assert.equal(next.counterDamage, upgrade === 'counter' ? 7 : 4);
    assert.equal(next.heavyDamage, upgrade === 'heavy' ? 26 : 20);
    assert.equal(next.energy, upgrade === 'energy' ? 1 : 0);
    const third = nextFight({ ...next, phase: 'victory', enemyHp: 0 }, upgrade);
    assert.equal(third.playerHp, 32);
    assert.equal(third.counterDamage, upgrade === 'counter' ? 10 : 4);
    assert.equal(third.heavyDamage, upgrade === 'heavy' ? 32 : 20);
    assert.equal(third.startingEnergy, upgrade === 'energy' ? 2 : 0);
    assert.equal(third.enemyHp, 72);
  }
});

test('recovery caps at max health and rewards reject invalid phases or choices', () => {
  const won = { ...newCombat(), playerHp: 38, enemyHp: 0, phase: 'victory' };
  const next = nextFight(won, 'energy');
  assert.equal(next.playerHp, 40);
  assert.equal(nextFight(next, 'energy'), next);
  assert.equal(nextFight(won, 'unknown'), won);
  assert.equal(nextFight(won, 'health'), won);
  const dead = { ...newCombat(), phase: 'defeat', playerHp: 0 };
  assert.equal(nextFight(dead, 'counter'), dead);
  assert.equal(newCombat().startingEnergy, 0);
});

test('enemies alternate and the Duelist uses its own rhythm', () => {
  const initial = newCombat();
  assert.equal(initial.enemy, ENEMIES[0]);
  const second = nextFight({ ...initial, phase: 'victory', enemyHp: 0 }, 'energy');
  assert.equal(second.enemy, ENEMIES[1]);
  let incoming = attack(second, 100);
  assert.equal(incoming.impactAt, 1300);
  incoming = advanceEnemy(parry(incoming, 1300), 1300);
  assert.equal(incoming.impactAt, 1700);
  incoming = advanceEnemy(parry(incoming, 1700), 1700);
  assert.equal(incoming.impactAt, 2900);
  assert.equal(advanceEnemy(incoming, 2800), incoming);
  const result = advanceEnemy(parry(incoming, 2900), 2900);
  assert.equal(result.playerHp, 40);
  assert.equal(result.enemyHp, 48);
  assert.equal(result.phase, 'player');
  const third = nextFight({ ...second, phase: 'victory', enemyHp: 0 }, 'heavy');
  assert.equal(third.enemy, ENEMIES[0]);
});

test('each enemy cycles through three patterns and only all-yellow combos counter', () => {
  for (const enemy of ENEMIES) {
    assert.equal(enemy.patterns.length, 3);
    assert.deepEqual(enemy.patterns.map(pattern => pattern.length), [3, 2, 1]);
    assert.equal(new Set(enemy.patterns.map(pattern => JSON.stringify(pattern))).size, 3);
    let state = { ...newCombat(), enemy, enemyHp: 100, enemyMaxHp: 100 };
    let expectedHp = 100;
    for (let turn = 0; turn < 4; turn++) {
      state = attack(state, turn * 10000);
      expectedHp -= 8 + (state.hits.some(hit => hit.parryable === false) ? 0 : 4);
      assert.equal(state.patternIndex, turn % 3);
      assert.deepEqual(state.hits, enemy.patterns[turn % 3]);
      assert.equal(state.impactAt, turn * 10000 + state.hits[0].time);
      for (const impact of state.hits) {
        state = advanceEnemy((impact.parryable === false ? dodge : parry)(state, state.comboStartedAt + impact.time), state.comboStartedAt + impact.time);
      }
      assert.equal(state.playerHp, 40);
      assert.equal(state.enemyHp, expectedHp);
      assert.equal(state.phase, 'player');
    }
    const next = nextFight({ ...state, phase: 'victory', enemyHp: 0 }, 'energy');
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
  assert.equal(late.defenseResult, null);
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
  assert.equal(result.energy, 1);
  assert.equal(result.enemyHp, state.enemyHp - 20);
  assert.equal(result.phase, 'enemy');
  assert.equal(result.impactAt, 31500);
  assert.equal(result.enemyTurns, 4);
});

test('heavy strike rejects unaffordable and out-of-turn actions; lethal damage clamps', () => {
  for (const energy of [0, 1]) {
    const state = { ...newCombat(), energy };
    assert.equal(heavyStrike(state), state);
  }
  for (const phase of ['enemy', 'victory', 'defeat', 'complete']) {
    const state = { ...newCombat(), energy: 5, phase };
    assert.equal(heavyStrike(state), state);
  }
  const result = heavyStrike({ ...newCombat(), energy: 4, enemyHp: 10 });
  assert.equal(result.enemyHp, 0);
  assert.equal(result.energy, 2);
  assert.equal(result.phase, 'victory');
  assert.equal(nextFight(result, 'heavy').energy, 0);
  assert.equal(newCombat().energy, 0);
  const affordable = heavyStrike({ ...newCombat(), energy: 2 });
  assert.equal(affordable.energy, 0);
  assert.equal(affordable.enemyHp, 28);
  assert.equal(affordable.phase, 'enemy');
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

test('damage increases every two fights while health rises every fight', () => {
  let state = newCombat();
  const expected = [[3, 3, 5], [3, 3, 5], [4, 4, 6], [4, 4, 6], [6, 6, 6, 10]];
  for (let fight = 0; fight < expected.length; fight++) {
    assert.equal(state.enemyMaxHp, 48 + fight * 12);
    const incoming = attack(state);
    assert.deepEqual(incoming.hits.map(hit => hit.damage), expected[fight]);
    const afterHit = advanceEnemy(incoming, incoming.impactAt);
    assert.equal(afterHit.playerHp, state.playerHp - expected[fight][0]);
    state = nextFight({ ...state, phase: 'victory', enemyHp: 0 }, 'energy');
  }
  assert.deepEqual(ENEMIES[0].patterns[0].map(hit => hit.damage), [3, 3, 5]);
});

test('a full run reaches the final boss, completes, and cannot progress again', () => {
  let state = newCombat();
  for (let fight = 1; fight <= RUN_LENGTH; fight++) {
    assert.equal(state.fight, fight);
    assert.equal(state.enemy, fight === RUN_LENGTH ? BOSS : ENEMIES[(fight - 1) % 2]);
    while (state.phase === 'player') state = perfectCombo(attack(state));
    assert.equal(state.phase, fight === RUN_LENGTH ? 'complete' : 'victory');
    if (fight < RUN_LENGTH) state = nextFight(state, 'energy');
  }
  assert.equal(nextFight(state, 'energy'), state);
  assert.equal(attack(state), state);
  assert.equal(heavyStrike(state), state);
  assert.equal(parry(state, 99999), state);
  assert.equal(dodge(state, 99999), state);
  assert.equal(newCombat().fight, 1);
});

test('all ways of landing the final blow complete the run', () => {
  const final = { ...newCombat(), enemy: BOSS, fight: RUN_LENGTH, enemyHp: 8, energy: 3 };
  assert.equal(attack(final).phase, 'complete');
  assert.equal(heavyStrike(final).phase, 'complete');
  assert.equal(perfectCombo(attack({ ...final, enemyHp: 10 })).phase, 'complete');
  const forgedVictory = { ...final, enemyHp: 0, phase: 'victory' };
  assert.equal(nextFight(forgedVictory, 'heavy'), forgedVictory);
});

test('boss patterns include red finishers and require four timed defenses', () => {
  assert.equal(BOSS.patterns.length, 3);
  assert.equal(new Set(BOSS.patterns.map(pattern => JSON.stringify(pattern))).size, 3);
  for (let patternIndex = 0; patternIndex < 3; patternIndex++) {
    const incoming = attack({ ...newCombat(), enemy: BOSS, fight: RUN_LENGTH, enemyTurns: patternIndex });
    assert.equal(incoming.hits.length, 4);
    assert.deepEqual(incoming.hits.map(hit => hit.damage), [6, 6, 6, 10]);
    let state = incoming;
    for (let hit = 0; hit < 4; hit++) {
      state = advanceEnemy((state.hits[hit].parryable === false ? dodge : parry)(state, state.impactAt), state.impactAt);
      assert.equal(state.enemyHp, hit < 3 || patternIndex > 0 ? 40 : 36);
      assert.equal(state.phase, hit < 3 ? 'enemy' : 'player');
      assert.equal(state.playerHp, 40);
    }
    assert.equal(advanceEnemy(incoming, 99999).playerHp, 12);
    let dodged = incoming;
    for (let hit = 0; hit < 4; hit++) {
      dodged = advanceEnemy((hit === 3 ? dodge : parry)(dodged, dodged.impactAt), dodged.impactAt);
    }
    assert.equal(dodged.enemyHp, 40);
    assert.equal(dodged.playerHp, 40);
    assert.equal(dodged.phase, 'player');
  }
});

test('ignoring defense loses the opening fight before basic attacks can win', () => {
  let state = newCombat();
  for (let turn = 0; turn < 4; turn++) {
    state = advanceEnemy(attack(state, turn * 10000), turn * 10000 + 9999);
  }
  assert.equal(state.phase, 'defeat');
  assert.equal(state.playerHp, 0);
  assert.equal(state.enemyHp, 16);
});

test('shorter variants resolve every hit and a dodge still forfeits the counter', () => {
  for (const enemy of ENEMIES) {
    for (let variant = 0; variant < 3; variant++) {
      const incoming = attack({ ...newCombat(), enemy, enemyTurns: variant });
      const missed = advanceEnemy(incoming, 99999);
      assert.equal(missed.playerHp, variant === 2 ? 31 : 29);
      assert.equal(missed.hitIndex, 3 - variant);
      assert.equal(missed.phase, 'player');
      let avoided = incoming;
      while (avoided.phase === 'enemy') {
        const action = avoided.hitIndex === 0 ? dodge : parry;
        avoided = advanceEnemy(action(avoided, avoided.impactAt), avoided.impactAt);
      }
      assert.equal(avoided.playerHp, 40);
      assert.equal(avoided.enemyHp, 40);
    }
  }
});

test('healing spends energy and starts the next enemy pattern without dealing damage', () => {
  const initial = { ...newCombat(), playerHp: 20, energy: 3, enemyTurns: 1 };
  const result = heal(initial, 100);
  assert.equal(result.playerHp, 32);
  assert.equal(result.energy, 1);
  assert.equal(result.enemyHp, initial.enemyHp);
  assert.equal(result.phase, 'enemy');
  assert.equal(result.patternIndex, 1);
  assert.equal(result.impactAt, 1900);
  assert.equal(result.enemyTurns, 2);
  assert.equal(advanceEnemy(result, 99999).playerHp, 21);
});

test('healing caps at upgraded max health and rejects invalid actions without spending', () => {
  const nearFull = { ...newCombat(), playerHp: 44, playerMaxHp: 46, energy: 2 };
  const result = heal(nearFull);
  assert.equal(result.playerHp, 46);
  assert.equal(result.energy, 0);
  assert.match(result.message, /recover 2 HP/);
  const full = { ...newCombat(), energy: 2 };
  assert.equal(heal(full), full);
  for (const energy of [0, 1]) {
    const poor = { ...newCombat(), playerHp: 20, energy };
    assert.equal(heal(poor), poor);
  }
  for (const phase of ['enemy', 'victory', 'defeat', 'complete']) {
    const state = { ...newCombat(), playerHp: 20, energy: 3, phase };
    assert.equal(heal(state), state);
  }
});

test('combat uses rewarded damage and Prepared unlocks earlier skills', () => {
  const won = { ...newCombat(), enemyHp: 0, phase: 'victory' };
  const counterBuild = nextFight(won, 'counter');
  assert.equal(perfectCombo(attack(counterBuild)).enemyHp, 45);
  const heavyBuild = nextFight(won, 'heavy');
  assert.equal(heavyStrike({ ...heavyBuild, energy: 3 }).enemyHp, 34);
  const prepared = nextFight(won, 'energy');
  const afterAttack = perfectCombo(attack(prepared));
  assert.equal(afterAttack.energy, 2);
  assert.equal(heal({ ...afterAttack, playerHp: 20 }).playerHp, 32);
  const afterSecond = perfectCombo(attack(afterAttack));
  assert.equal(afterSecond.energy, 3);
  assert.equal(heavyStrike(afterSecond).energy, 1);
});

test('a late defense does not consume the next strike, including a previously used defense', () => {
  for (const defense of [parry, dodge]) {
    for (const used of [false, true]) {
      let state = attack(newCombat());
      if (used) state = defense(state, state.impactAt - 1);
      state = defense(state, state.impactAt + 20);
      assert.equal(state.hitIndex, 1);
      assert.equal(state.defenseResult, null);
      const hp = state.playerHp;
      state = defense(state, state.impactAt - 1);
      assert.equal(state.defenseResult, defense === parry ? 'parry' : 'dodge');
      assert.equal(advanceEnemy(state, state.impactAt).playerHp, hp);
    }
  }
});

test('defense can catch up stale frames and defend the current strike in its window', () => {
  for (const defense of [parry, dodge]) {
    const state = defense(attack(newCombat()), 2200 - 1);
    assert.equal(state.hitIndex, 1);
    assert.equal(state.playerHp, 37);
    assert.equal(state.defenseResult, defense === parry ? 'parry' : 'dodge');
    assert.equal(advanceEnemy(state, 2200).playerHp, 37);
  }
});


test('stale frames preserve a defense exactly on every fast-combo impact', () => {
  for (const defense of [parry, dodge]) {
    let state = attack({ ...newCombat(), enemy: ENEMIES[1] });
    for (const hit of state.hits) {
      state = defense(state, hit.time);
      assert.equal(state.defenseResult, defense === parry ? 'parry' : 'dodge');
    }
    state = advanceEnemy(state, 2800);
    assert.equal(state.playerHp, 40);
    assert.equal(state.phase, 'player');
  }
});


test('red hits reject parries, accept timed dodges, and never award a counter', () => {
  for (const enemy of [ENEMIES[1], BOSS]) {
    const incoming = attack({ ...newCombat(), enemy, enemyTurns: 2 });
    let beforeRed = incoming;
    while (beforeRed.hits[beforeRed.hitIndex].parryable !== false) {
      beforeRed = advanceEnemy(parry(beforeRed, beforeRed.impactAt), beforeRed.impactAt);
    }
    const redDamage = beforeRed.hits[beforeRed.hitIndex].damage;
    const failed = parry(beforeRed, beforeRed.impactAt - 1);
    assert.equal(failed.defenseResult, 'unparryable');
    assert.match(failed.message, /Cannot parry/);
    assert.equal(dodge(failed, failed.impactAt), failed);
    assert.equal(advanceEnemy(failed, failed.impactAt).playerHp, 40 - redDamage);
    for (const remaining of [0, DODGE_WINDOW_MS]) {
      const avoided = advanceEnemy(dodge(beforeRed, beforeRed.impactAt - remaining), beforeRed.impactAt);
      assert.equal(avoided.playerHp, 40);
      assert.equal(avoided.enemyHp, 40);
      assert.equal(avoided.allParried, false);
    }
    const forgedParry = advanceEnemy({ ...beforeRed, defenseResult: 'parry' }, beforeRed.impactAt);
    assert.equal(forgedParry.playerHp, 40 - redDamage);
    assert.equal(forgedParry.enemyHp, 40);
  }
});
