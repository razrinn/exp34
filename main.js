import { ATTACK_KEYS, ATTACK_BEAT_MS, ATTACK_WINDOW_MS, ATTACK_TARGET_MS, ATTACK_PROMPT_MS, attackMarker, attackTiming, advanceAttack, timeAttack } from './attack-timing.js';
import { newCombat, nextFight, startSkill, landSkillHit, finishSkill, skillDamage, PLAYER_SKILLS, parryCharge, COUNTER_DAMAGE, heal, parry, dodge, retaliate, PARRY_WINDOW_MS, DODGE_WINDOW_MS, HEAVY_STRIKE, HEAL, MAX_ENERGY, RUN_LENGTH } from './combat.js';
import { createScene } from './scene.js';
import { enemyPose, attackEffects, DEATH_MS, PLAYER_IMPACT_MS, PLAYER_ACTION_MS } from './animation.js';
import { playCue, setMusic, setMusicVolume } from './sound.js';
import { loadRun, saveRun, clearRun } from './save.js';

let scene;
try {
  scene = await createScene(document.querySelector('#battle-canvas'));
  if (scene) document.querySelector('.arena').classList.add('has-webgl');
} catch (error) {
  console.warn('WebGL unavailable; using symbol scene.', error);
}
let state = loadRun();
let enemyFrame;
let actionTimer;
let actionPending = false;
let timedAttack = null;
let timingFrame;
const attackButton = document.querySelector('#attack');
const heavyButton = document.querySelector('#heavy');
const onslaughtButton = document.querySelector('#onslaught');
const healButton = document.querySelector('#heal');
const parryButton = document.querySelector('#parry');
const dodgeButton = document.querySelector('#dodge');
const timeline = document.querySelector('#timeline');
const marker = document.querySelector('#marker');
const enemyFigure = document.querySelector('#enemy-symbol');
const practice = document.querySelector('#practice');
const rewards = document.querySelector('#upgrades');
const result = document.querySelector('#run-complete');
const attackCue = document.querySelector('#attack-cue');
const playerFigure = document.querySelector('#player-symbol');
const sound = document.querySelector('#sound');
const guide = document.querySelector('#guide');
guide.addEventListener('close', () => {
  try { localStorage.setItem('exp34-guide-seen', '1'); } catch {}
});
const music = document.querySelector('#music');
let audioStarted = false;
async function updateMusic() {
  const played = await setMusic(audioStarted && music.checked && !document.hidden);
  if (!played) document.querySelector('#sound-status').textContent = 'Music could not start. Try Test sound.';
}
function startAudio() {
  audioStarted = true;
  updateMusic();
}
document.addEventListener('pointerdown', startAudio, { once: true });
document.addEventListener('visibilitychange', updateMusic);
music.addEventListener('change', () => { audioStarted = true; updateMusic(); });
document.querySelector('#music-volume').addEventListener('input', event => setMusicVolume(event.target.value));

function saveCheckpoint() {
  document.querySelector('#save-status').textContent = saveRun(state)
    ? 'Run saved on this browser.' : 'Saving unavailable. Refreshing may reset your run.';
}

function saveIfEnded() {
  if (['victory', 'defeat', 'complete'].includes(state.phase)) saveCheckpoint();
}

function feedback(kind, target) {
  const colors = { attack: '#d1aa72', heavy: '#ffa75b', hit: '#ef6868', parry: '#91e8ff', dodge: '#94a2be', counter: '#fff0a0', heal: '#8ae4a0' };
  scene?.feedback(kind, target === playerFigure ? 'player' : 'enemy', colors[kind]);
  target.animate([
    { filter: `brightness(1.8) drop-shadow(0 0 22px ${colors[kind]})`, opacity: kind === 'dodge' ? 0.3 : 1 },
    { filter: 'brightness(1)', opacity: 1 },
  ], { duration: 250 });
  if (sound.checked) playSound(kind);
}

