import assert from 'node:assert/strict';
import { newCombat, nextFight, attack, heavyStrike, heal, parry, dodge, advanceEnemy, HEAL, HEAVY_STRIKE, RUN_LENGTH } from '../combat.js';

// These are assumed input success rates, not measurements of player skill.
const scenarios = [
  { name: 'Perfect parry', defense: 'parry', success: 1 },
  { name: 'Perfect dodge', defense: 'dodge', success: 1 },
  { name: 'Parry 85%', defense: 'parry', success: 0.85 },
  { name: 'Dodge 95%', defense: 'dodge', success: 0.95 },
  { name: 'Mixed 85%', defense: 'mixed', success: 0.85 },
  { name: 'Parry 70%', defense: 'parry', success: 0.70 },
  { name: 'No defense', defense: 'parry', success: 0 },
];
const results = [];
for (const scenario of scenarios) {
  for (const build of ['counter', 'energy', 'heavy']) {
    let wins = 0;
    let totalTurns = 0;
    let bossTurns = 0;
    let bossVisits = 0;
    for (let run = 1; run <= 500; run++) {
      let seed = (run * 0x9e3779b9) >>> 0;
      const random = () => {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      };
      let state = newCombat();
      let turns = 0;
      while (state.phase === 'player') {
        let encounterTurns = 0;
        while (state.phase === 'player') {
          const action = state.enemyHp <= state.attackDamage ? attack
            : state.energy >= HEAVY_STRIKE.cost && state.enemyHp <= state.heavyDamage ? heavyStrike
            : state.playerHp <= state.playerMaxHp - HEAL.amount && state.energy >= HEAL.cost ? heal
            : state.energy >= HEAVY_STRIKE.cost ? heavyStrike : attack;
          state = action(state);
          turns++; encounterTurns++;
          assert.ok(turns < 200, 'Run must not stall');
          while (state.phase === 'enemy') {
            const impact = state.impactAt;
            const defense = scenario.defense === 'mixed' ? random() < 0.5 ? parry : dodge
              : scenario.defense === 'parry' ? parry : dodge;
            if (random() < scenario.success) state = defense(state, impact - 1);
            state = advanceEnemy(state, impact);
            assert.ok(state.playerHp >= 0 && state.enemyHp >= 0 && state.energy >= 0);
          }
        }
        if (state.fight === RUN_LENGTH) { bossTurns += encounterTurns; bossVisits++; }
        if (state.phase !== 'victory') break;
        state = nextFight(state, build);
      }
      if (state.phase === 'complete') wins++;
      totalTurns += turns;
      if (scenario.success === 1) assert.equal(state.phase, 'complete');
      if (scenario.success === 0) assert.equal(state.phase, 'defeat');
    }
    results.push({ scenario: scenario.name, build, wins: `${wins / 5}%`, turns: (totalTurns / 500).toFixed(1), bossTurns: bossVisits ? (bossTurns / bossVisits).toFixed(1) : '—' });
  }
}
console.table(results);
