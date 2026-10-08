# exp34

A combat learning project inspired by turn-based battles with active defense.

Play at https://exp34.rzrn.dev while connected to Tailscale.

## Checkpoint 19

One character, two regular enemies, a final boss, turns, health, restart, timed defenses, and counters.
Runs have five fights: Sentinel → Duelist → Sentinel → Duelist → Warden.
The Warden has three unique four-hit patterns: steady strikes, a quick pair
with a delayed finish, and a slow wind-up into rapid strikes.
At fight five, its hits deal 6/6/6/10 damage (28 total for a missed combo).
Parry all four hits to counter; dodging any hit forfeits the counter as usual.
Defeating it enters `complete`, ends progression, and leaves Restart run available.
Combat rules live in `combat.js`; `main.js` connects them to the screen.
The `phase` field determines which actions are allowed: player → enemy → player,
or victory/defeat when health reaches zero.

The sentinel strikes at 1500, 2200, and 3100 ms from the combo's start.
The Duelist strikes at 1200, 1600, and 2800 ms: two quick hits and a delayed finisher.
Each enemy has three rhythms, cycling in order on successive enemy turns.
Regular variants have three hits (3/3/5), two hits (5/6), or one heavy hit (9).
Those are opening-stage damages; the same stage scaling applies to every hit.
The Sentinel's single strike has a long wind-up; the Duelist's lands sooner.
Names, symbols, timing patterns, and per-hit damage live in `ENEMIES` in `combat.js`.
`enemyTurns % patterns.length` selects the next pattern; a new fight resets the cycle.
The run alternates Sentinel → Duelist → Sentinel, using the same combat rules.
Press Space or click Parry in the final 180 ms (the gold zone) before each hit.
Each parry blocks that hit; opening hits deal 3, 3, then 5 damage. Parry the whole combo
for one automatic 4-damage counter at the end. Press Shift or click Dodge in the final 360 ms (blue or gold) to avoid a hit.
Dodging any hit forfeits the counter for that combo, even if every other hit
is parried. You get one defense attempt per hit, shared by dodge and parry.
`hitIndex` tracks the strike; `allParried` remembers whether the combo is perfect.
Late frames resolve all overdue hits in order.
`performance.now()` measures elapsed time locally in the browser;
`requestAnimationFrame` updates the marker and resolves the strike at impact.
Timing is based on elapsed milliseconds, not the number of frames rendered.

Run `npm start` on the VPS. From your local machine, forward its port:

```sh
ssh -N -L 8034:127.0.0.1:8034 YOUR_SSH_HOST
```

Then open http://localhost:8034 in your local browser.
Use your usual SSH hostname or alias in place of `YOUR_SSH_HOST`.

Run `npm test` to check the combat rules.

Enemies start with 48 health against your 8-damage attack. A perfect combo
adds a 4-damage counter: four perfect rounds win the first fight.
You start with 40 health. Missing a whole combo costs 11 health in the opening fights, leaving 29.
Each pattern pairs a hit time with its damage, e.g. `{ time: 3100, damage: 5 }`.

Every two fights adds 1 damage to every hit. For the three-hit variant,
fights 1–2 deal 3/3/5 and fights 3–4 deal 4/4/6. The boss's four-hit combos
deal 6/6/6/10 after scaling. Timing windows stay constant.

After victory, choose +2 attack damage (keep current health) or +6 max health
with a full heal. Each next opponent has 12 more health. Upgrades accumulate
within the run. Restart run resets everything; refreshing also resets the run.
`nextFight` carries player progression into a fresh combat state.

Basic attacks earn 1 energy. Heavy Strike costs 3 energy and deals a fixed
20 damage. Both actions end your turn; insufficient energy prevents the skill
without changing state. Energy starts at 0 and resets between fights.
Attack upgrades improve the basic attack; Heavy Strike stays at 20 damage.

Healing skills, combat effects, and saving progress are not implemented yet.
