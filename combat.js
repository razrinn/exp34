export const ENEMIES = [
  { name: 'Sentinel', symbol: '♜', impactTimes: [1500, 2200, 3100], damage: 6 },
  { name: 'Duelist', symbol: '⚔', impactTimes: [1200, 1600, 2800], damage: 6 },
];
export const PARRY_WINDOW_MS = 180;

export function newCombat() {
  return {
    playerHp: 30, playerMaxHp: 30, attackDamage: 8,
    enemy: ENEMIES[0], enemyHp: 24, enemyMaxHp: 24, fight: 1,
    phase: 'player', message: 'Your turn. Choose Attack.',
  };
}

export function nextFight(state, upgrade) {
  if (state.phase !== 'victory' || !['attack', 'health'].includes(upgrade)) return state;
  const playerMaxHp = state.playerMaxHp + (upgrade === 'health' ? 6 : 0);
  const enemyMaxHp = state.enemyMaxHp + 8;
  return {
    ...newCombat(),
    playerMaxHp,
    playerHp: upgrade === 'health' ? playerMaxHp : state.playerHp,
    attackDamage: state.attackDamage + (upgrade === 'attack' ? 2 : 0),
    enemyMaxHp,
    enemyHp: enemyMaxHp,
    fight: state.fight + 1,
    enemy: ENEMIES[state.fight % ENEMIES.length],
    message: upgrade === 'health' ? 'Health upgraded and fully restored. Your turn.' : 'Attack upgraded. Your turn.',
  };
}

export function attack(state, now = 0) {
  if (state.phase !== 'player') return state;
  const enemyHp = Math.max(0, state.enemyHp - state.attackDamage);
  return {
    ...state,
    enemyHp,
    comboStartedAt: now,
    hitIndex: 0,
    impactAt: now + state.enemy.impactTimes[0],
    allParried: true,
    parryResult: null,
    phase: enemyHp === 0 ? 'victory' : 'enemy',
    message: enemyHp === 0 ? `Victory! The ${state.enemy.name} falls.` : `You deal ${state.attackDamage} damage. The ${state.enemy.name} prepares to strike…`,
  };
}

export function parry(state, now) {
  if (state.phase === 'enemy' && now > state.impactAt) state = advanceEnemy(state, now);
  if (state.phase !== 'enemy' || state.parryResult !== null) return state;
  const remaining = state.impactAt - now;
  const success = remaining >= 0 && remaining <= PARRY_WINDOW_MS;
  return {
    ...state,
    parryResult: success ? 'success' : 'miss',
    message: success ? 'Parry ready!' : remaining > 0 ? 'Too early! Brace for impact.' : 'Too late!',
  };
}

export function retaliate(state) {
  if (state.phase !== 'enemy') return state;
  const blocked = state.parryResult === 'success';
  const playerHp = Math.max(0, state.playerHp - (blocked ? 0 : state.enemy.damage));
  const allParried = state.allParried && blocked;
  const hitIndex = state.hitIndex + 1;
  const finished = hitIndex === state.enemy.impactTimes.length;
  const enemyHp = Math.max(0, state.enemyHp - (finished && allParried ? 4 : 0));
  return {
    ...state,
    playerHp,
    enemyHp,
    allParried,
    hitIndex,
    parryResult: null,
    impactAt: finished ? null : state.comboStartedAt + state.enemy.impactTimes[hitIndex],
    phase: playerHp === 0 ? 'defeat' : enemyHp === 0 ? 'victory' : finished ? 'player' : 'enemy',
    message: playerHp === 0 ? 'Defeat. Try again.'
      : enemyHp === 0 ? `Parried! Your counter finishes the ${state.enemy.name}. Victory!`
      : finished && allParried ? 'Perfect combo! You counter for 4 damage. Your turn.'
      : finished ? 'Combo over. No counter. Your turn.'
      : blocked ? `Hit ${hitIndex} parried! Prepare for the next strike.`
      : `Hit ${hitIndex} deals ${state.enemy.damage} damage. Prepare for the next strike.`,
  };
}

export function advanceEnemy(state, now) {
  while (state.phase === 'enemy' && now >= state.impactAt) state = retaliate(state);
  return state;
}
