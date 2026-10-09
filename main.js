import { newCombat, nextFight, attack, heavyStrike, heal, parry, dodge, retaliate, PARRY_WINDOW_MS, DODGE_WINDOW_MS, HEAVY_STRIKE, HEAL, RUN_LENGTH } from './combat.js';
import { createScene } from './scene.js';
import { enemyPose, PLAYER_IMPACT_MS, PLAYER_ACTION_MS } from './animation.js';
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
  document.querySelector('#message').textContent = actionPending === 'recovery'
    ? state.message.replace(/Your turn\./gi, 'Recovering…') : state.message;
  document.querySelector('#fight-label').textContent = `Fight ${state.fight} / ${RUN_LENGTH}${state.fight === RUN_LENGTH ? ' · FINAL BOSS' : ''}`;
  if (state.phase === 'victory') {
    if (!rewards.open) rewards.showModal();
  } else if (rewards.open) rewards.close();
  if (state.phase === 'complete' || state.phase === 'defeat') {
    document.querySelector('#result-title').textContent = state.phase === 'complete' ? 'Expedition complete.' : 'Expedition fallen.';
    document.querySelector('#result-text').textContent = state.phase === 'complete' ? 'The Warden is defeated. All five encounters cleared.' : `Your expedition ended at fight ${state.fight}. Learn the rhythm and try again.`;
    if (!result.open) result.showModal();
  } else if (result.open) result.close();
  document.querySelector('#turn-label').textContent = actionPending === 'attack' ? 'STRIKING' : actionPending ? 'RECOVERING' : state.phase === 'player' ? 'YOUR TURN' : state.phase === 'enemy' ? 'DEFEND' : 'ENCOUNTER ENDED';
  document.querySelector('#attack-detail').textContent = `${state.attackDamage} damage · +1 energy`;
  attackButton.disabled = !!actionPending || state.phase !== 'player';
  document.querySelector('#build').textContent = `Counter: ${state.counterDamage} damage · Starting energy: ${state.startingEnergy}`;
  document.querySelector('[data-upgrade=counter]').textContent = `[1] Stronger counters · ${state.counterDamage} → ${state.counterDamage + 3} damage`;
  document.querySelector('[data-upgrade=energy]').textContent = `[2] Prepared · ${state.startingEnergy} → ${state.startingEnergy + 1} starting energy`;
  document.querySelector('[data-upgrade=heavy]').textContent = `[3] Heavy hitter · ${state.heavyDamage} → ${state.heavyDamage + 6} damage`;
  document.querySelector('#energy').textContent = `Energy: ${state.energy}`;
  document.querySelector('#heavy-detail').textContent = `${state.heavyDamage} damage · ${HEAVY_STRIKE.cost} energy`;
  heavyButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < HEAVY_STRIKE.cost;
  document.querySelector('#heal-detail').textContent = `${HEAL.amount} HP · ${HEAL.cost} energy`;
  healButton.disabled = !!actionPending || state.phase !== 'player' || state.energy < HEAL.cost || state.playerHp === state.playerMaxHp;
  document.querySelector('.actions').hidden = state.phase === 'enemy';
  document.querySelector('.defenses').hidden = state.phase !== 'enemy';
  attackButton.title = document.querySelector('#attack-detail').textContent;
  heavyButton.title = document.querySelector('#heavy-detail').textContent;
  healButton.title = document.querySelector('#heal-detail').textContent;
  parryButton.disabled = state.phase !== 'enemy' || state.defenseResult !== null;
  dodgeButton.disabled = parryButton.disabled;
  attackCue.hidden = state.phase !== 'enemy';
  if (state.phase === 'enemy') {
    const red = state.hits[state.hitIndex].parryable === false;
    attackCue.textContent = red ? '✕ DODGE ONLY' : '◇ PARRY / DODGE';
    attackCue.dataset.type = red ? 'red' : 'yellow';
    document.querySelector('#parry-window').hidden = red;
    parryButton.title = red ? 'Unparryable. Dodge with Shift.' : 'Parry with Space.';
  }
  timeline.hidden = state.phase !== 'enemy' || !practice.checked;
  if (state.phase !== 'enemy') {
    enemyFigure.style.transform = '';
    scene?.render(state.enemy.name);
  }
  if (state.phase === 'enemy') {
    scene?.render(state.enemy.name, { impactAt: state.impactAt, duration: hitDuration(), hitIndex: state.hitIndex, style: state.enemy.attackStyles[state.patternIndex] });
    document.querySelector('#dodge-window').style.width = `${DODGE_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#parry-window').style.width = `${PARRY_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#hit-label').textContent = `Combo ${state.patternIndex + 1} · Strike ${state.hitIndex + 1} / ${state.hits.length} · ${state.hits[state.hitIndex].damage} damage`;
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
    const countered = next.enemyHp < state.enemyHp;
    if (countered) feedback('counter', enemyFigure);
    if (next.phase === 'player') {
      actionPending = 'recovery';
      actionTimer = setTimeout(() => { actionPending = false; render(); }, countered ? PLAYER_ACTION_MS : 300);
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
  const progress = 1 - (state.impactAt - now) / hitDuration();
  const pose = enemyPose(state.impactAt - now, hitDuration());
  enemyFigure.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotation}deg)`;
  marker.style.left = `${Math.max(0, progress) * 100}%`;
  enemyFrame = requestAnimationFrame(updateEnemy);
}

function tryAction(action) {
  if (actionPending || state.phase !== 'player' || action(state, performance.now()) === state) return;
  if (action === heal) { commitAction(action); return; }
  actionPending = 'attack';
  scene?.startAction(action === heavyStrike ? 'heavy' : 'attack');
  render();
  actionTimer = setTimeout(() => {
    actionPending = false;
    commitAction(action);
  }, PLAYER_IMPACT_MS);
}

function commitAction(action) {
  const next = action(state, performance.now());
  if (next === state) return;
  feedback(action === heal ? 'heal' : action === heavyStrike ? 'heavy' : 'attack', action === heal ? playerFigure : enemyFigure);
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
  if (event.ctrlKey || event.altKey || event.metaKey || result.open) return;
  if (rewards.open) {
    const upgrade = { Digit1: 'counter', Digit2: 'energy', Digit3: 'heavy', Numpad1: 'counter', Numpad2: 'energy', Numpad3: 'heavy' }[event.code];
    if (upgrade) {
      event.preventDefault();
      if (!event.repeat) chooseUpgrade(upgrade);
    }
    return;
  }
  if (event.code === 'Space' && event.target.matches('summary, #fullscreen, #restart, #test-sound')) return;
  if (event.target.matches('input, textarea, select, [contenteditable]')) return;
  const actions = { KeyQ: attack, KeyW: heavyStrike, KeyE: heal };
  const defense = ['Space', 'ShiftLeft', 'ShiftRight'].includes(event.code);
  if (!actions[event.code] && !defense) return;
  // Reserve combat keys even outside their turn, including focused-button Space.
  event.preventDefault();
  if (event.repeat) return;
  if (defense) {
    if (state.phase === 'enemy') tryDefense(event.code === 'Space' ? parry : dodge);
  } else tryAction(actions[event.code]);

});

function restartRun() {
  cancelAnimationFrame(enemyFrame);
  clearTimeout(actionTimer);
  actionPending = false;
  scene?.reset();
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
  clearTimeout(actionTimer);
  actionPending = false;
  scene?.reset();
  state = nextFight(state, upgrade);
  saveCheckpoint();
  render();
}

for (const button of document.querySelectorAll('[data-upgrade]')) {
  button.addEventListener('click', () => chooseUpgrade(button.dataset.upgrade));
}

render();
document.body.classList.remove('loading');
document.querySelector('#loading').remove();
