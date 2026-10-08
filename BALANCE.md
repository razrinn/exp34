# Checkpoint 29 balance pass

Changed Heavy Strike's cost from 3 energy to 2. Damage, enemy health,
reward values, recovery, and defense windows stay the same. Existing saves work.

Both skills now cost 2 energy: spend it on 20+ damage or 12 HP recovery.
Prepared unlocks either skill after one basic attack with its first reward.
Counters still favor consistent parries; Heavy hitter suits dodge-focused play.

## Comparison

500 seeded runs per scenario and build, with the same seeds and action policy
before and after the change. Each configuration covers 10,500 runs.

| Scenario | Build | Before | After |
|---|---|---:|---:|
| 85% successful parries | Counter | 93.8% wins | 93.8% wins |
| 85% successful parries | Prepared | 89.8% wins | 93.4% wins |
| 85% successful parries | Heavy hitter | 88.8% wins | 94.0% wins |
| Perfect dodges | Heavy hitter | 8 boss turns | 6 boss turns |
| Mixed defense, 85% success | Heavy hitter | 11 boss turns | 7.7 boss turns |

Every build clears runs with perfect defense. Ignoring defense loses the first
fight. At 70% successful parries, runs remain challenging: simulated win rates
range from 19.2% to 29.8% after the change.

## Limits and follow-up

These success rates are simulation inputs, not measured human performance.
Mixed defense chooses dodge/parry per hit. The policy takes lethal blows first,
then heals when at least 12 HP is missing, then spends affordable energy on
Heavy Strike. It repeats one reward throughout the run and is not an optimal
planner. Average boss turns include failed boss attempts.

Run `npm run balance` to reproduce current results. Real playtesting still needs
to confirm animation readability, sound timing, difficulty, and mixed builds.
