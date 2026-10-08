export const ENEMIES = [
  {
    name: 'Sentinel', symbol: '♜',
    patterns: [
      [{ time: 1500, damage: 2 }, { time: 2200, damage: 2 }, { time: 3100, damage: 3 }],
      [{ time: 1800, damage: 2 }, { time: 2300, damage: 2 }, { time: 2800, damage: 3 }],
      [{ time: 1100, damage: 2 }, { time: 2100, damage: 2 }, { time: 3500, damage: 3 }],
    ],
  },
  {
    name: 'Duelist', symbol: '⚔',
    patterns: [
      [{ time: 1200, damage: 2 }, { time: 1600, damage: 2 }, { time: 2800, damage: 3 }],
      [{ time: 1600, damage: 2 }, { time: 2000, damage: 2 }, { time: 2400, damage: 3 }],
      [{ time: 1000, damage: 2 }, { time: 2300, damage: 2 }, { time: 2700, damage: 3 }],
    ],
  },
];
export const RUN_LENGTH = 5;
export const BOSS = { ...ENEMIES[0], name: 'Warden', symbol: '♛' };
export const PARRY_WINDOW_MS = 180;
export const DODGE_WINDOW_MS = 360;
export const HEAVY_STRIKE = { cost: 3, damage: 20 };

export function newCombat() {
  return {
    playerHp: 40, playerMaxHp: 40, attackDamage: 8, energy: 0,
    enemy: ENEMIES[0], enemyTurns: 0, enemyHp: 36, enemyMaxHp: 36, fight: 1,
    phase: 'player', message: 'Your turn. Choose Attack.',
  };
}

export function nextFight(state, upgrade) {
  if (state.phase !== 'victory' || state.fight >= RUN_LENGTH || !['attack', 'health'].includes(upgrade)) return state;
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
    enemy: state.fight + 1 === RUN_LENGTH ? BOSS : ENEMIES[state.fight % ENEMIES.length],
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
  const hits = state.enemy.patterns[patternIndex].map(hit => ({
    ...hit, damage: hit.damage + Math.floor((state.fight - 1) / 2),
  }));
  return {
    ...state,
    enemyHp,
    energy: state.energy + (heavy ? -HEAVY_STRIKE.cost : 1),
    hits,
    patternIndex,
    enemyTurns: state.enemyTurns + 1,
    comboStartedAt: now,
    hitIndex: 0,
    impactAt: now + hits[0].time,
    allParried: true,
    defenseResult: null,
    phase: enemyHp === 0 ? state.fight === RUN_LENGTH ? 'complete' : 'victory' : 'enemy',
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
  const damage = state.hits[state.hitIndex].damage;
  const playerHp = Math.max(0, state.playerHp - (blocked ? 0 : damage));
  const allParried = state.allParried && parried;
  const hitIndex = state.hitIndex + 1;
  const finished = hitIndex === state.hits.length;
  const enemyHp = Math.max(0, state.enemyHp - (finished && allParried ? 4 : 0));
  return {
    ...state,
    playerHp,
    enemyHp,
    allParried,
    hitIndex,
    defenseResult: null,
    impactAt: finished ? null : state.comboStartedAt + state.hits[hitIndex].time,
    phase: playerHp === 0 ? 'defeat' : enemyHp === 0 ? state.fight === RUN_LENGTH ? 'complete' : 'victory' : finished ? 'player' : 'enemy',
    message: playerHp === 0 ? 'Defeat. Try again.'
      : enemyHp === 0 ? `Parried! Your counter finishes the ${state.enemy.name}. Victory!`
      : finished && allParried ? 'Perfect combo! You counter for 4 damage. Your turn.'
      : finished ? blocked ? 'Final hit avoided. No counter. Your turn.' : `Final hit deals ${damage} damage. No counter. Your turn.`
      : blocked ? `Hit ${hitIndex} ${parried ? 'parried' : 'dodged'}! Prepare for the next strike.`
      : `Hit ${hitIndex} deals ${damage} damage. Prepare for the next strike.`,
  };
}

export function advanceEnemy(state, now) {
  while (state.phase === 'enemy' && now >= state.impactAt) state = retaliate(state);
  return state;
}
