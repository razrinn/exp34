# exp34

A combat learning project inspired by turn-based battles with active defense.

Play at https://exp34.rzrn.dev while connected to Tailscale.

## Checkpoint 48

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

Basic and heavy strikes now approach, connect at 320 ms, then return home by 720 ms.
Damage, energy, sound, and enemy hit reactions resolve at contact, and the enemy
combo clock starts then. Repeated inputs during the approach are ignored; restart
cancels pending damage. Counter damage is awarded by the final parry; its visual follow-through finishes
before another attack is allowed. Enemy motion and clip time use `impactAt - performance.now()`: the enemy
arrives at the contact pose at zero. Slow follow-ups retreat fully; rapid hits use a short step-back.
All defense windows, damage values, and rhythm patterns are unchanged.
The normalized clip progress and smooth approach/retreat curves live in `animation.js`.

Attacks remain locked through the enemy's final recovery (300 ms, or 720 ms for a
counter). The six play keys are reserved for combat; dialogs and settings keep their native keyboard behavior. Late defenses
resolve overdue hits without spending an early attempt on the following strike.
Input and animation frames share the same hit-resolution feedback, including when
several hits are overdue. The camera looks diagonally over the hero's shoulder;
regular enemies are 3.5 units tall and the boss is 4.2, against the hero's 2.6.

Each regular enemy now cycles through sideways slash, overhead chop, and delayed
thrust animations with its three existing patterns. The boss cycles chop, slash,
and thrust. `attackStyles` on each enemy selects the clip; `ENEMY_ATTACKS` in
`animation.js` defines wind-up, contact pose, and release speed. Thrusts pull back
early and hold before releasing. Recovery continues the same clip that struck,
so a slash does not snap into a chop after impact. Hit times, damage, defense
windows, and combo lengths are unchanged; existing saves remain compatible.

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
Press I or click Parry in the final 180 ms (the gold zone) before each hit.
Each parry blocks that hit; opening hits deal 3, 3, then 5 damage. Parry the whole combo
for one automatic 4-damage counter at the end. Press O or click Dodge in the final 360 ms (blue or gold) to avoid a hit.
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

Keyboard controls: Q attacks, W uses Heavy Strike, E heals, I parries,
and O dodges. Holding a key does not repeat actions. Shortcuts respect
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

The arena now fills the viewport beneath a minimal overlay HUD. Only the active
turn's controls are visible: Attack/Heavy/Heal or Parry/Dodge. Damage and energy
costs live in settings and button tooltips. Characters start six world units apart,
close four units for contact, then return home after the combo. Rapid follow-ups
use a short step-back while longer pauses allow a full retreat. The portrait camera angle and
fog distance adapt to keep both sides visible. Damage and defense timing are unchanged.


Checkpoint 37 fixes defense at follow-up impact boundaries when frames are stale.
Both animation and combat frame loops read the live performance clock, so delayed
RAF timestamps cannot leave the next defense locked behind the previous strike.
Rewards use Q / W / E (counter / starting energy / heavy damage). Holding a reward key selects only once.

Attack effects follow the same impact clock: icy wind arcs for slashes, orange
fire arcs for chops, violet lightning for thrusts, weapon glow and local light
bursts. Hero Attack / Heavy / Counter use those same three effect families.
The arena includes distant mountains, ruined columns, drifting embers, and a
painted eclipse sky that keeps its proportions on portrait screens. These are
procedural Three.js geometry and a canvas texture, with no additional downloads.


Checkpoint 38 adds per-hit defense rules. Yellow cues mean parry or dodge;
red cues mean dodge only. A parry attempt on red takes the hit and uses that
hit's one defense attempt. The Duelist's third variant is red, and the Warden's
second and third variants finish red. The first encounter stays all-yellow.
A combo that includes a dodge gives no counter. Text and distinct symbols accompany
the cue colors; the practice bar hides its parry zone for red strikes.

Weapon effects now sample the actual blade's tip and base to draw a short,
fading trail. Floating rings and rotating lightning have been removed. Brief
sparks appear at contact, with restrained weapon glow and no colored face lights.
For follow-ups at most 500 ms apart, the enemy steps back one unit and attacks
again instead of rushing four units home and back. Longer pauses and completed
combos still retreat fully. The cue briefly flashes on the enemy before each strike on both
wide and portrait screens. Damage, timing windows, and existing saves are unchanged.


