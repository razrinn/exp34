export const ENEMIES = [
  {
    name: 'Sentinel', symbol: '♜', attackStyles: ['slash', 'chop', 'thrust'],
    patterns: [
      [{ time: 1500, damage: 3 }, { time: 2200, damage: 3 }, { time: 3100, damage: 5 }],
      [{ time: 1800, damage: 5 }, { time: 2800, damage: 6 }],
      [{ time: 2400, damage: 9 }],
    ],
  },
  {
    name: 'Duelist', symbol: '⚔', attackStyles: ['slash', 'chop', 'thrust'],
    patterns: [
      [{ time: 1200, damage: 3 }, { time: 1600, damage: 3 }, { time: 2800, damage: 5 }],
      [{ time: 1600, damage: 5 }, { time: 2000, damage: 6 }],
      [{ time: 1300, damage: 9 }],
    ],
  },
];
export const RUN_LENGTH = 5;
export const BOSS = {
  name: 'Warden', symbol: '♛', attackStyles: ['chop', 'slash', 'thrust'],
  patterns: [
    [{ time: 1400, damage: 4 }, { time: 2100, damage: 4 }, { time: 2800, damage: 4 }, { time: 3600, damage: 8 }],
    [{ time: 1200, damage: 4 }, { time: 1600, damage: 4 }, { time: 2700, damage: 4 }, { time: 3800, damage: 8 }],
    [{ time: 1900, damage: 4 }, { time: 2300, damage: 4 }, { time: 2700, damage: 4 }, { time: 3400, damage: 8 }],
  ],
};
export const PARRY_WINDOW_MS = 180;
export const DODGE_WINDOW_MS = 360;
export const HEAVY_STRIKE = { cost: 2, damage: 20 };
export const HEAL = { cost: 2, amount: 12 };
export const RECOVERY_HP = 10;

export function newCombat() {
  return {
    playerHp: 40, playerMaxHp: 40, attackDamage: 8, energy: 0, startingEnergy: 0,
    counterDamage: 4, heavyDamage: HEAVY_STRIKE.damage,
    enemy: ENEMIES[0], enemyTurns: 0, enemyHp: 48, enemyMaxHp: 48, fight: 1,
    phase: 'player', message: 'Your turn. Choose Attack.',
  };
}

export function nextFight(state, upgrade) {
  if (state.phase !== 'victory' || state.fight >= RUN_LENGTH || !['counter', 'energy', 'heavy'].includes(upgrade)) return state;
  const enemyMaxHp = state.enemyMaxHp + 12;
  const startingEnergy = state.startingEnergy + (upgrade === 'energy' ? 1 : 0);
  const playerHp = Math.min(state.playerMaxHp, state.playerHp + RECOVERY_HP);
  return {
    ...newCombat(),
    playerMaxHp: state.playerMaxHp,
    playerHp,
    attackDamage: state.attackDamage,
    counterDamage: state.counterDamage + (upgrade === 'counter' ? 3 : 0),
    heavyDamage: state.heavyDamage + (upgrade === 'heavy' ? 6 : 0),
    startingEnergy,
    energy: startingEnergy,
    enemyMaxHp,
    enemyHp: enemyMaxHp,
    fight: state.fight + 1,
    enemy: state.fight + 1 === RUN_LENGTH ? BOSS : ENEMIES[state.fight % ENEMIES.length],
    message: `Upgrade applied. Recovered ${playerHp - state.playerHp} HP. Your turn.`,
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
  const damage = heavy ? state.heavyDamage : state.attackDamage;
  const enemyHp = Math.max(0, state.enemyHp - damage);
  const next = {
    ...state,
    enemyHp,
    energy: state.energy + (heavy ? -HEAVY_STRIKE.cost : 1),
    phase: enemyHp === 0 ? state.fight === RUN_LENGTH ? 'complete' : 'victory' : 'enemy',
    message: enemyHp === 0 ? `Victory! The ${state.enemy.name} falls.` : `You deal ${damage} damage. The ${state.enemy.name} prepares to strike…`,
  };
  return enemyHp === 0 ? next : beginEnemyTurn(next, now);
}

export function heal(state, now = 0) {
  if (state.phase !== 'player' || state.energy < HEAL.cost || state.playerHp === state.playerMaxHp) return state;
  const playerHp = Math.min(state.playerMaxHp, state.playerHp + HEAL.amount);
  return beginEnemyTurn({
    ...state,
    playerHp,
    energy: state.energy - HEAL.cost,
    message: `You recover ${playerHp - state.playerHp} HP. The ${state.enemy.name} prepares to strike…`,
  }, now);
}

function beginEnemyTurn(state, now) {
  const patternIndex = state.enemyTurns % state.enemy.patterns.length;
  const hits = state.enemy.patterns[patternIndex].map(hit => ({
    ...hit, damage: hit.damage + Math.floor((state.fight - 1) / 2),
  }));
  return {
    ...state,
    phase: 'enemy',
    hits,
    patternIndex,
    enemyTurns: state.enemyTurns + 1,
    comboStartedAt: now,
    hitIndex: 0,
    impactAt: now + hits[0].time,
    allParried: true,
    defenseResult: null,
  };
}

export function parry(state, now) {
  return defend(state, now, 'parry');
}

export function dodge(state, now) {
  return defend(state, now, 'dodge');
}

function defend(state, now, action) {
  const late = state.phase === 'enemy' && now > state.impactAt;
  if (late) state = advanceEnemy(state, now);
  if (state.phase !== 'enemy' || state.defenseResult !== null) return state;
  const remaining = state.impactAt - now;
  const window = action === 'parry' ? PARRY_WINDOW_MS : DODGE_WINDOW_MS;
  // A late press for the previous hit must not spend the next hit's attempt.
  if (late && remaining > window) return state;
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
  const enemyHp = Math.max(0, state.enemyHp - (finished && allParried ? state.counterDamage : 0));
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
      : finished && allParried ? `Perfect combo! You counter for ${state.counterDamage} damage. Your turn.`
      : finished ? blocked ? 'Final hit avoided. No counter. Your turn.' : `Final hit deals ${damage} damage. No counter. Your turn.`
      : blocked ? `Hit ${hitIndex} ${parried ? 'parried' : 'dodged'}! Prepare for the next strike.`
      : `Hit ${hitIndex} deals ${damage} damage. Prepare for the next strike.`,
  };
}

export function advanceEnemy(state, now) {
  while (state.phase === 'enemy' && now >= state.impactAt) state = retaliate(state);
  return state;
}
