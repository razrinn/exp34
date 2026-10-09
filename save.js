import { newCombat, ENEMIES, BOSS, RUN_LENGTH, MAX_ENERGY } from './combat.js';

export const SAVE_KEY = 'exp34-run-v1';

export function loadRun(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage)?.getItem(SAVE_KEY);
    if (!raw) return newCombat();
    const saved = JSON.parse(raw);
    const { fight, playerHp, enemyHp, counterDamage, heavyDamage, startingEnergy, phase } = saved;
    const enemyMaxHp = 48 + (fight - 1) * 12;
    const rewards = (counterDamage - 4) / 3 + (heavyDamage - 20) / 6 + startingEnergy;
    if (saved.version !== 1 || ![fight, playerHp, enemyHp, counterDamage, heavyDamage, startingEnergy].every(Number.isInteger)
      || fight < 1 || fight > RUN_LENGTH || playerHp < 0 || playerHp > 40
      || enemyHp < 0 || enemyHp > enemyMaxHp
      || counterDamage < 4 || counterDamage > 16 || (counterDamage - 4) % 3 !== 0
      || heavyDamage < 20 || heavyDamage > 44 || (heavyDamage - 20) % 6 !== 0
      || startingEnergy < 0 || startingEnergy > 4 || rewards !== fight - 1
      || !['player', 'victory', 'defeat', 'complete'].includes(phase)
      || (phase === 'defeat') !== (playerHp === 0)
      || (phase === 'player' && enemyHp !== enemyMaxHp)
      || (phase === 'defeat' && enemyHp === 0)
      || (phase === 'victory' && (fight === RUN_LENGTH || enemyHp !== 0))
      || (phase === 'complete' && (fight !== RUN_LENGTH || enemyHp !== 0))) return newCombat();
    return {
      ...newCombat(), fight, playerHp, enemyHp, enemyMaxHp,
      counterDamage, heavyDamage, attackDamage: 8 + (heavyDamage - 20) / 6, startingEnergy, energy: Math.min(MAX_ENERGY, startingEnergy), phase,
      enemy: fight === RUN_LENGTH ? BOSS : ENEMIES[(fight - 1) % ENEMIES.length],
      message: phase === 'player' ? 'Encounter restored. Your turn.' : 'Encounter result restored.',
    };
  } catch {
    return newCombat();
  }
}

export function saveRun(state, storage) {
  try {
    const { fight, playerHp, enemyHp, counterDamage, heavyDamage, startingEnergy, phase } = state;
    (storage ?? globalThis.localStorage).setItem(SAVE_KEY, JSON.stringify({
      version: 1, fight, playerHp, enemyHp, counterDamage, heavyDamage, startingEnergy, phase,
    }));
    return true;
  } catch {
    return false;
  }
}

export function clearRun(storage) {
  try {
    (storage ?? globalThis.localStorage).removeItem(SAVE_KEY);
    return true;
  } catch {
    return false;
  }
}