Checkpoint 39 ignores defense presses during the first 80 ms after the preceding
hit, whether or not the frame loop has resolved it yet. Early follow-up presses
outside that defense's window also leave the attempt available. The missed hit
still deals damage; this does not extend its defense window. For the fastest
400 ms follow-up, Dodge is available after that grace period (up to 320 ms before
impact); Parry retains its 180 ms window. The first hit still penalizes an early
attempt, and accepted attempts remain limited to one per hit.


Checkpoint 40 adds a charge glow and gathering particles at the actual weapon tip.
Charge grows during the wind-up and disappears at impact. Heavy hits emit a brief
expanding ground shockwave; hits and parries have brighter, longer contact sparks.
The yellow diamond / red cross is a sprite attached to the enemy's chest, with a
brief matching body flash, instead of a persistent floating text badge. It appears
roughly 650–320 ms before a normal strike, or 320–140 ms before a fast 400 ms
follow-up. Both the 3D scene and symbol fallback use the same timing helper.
The cue describes defense type, not the exact instant to press. Defense windows,
late-input grace, damage, and progression are unchanged.


Checkpoint 41 displays damage as number-only popups beside the fighter taking the
hit. Basic/heavy hits, individual enemy hits, and counters show actual HP lost;
blocked hits create no popup. Counter numbers wait for the visual contact, and
multiple combo numbers can coexist. They follow the fighter, rise and fade, and
clear on restart or a new stage. The symbol fallback also gets numeric popups.
Damage amounts no longer repeat in the bottom message; screen readers receive
an accessible damage description. Results wait briefly so the finishing number
and attack animation remain visible before the modal appears.

Enemy intent is shown through posture: slash coils sideways, chop lifts the
weapon overhead early, and thrust pulls back into a forward stance. Each prepares
quickly and holds until its existing swing, then releases the extra body pose at
contact. No attack-name labels were added. Impact deadlines, defense windows,
damage, and progression are unchanged.


Checkpoint 42 adds a simple death collapse for the knight and all three enemies.
The existing hurt clip leads into a short fall toward the arena, then the fighter
holds the fallen pose instead of returning to idle. Counter kills start the fall
at the counter's visual contact. Results wait until the collapse finishes; restart
and the next fight clear all death state. The symbol fallback falls and fades too.
Saved victories, defeats, and completion restore a fallen fighter behind the result
screen. No new character assets or dependencies were needed.

Checkpoint 43 replaces the rigid death tilt with KayKit’s skeletal Death_B clip
for the hero and every enemy. The full body staggers and collapses over 2.2 seconds,
then holds the final pose. Results wait for the collapse; stage reset restores idle.

Checkpoint 44 keeps yellow/red warnings on the brief chest indicator only,
removing the warning tint from the enemy body.

Checkpoint 45 turns rewards and run endings into full-screen expedition interludes.
Reprisal, Resolve, and Ruin preserve the three upgrades and Q/W/E shortcuts, with
explicit stat changes. Gold victory and crimson defeat treatments share the arena
backdrop, restrained sigils, and serif titles. Mobile uses compact stacked choices;
reduced-motion preferences disable the entrance animation.

Checkpoint 46 brings the expedition typography and gold linework into the battle
HUD: slender health bars, small corner sigils, transparent command strips and key
hints, and a matching help panel. Combat controls and HUD information stay intact.

Checkpoint 47 standardizes the name as exp34 and puts all play controls on QWE / IOP.
Q/W/E select Attack/Heavy/Heal or upgrades; I/O parry/dodge; P restarts after a run.
Attack and Heavy require three randomized I/O/P beats, 900 ms apart, with a 240 ms inclusive
window around each target. The marker travels clockwise from the top; the gold upper-left edge is the timing window. Each beat
accepts one attempt; held keys do not repeat. Damage is rounded from the fraction
of successful beats, and zero successes triggers an enemy evade. Basic energy gain
and Heavy cost still apply even on a miss. Healing and automatic counters stay direct.
Restart cancels timing, approach, and recovery. Existing saves remain compatible.

Checkpoint 48 replaces shrinking diamonds with a clockwise perimeter marker and
a gold timing segment only on the upper-left edge. The full edge matches the same
240 ms input window; the other three edges cover the lead-in. Each of the three
prompts independently chooses I, O, or P. Repeated keys are allowed.
