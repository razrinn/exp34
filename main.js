import { newCombat, nextFight, attack, heavyStrike, heal, parry, dodge, advanceEnemy, PARRY_WINDOW_MS, DODGE_WINDOW_MS, HEAVY_STRIKE, HEAL, RUN_LENGTH } from './combat.js';
import { enemyPose } from './animation.js';
import { playCue } from './sound.js';
import { loadRun, saveRun, clearRun } from './save.js';

let state = loadRun();
let enemyFrame;
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
  document.querySelector('#message').textContent = state.message;
  document.querySelector('#fight-label').textContent = `Fight ${state.fight} / ${RUN_LENGTH}${state.fight === RUN_LENGTH ? ' · FINAL BOSS' : ''}`;
  if (state.phase === 'victory') {
    if (!rewards.open) rewards.showModal();
  } else if (rewards.open) rewards.close();
  if (state.phase === 'complete' || state.phase === 'defeat') {
    document.querySelector('#result-title').textContent = state.phase === 'complete' ? 'Expedition complete.' : 'Expedition fallen.';
    document.querySelector('#result-text').textContent = state.phase === 'complete' ? 'The Warden is defeated. All five encounters cleared.' : `Your expedition ended at fight ${state.fight}. Learn the rhythm and try again.`;
    if (!result.open) result.showModal();
  } else if (result.open) result.close();
  document.querySelector('#turn-label').textContent = state.phase === 'player' ? 'YOUR TURN' : state.phase === 'enemy' ? 'DEFEND' : 'ENCOUNTER ENDED';
  document.querySelector('#attack-detail').textContent = `${state.attackDamage} damage · +1 energy`;
  attackButton.disabled = state.phase !== 'player';
  document.querySelector('#build').textContent = `Counter: ${state.counterDamage} damage · Starting energy: ${state.startingEnergy}`;
  document.querySelector('[data-upgrade=counter]').textContent = `Stronger counters · ${state.counterDamage} → ${state.counterDamage + 3} damage`;
  document.querySelector('[data-upgrade=energy]').textContent = `Prepared · ${state.startingEnergy} → ${state.startingEnergy + 1} starting energy`;
  document.querySelector('[data-upgrade=heavy]').textContent = `Heavy hitter · ${state.heavyDamage} → ${state.heavyDamage + 6} damage`;
  document.querySelector('#energy').textContent = `Energy: ${state.energy}`;
  document.querySelector('#heavy-detail').textContent = `${state.heavyDamage} damage · ${HEAVY_STRIKE.cost} energy`;
  heavyButton.disabled = state.phase !== 'player' || state.energy < HEAVY_STRIKE.cost;
  document.querySelector('#heal-detail').textContent = `${HEAL.amount} HP · ${HEAL.cost} energy`;
  healButton.disabled = state.phase !== 'player' || state.energy < HEAL.cost || state.playerHp === state.playerMaxHp;
  parryButton.disabled = state.phase !== 'enemy' || state.defenseResult !== null;
  dodgeButton.disabled = parryButton.disabled;
  timeline.hidden = state.phase !== 'enemy' || !practice.checked;
  if (state.phase !== 'enemy') enemyFigure.style.transform = '';
  if (state.phase === 'enemy') {
    document.querySelector('#dodge-window').style.width = `${DODGE_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#parry-window').style.width = `${PARRY_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#hit-label').textContent = `Combo ${state.patternIndex + 1} · Strike ${state.hitIndex + 1} / ${state.hits.length} · ${state.hits[state.hitIndex].damage} damage`;
  }
}

function hitDuration() {
  const previous = state.hitIndex === 0 ? 0 : state.hits[state.hitIndex - 1].time;
  return state.hits[state.hitIndex].time - previous;
}

function updateEnemy(now) {
  const next = advanceEnemy(state, now);
  if (next !== state) {
    feedback(state.defenseResult === 'parry' ? 'parry' : state.defenseResult === 'dodge' ? 'dodge' : 'hit', playerFigure);
    if (next.enemyHp < state.enemyHp) feedback('counter', enemyFigure);
    state = next;
    saveIfEnded();
    render();
  }
  if (state.phase !== 'enemy') return;
  const progress = 1 - (state.impactAt - now) / hitDuration();
  const pose = enemyPose(state.impactAt - now, hitDuration());
  enemyFigure.style.transform = `translate(${pose.x}px, ${pose.y}px) rotate(${pose.rotation}deg)`;
  marker.style.left = `${Math.max(0, progress) * 100}%`;
  enemyFrame = requestAnimationFrame(updateEnemy);
}

function tryAction(action) {
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
  state = action(state, performance.now());
  saveIfEnded();
  render();
}

parryButton.addEventListener('click', () => tryDefense(parry));
dodgeButton.addEventListener('click', () => tryDefense(dodge));
document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target.matches('input, textarea, select, [contenteditable]')) return;
  if (state.phase === 'player') {
    const action = { KeyQ: attack, KeyW: heavyStrike, KeyE: heal }[event.code];
    if (!action) return;
    event.preventDefault();
    if (!event.repeat) tryAction(action);
    return;
  }
  if (state.phase !== 'enemy') return;
  if (!['Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;
  event.preventDefault();
  if (!event.repeat) tryDefense(event.code === 'Space' ? parry : dodge);
});

function restartRun() {
  cancelAnimationFrame(enemyFrame);
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

for (const button of document.querySelectorAll('[data-upgrade]')) {
  button.addEventListener('click', () => {
    cancelAnimationFrame(enemyFrame);
    state = nextFight(state, button.dataset.upgrade);
    saveCheckpoint();
    render();
  });
}

render();
