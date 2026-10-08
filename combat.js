export const ENEMIES = [
  {
    name: 'Sentinel', symbol: '♜', damage: 7,
    patterns: [[1500, 2200, 3100], [1800, 2300, 2800], [1100, 2100, 3500]],
  },
  {
    name: 'Duelist', symbol: '⚔', damage: 7,
    patterns: [[1200, 1600, 2800], [1600, 2000, 2400], [1000, 2300, 2700]],
  },
];
export const PARRY_WINDOW_MS = 180;
export const DODGE_WINDOW_MS = 360;
export const HEAVY_STRIKE = { cost: 3, damage: 20 };

export function newCombat() {
  return {
    playerHp: 40, playerMaxHp: 40, attackDamage: 8, energy: 0,
    enemy: ENEMIES[0], enemyTurns: 0, enemyHp: 48, enemyMaxHp: 48, fight: 1,
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
  return strike(state, now, false);
}

export function heavyStrike(state, now = 0) {
  return strike(state, now, true);
}

function strike(state, now, heavy) {
  if (state.phase !== 'player') return state;
  if (heavy && state.energy < HEAVY_STRIKE.cost) return state;
  const damage = heavy ? HEAVY_STRIKE.damage : state.attackDamage;
  const enemyHp = Math.max(0, state.enemyHp - damage);
  const patternIndex = state.enemyTurns % state.enemy.patterns.length;
  const impactTimes = state.enemy.patterns[patternIndex];
  return {
    ...state,
    enemyHp,
    energy: state.energy + (heavy ? -HEAVY_STRIKE.cost : 1),
    impactTimes,
    patternIndex,
    enemyTurns: state.enemyTurns + 1,
    comboStartedAt: now,
    hitIndex: 0,
    impactAt: now + impactTimes[0],
    allParried: true,
    defenseResult: null,
    phase: enemyHp === 0 ? 'victory' : 'enemy',
    message: enemyHp === 0 ? `Victory! The ${state.enemy.name} falls.` : `You deal ${damage} damage. The ${state.enemy.name} prepares to strike…`,
  };
}

export function parry(state, now) {
  return defend(state, now, 'parry');
}

export function dodge(state, now) {
  return defend(state, now, 'dodge');
}

function defend(state, now, action) {
  if (state.phase === 'enemy' && now > state.impactAt) state = advanceEnemy(state, now);
  if (state.phase !== 'enemy' || state.defenseResult !== null) return state;
  const remaining = state.impactAt - now;
  const window = action === 'parry' ? PARRY_WINDOW_MS : DODGE_WINDOW_MS;
  const success = remaining >= 0 && remaining <= window;
  return {
    ...state,
    defenseResult: success ? action : 'miss',
    message: success ? action === 'parry' ? 'Parry ready!' : 'Dodge ready!'
      : remaining > 0 ? 'Too early! Brace for impact.' : 'Too late!',
  };
}

export function retaliate(state) {
  if (state.phase !== 'enemy') return state;
  const parried = state.defenseResult === 'parry';
  const blocked = parried || state.defenseResult === 'dodge';
  const playerHp = Math.max(0, state.playerHp - (blocked ? 0 : state.enemy.damage));
  const allParried = state.allParried && parried;
  const hitIndex = state.hitIndex + 1;
  const finished = hitIndex === state.impactTimes.length;
  const enemyHp = Math.max(0, state.enemyHp - (finished && allParried ? 4 : 0));
  return {
    ...state,
    playerHp,
    enemyHp,
    allParried,
    hitIndex,
    defenseResult: null,
    impactAt: finished ? null : state.comboStartedAt + state.impactTimes[hitIndex],
    phase: playerHp === 0 ? 'defeat' : enemyHp === 0 ? 'victory' : finished ? 'player' : 'enemy',
    message: playerHp === 0 ? 'Defeat. Try again.'
      : enemyHp === 0 ? `Parried! Your counter finishes the ${state.enemy.name}. Victory!`
      : finished && allParried ? 'Perfect combo! You counter for 4 damage. Your turn.'
      : finished ? 'Combo over. No counter. Your turn.'
      : blocked ? `Hit ${hitIndex} ${parried ? 'parried' : 'dodged'}! Prepare for the next strike.`
      : `Hit ${hitIndex} deals ${state.enemy.damage} damage. Prepare for the next strike.`,
  };
}

export function advanceEnemy(state, now) {
  while (state.phase === 'enemy' && now >= state.impactAt) state = retaliate(state);
  return state;
}
