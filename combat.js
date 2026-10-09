export const ENEMIES = [
  {
    name: 'Sentinel', symbol: '♜', attackStyles: ['slash', 'chop', 'thrust'],
    patterns: [
      [{ time: 1500, damage: 3, style: 'slash' }, { time: 2200, damage: 3, style: 'chop' }, { time: 3100, damage: 5, style: 'thrust' }],
      [{ time: 1800, damage: 2, style: 'chop' }, { time: 2250, damage: 2, style: 'slash' }, { time: 3300, damage: 3, style: 'thrust' }, { time: 3900, damage: 4, style: 'chop' }],
      [{ time: 2400, damage: 1, style: 'thrust' }, { time: 2800, damage: 1, style: 'slash' }, { time: 3250, damage: 2, style: 'slash' }, { time: 4500, damage: 2, style: 'chop' }, { time: 5100, damage: 3, style: 'thrust' }],
    ],
  },
  {
    name: 'Duelist', symbol: '⚔', attackStyles: ['slash', 'chop', 'thrust'],
    patterns: [
      [{ time: 1200, damage: 3, style: 'slash' }, { time: 1600, damage: 2, style: 'slash' }, { time: 2800, damage: 2, style: 'chop' }, { time: 3200, damage: 1, style: 'thrust', parryable: false }, { time: 4400, damage: 3, style: 'slash' }],
      [{ time: 1600, damage: 3, style: 'chop' }, { time: 2000, damage: 2, style: 'thrust', parryable: false }, { time: 3100, damage: 3, style: 'slash' }, { time: 3600, damage: 3, style: 'chop' }],
      [{ time: 1300, damage: 1, style: 'thrust' }, { time: 1900, damage: 1, style: 'slash' }, { time: 2300, damage: 2, style: 'thrust', parryable: false }, { time: 3400, damage: 1, style: 'chop' }, { time: 3850, damage: 1, style: 'slash' }, { time: 4900, damage: 3, style: 'thrust' }],
    ],
  },
];
export const RUN_LENGTH = 5;
export const BOSS = {
  name: 'Warden', symbol: '♛', attackStyles: ['chop', 'slash', 'thrust'],
  patterns: [
    [{ time: 1400, damage: 2, style: 'chop' }, { time: 1800, damage: 2, style: 'slash' }, { time: 2700, damage: 3, style: 'thrust' }, { time: 3150, damage: 3, style: 'slash' }, { time: 4200, damage: 3, style: 'chop' }, { time: 5000, damage: 7, style: 'chop' }],
    [{ time: 1200, damage: 3, style: 'slash' }, { time: 1600, damage: 3, style: 'thrust', parryable: false }, { time: 2500, damage: 3, style: 'chop' }, { time: 2900, damage: 4, style: 'slash' }, { time: 4300, damage: 7, style: 'chop' }],
    [{ time: 1900, damage: 2, style: 'thrust' }, { time: 2300, damage: 3, style: 'thrust', parryable: false }, { time: 2700, damage: 2, style: 'slash' }, { time: 3900, damage: 3, style: 'chop' }, { time: 4350, damage: 3, style: 'thrust', parryable: false }, { time: 5500, damage: 7, style: 'chop' }],
  ],
};
export const PARRY_WINDOW_MS = 180;
export const DODGE_WINDOW_MS = 360;
export const LATE_INPUT_GRACE_MS = 80;
export const HEAVY_STRIKE = { cost: 2, damage: 20 };
export const HEAL = { cost: 2, amount: 12 };
export const RECOVERY_HP = 10;

