import { newCombat, nextFight, attack, parry, dodge, advanceEnemy, PARRY_WINDOW_MS, DODGE_WINDOW_MS } from './combat.js';

let state = newCombat();
let enemyFrame;
const attackButton = document.querySelector('#attack');
const parryButton = document.querySelector('#parry');
const dodgeButton = document.querySelector('#dodge');
const timeline = document.querySelector('#timeline');
const marker = document.querySelector('#marker');


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
  document.querySelector('#fight-label').textContent = `Fight ${state.fight}`;
  document.querySelector('#upgrades').hidden = state.phase !== 'victory';
  attackButton.textContent = `Attack · ${state.attackDamage} damage`;
  attackButton.disabled = state.phase !== 'player';
  parryButton.disabled = state.phase !== 'enemy' || state.defenseResult !== null;
  dodgeButton.disabled = parryButton.disabled;
  timeline.hidden = state.phase !== 'enemy';
  if (state.phase === 'enemy') {
    document.querySelector('#dodge-window').style.width = `${DODGE_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#parry-window').style.width = `${PARRY_WINDOW_MS / hitDuration() * 100}%`;
    document.querySelector('#hit-label').textContent = `Combo ${state.patternIndex + 1} · Strike ${state.hitIndex + 1} / ${state.impactTimes.length}`;
  }
}

function hitDuration() {
  const previous = state.hitIndex === 0 ? 0 : state.impactTimes[state.hitIndex - 1];
  return state.impactTimes[state.hitIndex] - previous;
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

function tryDefense(action) {
  state = action(state, performance.now());
  render();
}

parryButton.addEventListener('click', () => tryDefense(parry));
dodgeButton.addEventListener('click', () => tryDefense(dodge));
document.addEventListener('keydown', (event) => {
  if (state.phase !== 'enemy') return;
  if (!['Space', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;
  event.preventDefault();
  if (!event.repeat) tryDefense(event.code === 'Space' ? parry : dodge);
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
