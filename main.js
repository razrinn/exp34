import { newCombat, nextFight, attack, parry, advanceEnemy, ENEMY_ATTACK, PARRY_WINDOW_MS } from './combat.js';

let state = newCombat();
let enemyFrame;
const attackButton = document.querySelector('#attack');
const parryButton = document.querySelector('#parry');
const timeline = document.querySelector('#timeline');
const marker = document.querySelector('#marker');


function render() {
  document.querySelector('#player-hp').textContent = `${state.playerHp} / ${state.playerMaxHp}`;
  document.querySelector('#enemy-hp').textContent = `${state.enemyHp} / ${state.enemyMaxHp}`;
  document.querySelector('#player-health').max = state.playerMaxHp;
  document.querySelector('#enemy-health').max = state.enemyMaxHp;
  document.querySelector('#player-health').value = state.playerHp;
  document.querySelector('#enemy-health').value = state.enemyHp;
  document.querySelector('#message').textContent = state.message;
  document.querySelector('#fight-label').textContent = `Fight ${state.fight}`;
  document.querySelector('#upgrades').hidden = state.phase !== 'victory';
  attackButton.textContent = `Attack · ${state.attackDamage} damage`;
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

for (const button of document.querySelectorAll('[data-upgrade]')) {
  button.addEventListener('click', () => {
    cancelAnimationFrame(enemyFrame);
    state = nextFight(state, button.dataset.upgrade);
    render();
  });
}

render();