export function newCombat() {
  return {
    playerHp: 40, playerMaxHp: 40, attackDamage: 8, energy: 0, startingEnergy: 0,
    // counterDamage retains the save format: 4 + 3 per Reprisal rank.
    counterDamage: 4, parryBonus: 0, heavyDamage: HEAVY_STRIKE.damage,
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
    attackDamage: state.attackDamage + (upgrade === 'heavy' ? 1 : 0),
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

export const PLAYER_SKILLS = {
  quick: { strikes: 2, cost: 0, moves: ['attack', 'counter'] },
  heavy: { strikes: 3, cost: 2, moves: ['attack', 'counter', 'heavy'] },
  onslaught: { strikes: 4, cost: 3, moves: ['attack', 'heavy', 'counter', 'heavy'] },
};

export function skillDamage(state, skill) {
  const base = skill === 'quick' ? state.attackDamage : state.heavyDamage + (skill === 'onslaught' ? 12 : 0);
  return base + (state.phase === 'attacking' ? state.skillBonus : state.parryBonus);
}

export function startSkill(state, skill) {
  const definition = PLAYER_SKILLS[skill];
  if (state.phase !== 'player' || !definition || state.energy < definition.cost) return state;
  return { ...state, phase: 'attacking', activeSkill: skill, skillHits: 0, skillPerfect: true, skillBonus: state.parryBonus, parryBonus: 0,
    energy: state.energy - definition.cost + (skill === 'quick' ? 1 : 0) };
}

export function landSkillHit(state, index, success, random = Math.random) {
  if (state.phase !== 'attacking' || index !== state.skillHits) return state;
  const total = skillDamage(state, state.activeSkill);
  const count = PLAYER_SKILLS[state.activeSkill].strikes;
  if (index >= count) return state;
  const skillPerfect = state.skillPerfect && success;
  const critical = index === count - 1 && skillPerfect && random() < 0.05;
  // Earlier strikes already landed; the final contact adds the full combo's bonus.
  const damage = (success ? Math.round(total * (index + 1) / count) - Math.round(total * index / count) : 0) + (critical ? total : 0);
  const enemyHp = Math.max(0, state.enemyHp - damage);
  return { ...state, enemyHp, skillHits: index + 1, skillPerfect, critical,
    phase: enemyHp === 0 ? state.fight === RUN_LENGTH ? 'complete' : 'victory' : 'attacking',
    message: critical ? 'Critical combo!' : success ? `Strike ${index + 1} lands.` : `The ${state.enemy.name} evades strike ${index + 1}.` };
}

export function finishSkill(state, now) {
  if (state.phase !== 'attacking' || state.skillHits !== PLAYER_SKILLS[state.activeSkill].strikes) return state;
  return beginEnemyTurn({ ...state, message: 'Your combo ends. Prepare to defend.' }, now);
}

export function attack(state, now = 0, quality = 1) {
  return strike(state, now, false, quality);
}

export function heavyStrike(state, now = 0, quality = 1) {
  return strike(state, now, true, quality);
}

function strike(state, now, heavy, quality) {
  if (state.phase !== 'player') return state;
  if (heavy && state.energy < HEAVY_STRIKE.cost) return state;
  const damage = Math.round(skillDamage(state, heavy ? 'heavy' : 'quick') * Math.max(0, Math.min(1, quality)));
  const enemyHp = Math.max(0, state.enemyHp - damage);
  const next = {
    ...state,
    enemyHp,
    parryBonus: 0,
    energy: state.energy + (heavy ? -HEAVY_STRIKE.cost : 1),
    phase: enemyHp === 0 ? state.fight === RUN_LENGTH ? 'complete' : 'victory' : 'enemy',
    message: enemyHp === 0 ? `Victory! The ${state.enemy.name} falls.` : damage === 0 ? `The ${state.enemy.name} evades your attack.` : `You deal ${damage} damage. The ${state.enemy.name} prepares to strike…`,
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
    ...hit, damage: Math.ceil(hit.damage * 1.5) + Math.floor((state.fight - 1) / 2),
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
  // Input owns the inclusive impact boundary, even when rendering is behind.
  while (state.phase === 'enemy' && now > state.impactAt) state = retaliate(state);
  if (state.phase !== 'enemy' || state.defenseResult !== null) return state;
  const remaining = state.impactAt - now;
  const window = action === 'parry' ? PARRY_WINDOW_MS : DODGE_WINDOW_MS;
  if (state.hitIndex > 0) {
    const previousImpact = state.comboStartedAt + state.hits[state.hitIndex - 1].time;
    // Ignore trailing presses regardless of whether the frame loop already advanced.
    if (now - previousImpact <= LATE_INPUT_GRACE_MS || remaining > window) return state;
  }
  const cannotParry = action === 'parry' && state.hits[state.hitIndex].parryable === false;
  const success = !cannotParry && remaining >= 0 && remaining <= window;
  return {
    ...state,
    defenseResult: cannotParry ? 'unparryable' : success ? action : 'miss',
    message: cannotParry ? 'Cannot parry red attacks. Attempt spent.' : success ? action === 'parry' ? 'Parry ready!' : 'Dodge ready!'
      : remaining > 0 ? 'Too early! Brace for impact.' : 'Too late!',
  };
}

export function retaliate(state) {
  if (state.phase !== 'enemy') return state;
  const parried = state.defenseResult === 'parry' && state.hits[state.hitIndex].parryable !== false;
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
    parryBonus: Math.min((state.counterDamage - 4) / 3 * 2, state.parryBonus + (parried ? (state.counterDamage - 4) / 3 : 0)),
    hitIndex,
    defenseResult: null,
    impactAt: finished ? null : state.comboStartedAt + state.hits[hitIndex].time,
    phase: playerHp === 0 ? 'defeat' : enemyHp === 0 ? state.fight === RUN_LENGTH ? 'complete' : 'victory' : finished ? 'player' : 'enemy',
    message: playerHp === 0 ? 'Defeat. Try again.'
      : enemyHp === 0 ? `Parried! Your counter finishes the ${state.enemy.name}. Victory!`
      : finished && allParried ? `Perfect combo! You counter for 4 damage. Your turn.`
      : finished ? blocked ? 'Final hit avoided. No counter. Your turn.' : `Final hit deals ${damage} damage. No counter. Your turn.`
      : blocked ? `Hit ${hitIndex} ${parried ? 'parried' : 'dodged'}! Prepare for the next strike.`
      : `Hit ${hitIndex} deals ${damage} damage. Prepare for the next strike.`,
  };
}

export function advanceEnemy(state, now) {
  while (state.phase === 'enemy' && now >= state.impactAt) state = retaliate(state);
  return state;
}
