import { newCombat, attack, parry, advanceEnemy, ENEMY_ATTACK, PARRY_WINDOW_MS } from './combat.js';

let state = newCombat();
let enemyFrame;
const attackButton = document.querySelector('#attack');
const parryButton = document.querySelector('#parry');
const timeline = document.querySelector('#timeline');
const marker = document.querySelector('#marker');


function render() {
  document.querySelector('#player-hp').textContent = `${state.playerHp} / 30`;
  document.querySelector('#enemy-hp').textContent = `${state.enemyHp} / 24`;
  document.querySelector('#player-health').value = state.playerHp;
  document.querySelector('#enemy-health').value = state.enemyHp;
  document.querySelector('#message').textContent = state.message;
  attackButton.disabled = state.phase !== 'player';
  parryButton.disabled = state.phase !== 'enemy' || state.parryResult !== null;
  timeline.hidden = state.phase !== 'enemy';
  if (state.phase === 'enemy') {
    document.querySelector('#parry-window').style.width = `${PARRY_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#hit-label').textContent = `Strike ${state.hitIndex + 1} / ${ENEMY_ATTACK.impactTimes.length}`;
  }
}

function hitDuration() {
  const previous = state.hitIndex === 0 ? 0 : ENEMY_ATTACK.impactTimes[state.hitIndex - 1];
  return ENEMY_ATTACK.impactTimes[state.hitIndex] - previous;
}

function updateEnemy(now) {
  const next = advanceEnemy(state, now);
  if (next !== state) {
    state = next;
    render();
  }
  if (state.phase !== 'enemy') return;
  const progress = 1 - (state.impactAt - now) / hitDuration();
  marker.style.left = `${Math.max(0, progress) * 100}%`;
  enemyFrame = requestAnimationFrame(updateEnemy);
}

attackButton.addEventListener('click', () => {
  state = attack(state, performance.now());
  render();
  if (state.phase === 'enemy') {
    marker.style.left = '0%';
    enemyFrame = requestAnimationFrame(updateEnemy);
  }
});

function tryParry() {
  state = parry(state, performance.now());
  render();
}

parryButton.addEventListener('click', tryParry);
document.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || state.phase !== 'enemy') return;
  event.preventDefault();
  if (!event.repeat) tryParry();
});

document.querySelector('#restart').addEventListener('click', () => {
  cancelAnimationFrame(enemyFrame);
  state = newCombat();
  render();
});

render();