function showDamage(amount, target, delay = 0) {
  if (amount <= 0) return;
  if (scene) { scene.damage(amount, target === playerFigure ? 'player' : 'enemy', delay); return; }
  const number = document.createElement('span');
  number.className = `damage-number ${target === playerFigure ? 'player' : 'enemy'}`;
  number.textContent = String(amount); number.setAttribute('role', 'status');
  number.ariaLabel = `${amount} damage to ${target === playerFigure ? 'you' : 'the enemy'}`;
  const bounds = target.getBoundingClientRect();
  number.style.left = `${Math.min(document.querySelector('.arena').clientWidth - 24, bounds.right + 16)}px`;
  number.style.top = `${bounds.top + bounds.height / 2}px`;
  document.querySelector('.arena').append(number);
  number.animate([{ opacity: 1, transform: 'translate(-50%, -50%)' }, { opacity: 0, transform: 'translate(-50%, calc(-50% - 50px))' }], { duration: 700 }).onfinish = () => number.remove();
}

function die(target, delay = 0) {
  if (scene) { scene.die(target === playerFigure ? 'player' : 'enemy', delay); return; }
  target.animate([{ transform: 'rotate(0deg)', opacity: 1 }, { transform: 'rotate(85deg)', opacity: .45 }], { duration: DEATH_MS, delay, fill: 'forwards' });
}

async function playSound(kind) {
  const played = await playCue(kind);
  document.querySelector('#sound-status').textContent = played
    ? '' : 'Audio could not start. Check browser sound permissions and try Test sound.';
}

document.querySelector('#test-sound').addEventListener('click', () => { startAudio(); playSound('parry'); });

