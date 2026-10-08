# exp34

A combat learning project inspired by turn-based battles with active defense.

Play at https://exp34.rzrn.dev while connected to Tailscale.

## Checkpoint 32

The hero is an armored knight. Sentinel, Duelist, and Warden use distinct skeleton
warrior, rogue, and mage models from KayKit, with textures and equipped weapons.
Three.js loads their glTF files and plays skeletal idle, attack, block, dodge, hit,
and heal animations. Enemy attack clips are sampled from the existing impact clock,
so longer wind-ups do not change the parry/dodge windows. Player movement still
comes from `actionPose` in `animation.js`. All files are served locally; WebGL2 runs
in your browser. Unsupported WebGL2 or failed asset loads use the symbol fallback.
Character files were reduced from about 17 MB to 2.6 MB by keeping only the combat
clips and pruning unused animation data. See [CREDITS.md](CREDITS.md) for sources.
Run `npm ci` before `npm start` on a fresh checkout. There is no bundler or WASM.

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
The timing bar is hidden by default. Watch the enemy pull back during wind-up
and swing toward you during the final 240 ms before impact. A flash marks impact.
Practice mode restores the timing bar without changing combat rules.
`animation.js` derives the enemy pose from the same impact time as defense checks;
the animation does not use a separate timer that can drift away from the strike.

Run `npm start` on the VPS. From your local machine, forward its port:

```sh
ssh -N -L 8034:127.0.0.1:8034 YOUR_SSH_HOST
```

Then open http://localhost:8034 in your local browser.
Use your usual SSH hostname or alias in place of `YOUR_SSH_HOST`.

Run `npm test` to check the combat rules.

Enemies start with 48 health against your 8-damage attack. A perfect combo
adds a 4-damage counter: four perfect rounds using only basic attacks win the first fight.
You start with 40 health. Missing a whole combo costs 11 health in the opening fights, leaving 29.
Each pattern pairs a hit time with its damage, e.g. `{ time: 3100, damage: 5 }`.

Every two fights adds 1 damage to every hit. For the three-hit variant,
fights 1–2 deal 3/3/5 and fights 3–4 deal 4/4/6. The boss's four-hit combos
deal 6/6/6/10 after scaling. Timing windows stay constant.

After each regular victory, choosing a reward restores up to 10 HP regardless
of the choice. Choose +3 counter damage, +1 starting energy, or +6 Heavy Strike
damage. Rewards stack within the run. Max health stays 40; recovery is capped.
Each next opponent has 12 more health. Restart clears the saved run.
`nextFight` carries the build into fresh combat state and resets energy to the
build's starting energy; unused energy does not carry over.

Basic attacks deal 8 damage and earn 1 energy. Heavy Strike costs 2 energy,
starts at 20 damage, and benefits from Heavy hitter rewards. Both end your turn.
Counter damage starts at 4 and benefits from Stronger counters rewards.

Heal costs 2 energy, restores up to 12 HP, and ends your turn. The enemy
attacks afterward using its next pattern. Healing at full health is disabled
and spends no energy. Recovery is capped at max health, including upgrades.
`beginEnemyTurn` starts the same enemy timeline after attacks or healing.

Damage flashes red; parries blue; counters gold; heals green. Dodges briefly
fade the player. Attacks and Heavy Strike also flash the enemy.
Short synthesized tones distinguish each event. Sound starts on your first
action and can be disabled in Help & settings. Test sound plays a clear parry
cue without starting a fight. Playback waits for browser audio to resume;
blocked audio is reported in settings. No audio files or dependencies.
Progress saves in this browser after encounter results and reward choices.
Refreshing mid-combat restarts that encounter from its saved starting health,
build, and energy. Refreshing at a reward screen preserves the pending choice;
defeat and completion also persist. Restart run clears the save.
Only progression fields are stored; enemy definitions and timing are rebuilt
from current game data. Invalid or incompatible saves start a fresh run.
If browser storage blocks writes, Help & settings reports that saving is unavailable.
The battle stays hidden behind a loading screen until the restored state is rendered,
so later stages do not briefly flash the first encounter's default UI.

Keyboard controls: Q attacks, W uses Heavy Strike, E heals, Space parries,
and Shift dodges. Holding a key does not repeat actions. Shortcuts respect
turn and energy rules and ignore text/form controls and Ctrl/Alt/Meta chords.

The battle fills the browser viewport; Fullscreen hides browser chrome where supported.
Combat controls sit along the bottom. Help & settings holds instructions, build stats,
and the practice toggle. Native modal dialogs separate rewards and run results
from combat, keep keyboard focus inside, and prevent premature dismissal.

Run `npm run balance` for a deterministic full-run benchmark (500 runs per
scenario/build). Success rates are assumed inputs, not measured player data.
The policy prioritizes lethal blows, healing when at least 12 HP is missing,
then affordable Heavy Strikes. Perfect defense clears every build; ignoring
defense loses. Heavy Strike costs 2 energy to make offense compete with healing
and shorten dodge-focused fights. See `BALANCE.md` for the comparison.
