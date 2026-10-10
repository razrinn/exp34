# Combat balance

Run `npm run balance` for the current seeded simulation: 500 runs per scenario
and build. These are assumed input success rates, not measured player win rates.
Combat values and patterns live in `combat.js`; the policy lives in
`scripts/balance.mjs`. Older balance passes are preserved in Git history.

Enemy hit damage is multiplied by 1.2 after stage scaling and rounded to the
nearest point. The opening combo deals 6/6/10 (22 total); the boss's first combo
deals 6/6/8/8/8/16 (52 total). Player damage and defense windows are unchanged.

## Current completion rates

| Scenario | Reprisal | Resolve | Ruin |
| --- | ---: | ---: | ---: |
| Perfect parry + red dodge | 100% | 100% | 100% |
| Perfect dodge | 100% | 100% | 100% |
| 85% parry + red dodge | 51.8% | 40.4% | 35% |
| 85% defense and attack cues | 43% | 25.4% | 25.4% |
| 95% dodge | 94.2% | 97.6% | 98.8% |
| 85% mixed defense | 42.6% | 28.4% | 26.6% |
| 70% parry + red dodge | 0% | 0% | 0% |
| No defense | 0% | 0% | 0% |

Perfect parry runs average 17.4–19 turns; perfect dodge runs average 22.9–30.5.
Parrying rewards the narrower window with charge and counters. Dodge is more
forgiving, but earns neither. All scenarios dodge red strikes; the defense
success rate also applies to those dodges. Attack cues are perfect unless noted.

## Simulation limits

The policy takes a lethal Quickstep or affordable Flurry first, heals when at
least 6 HP is missing and energy is available, then uses Onslaught, Flurry, or
Quickstep according to energy. It favors one reward throughout the run; Resolve
switches to Ruin when starting energy reaches its cap. Perfect completed attacks
can roll the game's critical bonus.

This fixed policy is not an optimal planner. Per-hit probabilities do not model
human learning, animation readability, device latency, or missed input streaks.
Different assumed parry and dodge rates do not establish equal real-world
skill or difficulty. Playtesting remains the guide for future tuning.