function render() {
  document.querySelector('main').classList.toggle('timing-focus', actionPending === 'timing');
  scene?.focusPrompt(actionPending === 'timing');
  document.querySelector('#player-hp').textContent = `${state.playerHp} / ${state.playerMaxHp}`;
  document.querySelector('#enemy-name').textContent = state.enemy.name;
  document.querySelector('#enemy-symbol').textContent = state.enemy.symbol;
  document.querySelector('#enemy-hp').textContent = `${state.enemyHp} / ${state.enemyMaxHp}`;
  document.querySelector('#player-health').max = state.playerMaxHp;
  document.querySelector('#enemy-health').max = state.enemyMaxHp;
  document.querySelector('#player-health').value = state.playerHp;
  document.querySelector('#enemy-health').value = state.enemyHp;
  const message = state.message
    .replace(/You deal \d+ damage\. ?/, '')
    .replace(/Hit \d+ deals \d+ damage\. ?/, '')
    .replace(/Final hit deals \d+ damage\. No counter\. ?/, '')
    .replace(/You counter for \d+ damage\. ?/i, '')
    .concat(state.phase === 'player' && state.parryBonus ? ` Parry charge: +${state.parryBonus} next attack.` : '');
  document.querySelector('#message').textContent = actionPending === 'timing'
    ? '' : actionPending === 'recovery'
    ? message.replace(/Your turn\./gi, 'Recovering…') : message;
  document.querySelector('#fight-label').textContent = `Fight ${state.fight} / ${RUN_LENGTH}${state.fight === RUN_LENGTH ? ' · FINAL BOSS' : ''}`;
  if (state.phase === 'victory' && !actionPending) {
    if (!rewards.open) rewards.showModal();
  } else if (rewards.open) rewards.close();
  if ((state.phase === 'complete' || state.phase === 'defeat') && !actionPending) {
    document.querySelector('#result-title').textContent = state.phase === 'complete' ? 'Dawn breaks.' : 'The light fades.';
    document.querySelector('#result-text').textContent = state.phase === 'complete' ? 'The Warden falls. Five battles won. The road is yours.' : `Fallen at encounter ${state.fight} of ${RUN_LENGTH}. The road will remember you.`;
    result.dataset.outcome = state.phase;
    if (!result.open) result.showModal();
  } else if (result.open) result.close();
  document.querySelector('#turn-label').textContent = actionPending === 'timing' ? 'FIND THE RHYTHM' : actionPending === 'attack' ? 'STRIKING' : actionPending ? 'RECOVERING' : state.phase === 'player' ? 'YOUR TURN' : state.phase === 'enemy' ? 'DEFEND' : 'ENCOUNTER ENDED';
  document.querySelector('#attack-detail').textContent = `2 strikes · ${skillDamage(state, 'quick')} damage · +1 energy`;
  attackButton.disabled = !!actionPending || state.phase !== 'player';
  const charge = parryCharge(state);
  document.querySelector('#build').textContent = `Counter: ${COUNTER_DAMAGE} · Parry charge: +${charge.gain} per parry (max ${charge.cap}) · Ready: +${state.parryBonus} · Starting energy: ${Math.min(MAX_ENERGY, state.startingEnergy)}`;
  document.querySelector('#counter-gain').textContent = `Next attack: +${charge.gain} → +${charge.gain + 1} per parry · charge cap ${charge.cap} → ${charge.cap + 3}`;
  document.querySelector('[data-upgrade="energy"]').disabled = state.startingEnergy >= MAX_ENERGY;
  document.querySelector('#energy-gain').textContent = state.startingEnergy >= MAX_ENERGY ? 'Starting energy · 3 / 3 · MAX' : `Starting energy · ${state.startingEnergy} → ${state.startingEnergy + 1}`;
  document.querySelector('#heavy-gain').textContent = `All skills: Quickstep +1 · Flurry +6 · Onslaught +6 damage`;
  document.querySelector('#player-energy').max = MAX_ENERGY;
  document.querySelector('#player-energy').value = state.energy;
  document.querySelector('#energy').textContent = `${state.energy} / ${MAX_ENERGY}`;
  document.querySelector('#heavy-detail').textContent = `3 strikes · ${skillDamage(state, 'heavy')} damage · 2 energy`;
  heavyButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < HEAVY_STRIKE.cost;
  document.querySelector('#heal-detail').textContent = `${HEAL.amount} HP · ${HEAL.cost} energy`;
  document.querySelector('#onslaught-detail').textContent = `4 strikes · ${skillDamage(state, 'onslaught')} damage · 3 energy`;
  onslaughtButton.title = document.querySelector('#onslaught-detail').textContent;
  onslaughtButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < 3;
  healButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < HEAL.cost || state.playerHp === state.playerMaxHp;
  document.querySelector('.actions').hidden = state.phase === 'enemy' || actionPending === 'timing';
  document.querySelector('#attack-timing').hidden = actionPending !== 'timing';
  document.querySelector('.timing-controls').hidden = actionPending !== 'timing';
  document.querySelector('.defenses').hidden = actionPending === 'timing' || ['victory', 'defeat', 'complete'].includes(state.phase);
  parryButton.hidden = dodgeButton.hidden = state.phase !== 'enemy';
  attackButton.title = document.querySelector('#attack-detail').textContent;
  heavyButton.title = document.querySelector('#heavy-detail').textContent;
  healButton.title = document.querySelector('#heal-detail').textContent;
  parryButton.disabled = state.phase !== 'enemy' || state.defenseResult !== null;
  dodgeButton.disabled = parryButton.disabled;
  renderCue(performance.now());
  if (state.phase === 'enemy') {
    const red = state.hits[state.hitIndex].parryable === false;
    attackCue.textContent = red ? '✕' : '◇';
    attackCue.ariaLabel = red ? 'Dodge only' : 'Parry or dodge';
    attackCue.dataset.type = red ? 'red' : 'yellow';
    document.querySelector('#parry-window').hidden = red;
    parryButton.title = red ? 'Unparryable. Dodge with O.' : 'Parry with I.';
  }
  timeline.hidden = state.phase !== 'enemy' || !practice.checked;
  if (state.phase !== 'enemy') {
    enemyFigure.style.transform = '';
    scene?.render(state.enemy.name);
  }
  if (state.phase === 'enemy') {
    scene?.render(state.enemy.name, { impactAt: state.impactAt, duration: hitDuration(), hitIndex: state.hitIndex, style: hitStyle(), parryable: state.hits[state.hitIndex].parryable !== false });
    document.querySelector('#dodge-window').style.width = `${DODGE_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#parry-window').style.width = `${PARRY_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#hit-label').textContent = `Combo ${state.patternIndex + 1} · Strike ${state.hitIndex + 1} / ${state.hits.length} · ${state.hits[state.hitIndex].damage} damage`;
  }
}

function renderCue(now) {
  attackCue.hidden = state.phase !== 'enemy' || !attackEffects(state.impactAt - now, hitDuration()).cue;
  if (!scene && !attackCue.hidden) {
    const bounds = enemyFigure.getBoundingClientRect?.();
    if (bounds) {
      attackCue.style.left = `${bounds.left + bounds.width / 2}px`;
      attackCue.style.top = `${bounds.top + bounds.height * .55}px`;
    }
  }
}

function hitStyle() { return state.hits[state.hitIndex].style || state.enemy.attackStyles[state.patternIndex]; }

function hitDuration() {
  const previous = state.hitIndex === 0 ? 0 : state.hits[state.hitIndex - 1].time;
  return state.hits[state.hitIndex].time - previous;
}

function resolveEnemy(now, beforeInput = false) {
  let changed = false;
  while (state.phase === 'enemy' && (beforeInput ? now > state.impactAt : now >= state.impactAt)) {
    const next = retaliate(state);
    scene?.enemyImpact(state.impactAt, next.phase !== 'enemy', hitStyle(), next.phase === 'enemy' ? next.impactAt - state.impactAt : null);
    feedback(state.defenseResult === 'parry' ? 'parry' : state.defenseResult === 'dodge' ? 'dodge' : 'hit', playerFigure);
    showDamage(state.playerHp - next.playerHp, playerFigure);
    const countered = next.enemyHp < state.enemyHp;
    if (countered) showDamage(state.enemyHp - next.enemyHp, enemyFigure, PLAYER_IMPACT_MS);
    if (countered) feedback('counter', enemyFigure);
    if (next.playerHp === 0) die(playerFigure);
    if (next.enemyHp === 0) die(enemyFigure, PLAYER_IMPACT_MS);
    if (next.phase !== 'enemy') {
      actionPending = 'recovery';
      const duration = next.phase === 'player'
        ? countered ? PLAYER_ACTION_MS : 300
        : (countered ? PLAYER_IMPACT_MS : 0) + DEATH_MS + 100;
      actionTimer = setTimeout(() => { actionPending = false; render(); }, duration);
    }
    state = next;
    changed = true;
  }
  if (changed) { saveIfEnded(); render(); }
}

function updateEnemy(now) {
  now = performance.now();
  resolveEnemy(now);
  if (state.phase !== 'enemy') return;
  renderCue(now);
  const progress = 1 - (state.impactAt - now) / hitDuration();
  const pose = enemyPose(state.impactAt - now, hitDuration());
  enemyFigure.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotation}deg)`;
  marker.style.left = `${Math.max(0, progress) * 100}%`;
  enemyFrame = requestAnimationFrame(updateEnemy);
}

function tryAction(skill) {
  if (actionPending || state.phase !== 'player') return;
  if (skill === heal) { commitHeal(); return; }
  const next = startSkill(state, skill);
  if (next === state) return;
  state = next;
  const definition = PLAYER_SKILLS[skill];
  timedAttack = { ...attackTiming(performance.now(), definition.strikes), skill };
  scene?.startPlayerCombo();
  beginPlayerBeat(0);
}

function beginPlayerBeat(index) {
  timedAttack.startedAt = performance.now() - index * ATTACK_BEAT_MS;
  actionPending = 'timing';
  render();
  scene?.startAction(PLAYER_SKILLS[timedAttack.skill].moves[index], index);
  updateAttackTiming();
  actionTimer = setTimeout(() => releasePlayerBeat(index), ATTACK_PROMPT_MS);
}

function releasePlayerBeat(index) {
  if (!timedAttack || actionPending !== 'timing') return;
  clearTimeout(actionTimer);
  timedAttack = advanceAttack(timedAttack, Math.min(performance.now(), timedAttack.startedAt + state.skillHits * ATTACK_BEAT_MS + ATTACK_PROMPT_MS));
  const success = timedAttack.results[index] === true;
  const kind = PLAYER_SKILLS[timedAttack.skill].moves[index];
  cancelAnimationFrame(timingFrame);
  actionPending = 'attack';
  scene?.focusPrompt(false);
  const impactDelay = scene?.releasePlayerStrike() ?? PLAYER_IMPACT_MS;
  render();
  actionTimer = setTimeout(() => {
    const next = landSkillHit(state, index, success);
    if (success) feedback(kind === 'heavy' ? 'heavy' : 'attack', enemyFigure);
    else {
      if (scene) scene.evade();
      else enemyFigure.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(40px)' }, { transform: 'translateX(0)' }], { duration: 300 });
      if (sound.checked) playSound('dodge');
    }
    showDamage(state.enemyHp - next.enemyHp, enemyFigure);
    state = next;
    if (state.enemyHp === 0) {
      timedAttack = null; scene?.endPlayerCombo(); die(enemyFigure);
      actionPending = 'recovery'; saveIfEnded(); render();
      actionTimer = setTimeout(() => { actionPending = false; render(); }, DEATH_MS + 100);
      return;
    }
    render();
    actionTimer = setTimeout(() => {
      if (index + 1 < timedAttack.keys.length) beginPlayerBeat(index + 1);
      else {
        timedAttack = null; scene?.endPlayerCombo();
        state = finishSkill(state, performance.now());
        actionPending = false; render(); updateEnemy(performance.now());
      }
    }, ATTACK_BEAT_MS - ATTACK_PROMPT_MS - impactDelay);
  }, impactDelay);
}

function updateAttackTiming() {
  if (!timedAttack || actionPending !== 'timing') return;
  const now = Math.min(performance.now(), timedAttack.startedAt + state.skillHits * ATTACK_BEAT_MS + ATTACK_PROMPT_MS);
  timedAttack = advanceAttack(timedAttack, now);
  const active = state.skillHits;
  const prompt = document.querySelector('#attack-timing');
  const bounds = playerFigure.getBoundingClientRect();
  const arena = document.querySelector('.arena');
  const anchor = scene?.promptPosition() || { left: bounds.left + bounds.width / 2, top: bounds.top - 16 };
  prompt.style.left = `${Math.max(110, Math.min(arena.clientWidth - 110, anchor.left))}px`;
  prompt.style.top = `${Math.max(310, Math.min(arena.clientHeight - 160, anchor.top))}px`;
  document.querySelector('#timing-step').textContent = `${active + 1} / ${timedAttack.keys.length}`;
  for (let index = 0; index < 4; index++) document.querySelector(`#timing-${index}`).hidden = index !== active;
  timedAttack.keys.forEach((code, index) => {
    const cue = document.querySelector(`#timing-${index}`);
    cue.hidden = index !== active;
    const elapsed = now - timedAttack.startedAt - index * ATTACK_BEAT_MS;
    cue.dataset.result = timedAttack.results[index] === null ? 'pending' : timedAttack.results[index] ? 'hit' : 'miss';
    cue.dataset.active = String(elapsed >= 0 && elapsed < ATTACK_BEAT_MS);
    cue.dataset.window = String(Math.abs(elapsed - ATTACK_TARGET_MS) <= ATTACK_WINDOW_MS / 2);
    cue.dataset.key = code;
    cue.ariaLabel = `Timed attack ${code.slice(-1)}: ${cue.dataset.result}`;
    document.querySelector(`#timing-label-${index}`).textContent = code.slice(-1);
    document.querySelector(`#timing-icon-${index}`).setAttribute('href', `#icon-${code.slice(-1).toLowerCase()}`);
    const marker = attackMarker(elapsed);
    const dot = document.querySelector(`#timing-marker-${index}`);
    dot.setAttribute('cx', marker.x);
    dot.setAttribute('cy', marker.y);
  });
  if (timedAttack.results[active] !== null) { releasePlayerBeat(active); return; }
  timingFrame = requestAnimationFrame(updateAttackTiming);
}

