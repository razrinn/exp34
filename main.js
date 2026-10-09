import { ATTACK_KEYS, ATTACK_BEAT_MS, ATTACK_WINDOW_MS, ATTACK_TIMING_MS, attackTiming, advanceAttack, timeAttack, attackQuality } from './attack-timing.js';
import { newCombat, nextFight, attack, heavyStrike, heal, parry, dodge, retaliate, PARRY_WINDOW_MS, DODGE_WINDOW_MS, HEAVY_STRIKE, HEAL, RUN_LENGTH } from './combat.js';
import { createScene } from './scene.js';
import { enemyPose, attackEffects, DEATH_MS, PLAYER_IMPACT_MS, PLAYER_ACTION_MS } from './animation.js';
import { playCue } from './sound.js';
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

document.querySelector('#test-sound').addEventListener('click', () => playSound('parry'));

function render() {
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
    .replace(/You counter for \d+ damage\. ?/i, '');
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
  document.querySelector('#attack-detail').textContent = `${state.attackDamage} damage · +1 energy`;
  attackButton.disabled = !!actionPending || state.phase !== 'player';
  document.querySelector('#build').textContent = `Counter: ${state.counterDamage} damage · Starting energy: ${state.startingEnergy}`;
  document.querySelector('#counter-gain').textContent = `Counter · ${state.counterDamage} → ${state.counterDamage + 3} damage`;
  document.querySelector('#energy-gain').textContent = `Starting energy · ${state.startingEnergy} → ${state.startingEnergy + 1}`;
  document.querySelector('#heavy-gain').textContent = `Heavy strike · ${state.heavyDamage} → ${state.heavyDamage + 6} damage`;
  document.querySelector('#energy').textContent = `Energy: ${state.energy}`;
  document.querySelector('#heavy-detail').textContent = `${state.heavyDamage} damage · ${HEAVY_STRIKE.cost} energy`;
  heavyButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < HEAVY_STRIKE.cost;
  document.querySelector('#heal-detail').textContent = `${HEAL.amount} HP · ${HEAL.cost} energy`;
  healButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < HEAL.cost || state.playerHp === state.playerMaxHp;
  document.querySelector('.actions').hidden = state.phase === 'enemy' || actionPending === 'timing';
  document.querySelector('#attack-timing').hidden = actionPending !== 'timing';
  document.querySelector('.defenses').hidden = state.phase !== 'enemy';
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
    scene?.render(state.enemy.name, { impactAt: state.impactAt, duration: hitDuration(), hitIndex: state.hitIndex, style: state.enemy.attackStyles[state.patternIndex], parryable: state.hits[state.hitIndex].parryable !== false });
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

function hitDuration() {
  const previous = state.hitIndex === 0 ? 0 : state.hits[state.hitIndex - 1].time;
  return state.hits[state.hitIndex].time - previous;
}

function resolveEnemy(now, beforeInput = false) {
  let changed = false;
  while (state.phase === 'enemy' && (beforeInput ? now > state.impactAt : now >= state.impactAt)) {
    const next = retaliate(state);
    scene?.enemyImpact(state.impactAt, next.phase !== 'enemy', state.enemy.attackStyles[state.patternIndex], next.phase === 'enemy' ? next.impactAt - state.impactAt : null);
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

function tryAction(action) {
  if (actionPending || state.phase !== 'player' || action(state, performance.now()) === state) return;
  if (action === heal) { commitAction(action); return; }
  actionPending = 'timing';
  timedAttack = attackTiming(performance.now());
  render();
  updateAttackTiming();
  actionTimer = setTimeout(() => {
    timedAttack = advanceAttack(timedAttack, performance.now());
    const quality = attackQuality(timedAttack);
    timedAttack = null;
    cancelAnimationFrame(timingFrame);
    actionPending = 'attack';
    scene?.startAction(action === heavyStrike ? 'heavy' : 'attack');
    render();
    actionTimer = setTimeout(() => { actionPending = false; commitAction(action, quality); }, PLAYER_IMPACT_MS);
  }, ATTACK_TIMING_MS);
}

function updateAttackTiming() {
  if (!timedAttack) return;
  const now = performance.now();
  timedAttack = advanceAttack(timedAttack, now);
  ATTACK_KEYS.forEach((code, index) => {
    const button = document.querySelector(`#timing-${code.slice(-1).toLowerCase()}`);
    const elapsed = now - timedAttack.startedAt - index * ATTACK_BEAT_MS;
    button.dataset.result = timedAttack.results[index] === null ? 'pending' : timedAttack.results[index] ? 'hit' : 'miss';
    button.dataset.active = String(elapsed >= 0 && elapsed < ATTACK_BEAT_MS);
    button.dataset.window = String(Math.abs(elapsed - 700) <= ATTACK_WINDOW_MS / 2);
    button.style.setProperty('--ring-scale', String(Math.max(1, Math.min(2.5, 1 + (700 - elapsed) / 700))));
  });
  timingFrame = requestAnimationFrame(updateAttackTiming);
}

function tryTiming(code) {
  if (!timedAttack) return;
  timedAttack = timeAttack(timedAttack, code, performance.now());
}

for (const code of ATTACK_KEYS) document.querySelector(`#timing-${code.slice(-1).toLowerCase()}`).addEventListener('click', () => tryTiming(code));

function commitAction(action, quality = 1) {
  const next = action(state, performance.now(), quality);
  if (next === state) return;
  if (quality === 0) {
    if (scene) scene.evade();
    else enemyFigure.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(40px)' }, { transform: 'translateX(0)' }], { duration: 300 });
    if (sound.checked) playSound('dodge');
  }
  else feedback(action === heal ? 'heal' : action === heavyStrike ? 'heavy' : 'attack', action === heal ? playerFigure : enemyFigure);
  showDamage(state.enemyHp - next.enemyHp, enemyFigure);
  if (['victory', 'complete'].includes(next.phase)) {
    actionPending = 'recovery';
    die(enemyFigure);
    actionTimer = setTimeout(() => { actionPending = false; render(); }, DEATH_MS + 100);
  }
  state = next;
  saveIfEnded();
  render();
  if (state.phase === 'enemy') {
    marker.style.left = '0%';
    updateEnemy(performance.now());
  }
}

attackButton.addEventListener('click', () => tryAction(attack));
heavyButton.addEventListener('click', () => tryAction(heavyStrike));
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
  const actions = { KeyQ: attack, KeyW: heavyStrike, KeyE: heal };
  const defense = ATTACK_KEYS.includes(event.code);
  if (!actions[event.code] && !defense) return;
  // Reserve the six play keys even outside their turn.
  event.preventDefault();
  if (event.repeat) return;
  if (actionPending === 'timing') { if (defense) tryTiming(event.code); return; }
  if (defense) {
    if (state.phase === 'enemy' && event.code !== 'KeyP') tryDefense(event.code === 'KeyI' ? parry : dodge);
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
  if (state.phase !== 'victory') return;
  cancelAnimationFrame(enemyFrame);
  cancelAnimationFrame(timingFrame);
  timedAttack = null;
  clearTimeout(actionTimer);
  actionPending = false;
  scene?.reset();
  for (const figure of [playerFigure, enemyFigure]) for (const animation of figure.getAnimations?.() || []) animation.cancel();
  for (const number of document.querySelectorAll('.damage-number')) number.remove();
  state = nextFight(state, upgrade);
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
