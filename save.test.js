import test from 'node:test';
import assert from 'node:assert/strict';
import { newCombat, nextFight, ENEMIES, BOSS } from './combat.js';
import { SAVE_KEY, loadRun, saveRun, clearRun } from './save.js';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
}

test('encounter starts restore health, build, energy, and current enemy definitions', () => {
  const storage = memoryStorage();
  const won = { ...newCombat(), phase: 'victory', enemyHp: 0, playerHp: 12 };
  const next = nextFight(won, 'energy');
  assert.equal(saveRun(next, storage), true);
  const loaded = loadRun(storage);
  assert.equal(loaded.fight, 2);
  assert.equal(loaded.playerHp, 22);
  assert.equal(loaded.energy, 1);
  assert.equal(loaded.enemy, ENEMIES[1]);
  assert.equal(loaded.enemyHp, 60);
  assert.equal(loaded.enemyTurns, 0);
  assert.equal(loaded.phase, 'player');
  assert.equal(JSON.parse(storage.getItem(SAVE_KEY)).enemy, undefined);
});

test('pending rewards, defeat, and completion survive reloads', () => {
  const storage = memoryStorage();
  const won = { ...newCombat(), phase: 'victory', enemyHp: 0 };
  saveRun(won, storage);
  assert.equal(loadRun(storage).phase, 'victory');
  let state = won;
  for (let fight = 1; fight < 5; fight++) {
    state = nextFight({ ...state, phase: 'victory', enemyHp: 0 }, 'heavy');
  }
  saveRun({ ...state, phase: 'complete', enemyHp: 0 }, storage);
  assert.equal(loadRun(storage).phase, 'complete');
  assert.equal(loadRun(storage).enemy, BOSS);
  assert.equal(loadRun(storage).heavyDamage, 44);
  assert.equal(loadRun(storage).attackDamage, 12);
  assert.equal(loadRun(storage).parryBonus, 0);
  saveRun({ ...state, phase: 'defeat', playerHp: 0, enemyHp: 12 }, storage);
  assert.equal(loadRun(storage).phase, 'defeat');
  assert.equal(loadRun(storage).playerHp, 0);
});

test('invalid saves safely reset without accepting impossible progression', () => {
  const storage = memoryStorage();
  saveRun(newCombat(), storage);
  const valid = JSON.parse(storage.getItem(SAVE_KEY));
  const invalid = [
    null, [], { ...valid, version: 2 }, { ...valid, fight: 6 },
    { ...valid, phase: 'enemy' }, { ...valid, playerHp: -1 },
    { ...valid, playerHp: 41 }, { ...valid, playerHp: '40' },
    { ...valid, counterDamage: 5 }, { ...valid, startingEnergy: 4 },
    { ...valid, phase: 'complete', enemyHp: 0 },
    { ...valid, enemyHp: 2 }, { ...valid, phase: 'defeat' },
  ];
  for (const value of invalid) {
    storage.setItem(SAVE_KEY, JSON.stringify(value));
    assert.deepEqual(loadRun(storage), newCombat());
  }
  storage.setItem(SAVE_KEY, '{broken');
  assert.deepEqual(loadRun(storage), newCombat());
});

test('restart removes only this game save and storage failures keep the game playable', () => {
  const storage = memoryStorage();
  storage.setItem('unrelated', 'keep');
  saveRun(newCombat(), storage);
  assert.equal(clearRun(storage), true);
  assert.equal(storage.getItem(SAVE_KEY), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
  assert.deepEqual(loadRun(storage), newCombat());
  const blocked = {
    getItem() { throw new Error('Blocked'); },
    setItem() { throw new Error('Blocked'); },
    removeItem() { throw new Error('Blocked'); },
  };
  assert.deepEqual(loadRun(blocked), newCombat());
  assert.equal(saveRun(newCombat(), blocked), false);
  assert.equal(clearRun(blocked), false);
});