function tryTiming(code) {
  if (!timedAttack) return;
  if (actionPending !== 'timing') return;
  timedAttack = timeAttack(timedAttack, code, Math.min(performance.now(), timedAttack.startedAt + state.skillHits * ATTACK_BEAT_MS + ATTACK_PROMPT_MS));
  updateAttackTiming();
}

ATTACK_KEYS.forEach(code => document.querySelector(`#input-${code.slice(-1).toLowerCase()}`).addEventListener('click', () => tryTiming(code)));

function commitHeal() {
  const next = heal(state, performance.now());
  if (next === state) return;
  feedback('heal', playerFigure); state = next; render(); updateEnemy(performance.now());
}

attackButton.addEventListener('click', () => tryAction('quick'));
heavyButton.addEventListener('click', () => tryAction('heavy'));
onslaughtButton.addEventListener('click', () => tryAction('onslaught'));
healButton.addEventListener('click', () => tryAction(heal));

practice.addEventListener('change', render);

function tryDefense(action) {
  const now = performance.now();
  const next = action(state, now);
  resolveEnemy(now, true);
  state = next;
  saveIfEnded();
  render();
}

parryButton.addEventListener('click', () => tryDefense(parry));
dodgeButton.addEventListener('click', () => tryDefense(dodge));
document.addEventListener('keydown', (event) => {
  if (!audioStarted) startAudio();
  if (guide.open) return;
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target.matches('input, textarea, select, [contenteditable]')) return;
  if (result.open) {
    if (event.code === 'KeyP') { event.preventDefault(); if (!event.repeat) restartRun(); }
    return;
  }
  if (rewards.open) {
    const upgrade = { KeyQ: 'counter', KeyW: 'energy', KeyE: 'heavy' }[event.code];
    if (upgrade) {
      event.preventDefault();
      if (!event.repeat) chooseUpgrade(upgrade);
    }
    return;
  }
  const actions = { KeyQ: 'quick', KeyW: 'heavy', KeyE: 'onslaught' };
  const defense = ATTACK_KEYS.includes(event.code);
  if (!actions[event.code] && !defense) return;
  // Reserve the six play keys even outside their turn.
  event.preventDefault();
  if (event.repeat) return;
  if (actionPending === 'timing') { if (defense) tryTiming(event.code); return; }
  if (defense) {
    if (event.code === 'KeyP') tryAction(heal);
    else if (state.phase === 'enemy') tryDefense(event.code === 'KeyI' ? parry : dodge);
  } else tryAction(actions[event.code]);

});

function restartRun() {
  cancelAnimationFrame(enemyFrame);
  cancelAnimationFrame(timingFrame);
  timedAttack = null;
  clearTimeout(actionTimer);
  actionPending = false;
  scene?.reset();
  for (const figure of [playerFigure, enemyFigure]) for (const animation of figure.getAnimations?.() || []) animation.cancel();
  for (const number of document.querySelectorAll('.damage-number')) number.remove();
  state = newCombat();
  document.querySelector('#save-status').textContent = clearRun()
    ? 'New run. Save cleared.' : 'Could not clear the saved run. Browser storage is unavailable.';
  render();
}

document.querySelector('#restart').addEventListener('click', restartRun);
document.querySelector('#result-restart').addEventListener('click', restartRun);
for (const dialog of [rewards, result]) dialog.addEventListener('cancel', event => event.preventDefault());

document.querySelector('#fullscreen').hidden = !document.documentElement?.requestFullscreen;
document.querySelector('#fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    document.querySelector('#message').textContent = 'Fullscreen is unavailable in this browser.';
  }
});

function chooseUpgrade(upgrade) {
  const next = nextFight(state, upgrade);
  if (next === state) return;
  cancelAnimationFrame(enemyFrame);
  cancelAnimationFrame(timingFrame);
  timedAttack = null;
  clearTimeout(actionTimer);
  actionPending = false;
  scene?.reset();
  for (const figure of [playerFigure, enemyFigure]) for (const animation of figure.getAnimations?.() || []) animation.cancel();
  for (const number of document.querySelectorAll('.damage-number')) number.remove();
  state = next;
  saveCheckpoint();
  render();
}

for (const button of document.querySelectorAll('[data-upgrade]')) {
  button.addEventListener('click', () => chooseUpgrade(button.dataset.upgrade));
}

render();
if (state.playerHp === 0) die(playerFigure);
if (state.enemyHp === 0) die(enemyFigure);
document.body.classList.remove('loading');
document.querySelector('#loading').remove();

try {
  if (localStorage.getItem('exp34-guide-seen') !== '1') guide.showModal();
} catch { guide.showModal(); }
