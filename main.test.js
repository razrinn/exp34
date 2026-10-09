import { ENEMIES } from './combat.js';
import test from 'node:test';
import assert from 'node:assert/strict';

test('keyboard actions respect turns, costs, held keys, and browser controls', async () => {
  const elements = new Map();
  const popups = [];
  const listeners = {};
  const timers = new Map();
  let timerId = 0;
  let now = 0;
  const frames = new Map();
  let frameId = 0;
  const previous = { performance: globalThis.performance, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = {
    createElement: () => ({ style: {}, setAttribute() {}, animate: () => ({}), remove() {} }),
    body: { classList: { remove() {} } },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        setAttribute() {}, classList: { toggle(name, enabled) { this[name] = enabled; } }, style: { setProperty() {} }, dataset: {}, animations: [], clientWidth: 1280, clientHeight: 800, checked: false, listeners: {}, open: false,
        showModal() { this.open = true; },
        close() { this.open = false; },
        animate(frames, options) {
          const animation = { options, cancel() { this.cancelled = true; } };
          this.animations.push(animation); return animation;
        },
        getAnimations() { return this.animations.filter(animation => !animation.cancelled); },
        getBoundingClientRect() { return { left: 100, right: 200, width: 100, top: 200, height: 150 }; },
        append(node) { popups.push(node); },
        remove() {},
        addEventListener(type, handler) { this.listeners[type] = handler; },
      });
      return elements.get(selector);
    },
    querySelectorAll: () => [],
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  globalThis.performance = { now: () => now };
  globalThis.setTimeout = (fn, delay) => { timers.set(++timerId, { fn, at: now + delay }); return timerId; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const previousRandom = Math.random;
  Math.random = () => 0.5;
  const impact = () => { const [id, timer] = timers.entries().next().value; timers.delete(id); now = timer.at; timer.fn(); };
  const frame = (at, timestamp = at) => { now = at; const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(timestamp); };
  const press = (code, overrides = {}) => listeners.keydown({
    code, target: { matches: () => false }, preventDefault() {}, ...overrides,
  });
  const runSkill = (key, count, successes = [...Array(count).keys()]) => {
    press(key);
    assert.equal(elements.get('.timing-controls').hidden, false);
    for (let index = 0; index < count; index++) {
      const beatStart = now;
      assert.equal(elements.get('main').classList['timing-focus'], true);
      assert.equal(elements.get('#attack-timing').style.left, '150px');
      assert.equal(elements.get('#attack-timing').style.top, '310px');
      frame(beatStart + 1200);
      assert.equal(elements.get('#timing-step').textContent, `${index + 1} / ${count}`);
      for (let cue = 0; cue < 4; cue++) assert.equal(elements.get(`#timing-${cue}`).hidden, cue !== index);
      const code = elements.get(`#timing-${index}`).dataset.key;
      if (successes.includes(index)) elements.get(`#input-${code.slice(-1).toLowerCase()}`).listeners.click();
      const hp = elements.get('#enemy-hp').textContent;
      if (!successes.includes(index)) impact();
      assert.equal(elements.get('#enemy-hp').textContent, hp, 'input does not apply damage before contact');
      assert.equal(elements.get('.timing-controls').hidden, true);
      assert.equal(elements.get('main').classList['timing-focus'], false);
      press('KeyQ'); press('KeyE'); press('KeyP');
      impact();
      if (elements.get('#enemy-hp').textContent.startsWith('0 /')) return;
      if (index < count - 1) assert.equal(elements.get('.defenses').hidden, false);
      impact();
    }
  };
  const defend = (pattern, missFirst = false) => {
    const start = now;
    for (const [index, hit] of pattern.entries()) {
      frame(start + hit.time - 1);
      if (!(missFirst && index === 0)) press(hit.parryable === false ? 'KeyO' : 'KeyI');
      frame(start + hit.time + 1);
    }
    impact();
  };
  try {
    await import('./main.js');
    assert.equal(elements.get('.actions').hidden, false);
    assert.equal(elements.get('#parry').hidden, true);
    for (const overrides of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { target: { matches: () => true } }]) press('KeyQ', overrides);
    press('KeyW'); press('KeyE'); press('KeyP');
    assert.equal(timers.size, 0, 'unaffordable skills and full-health heal do nothing');
    runSkill('KeyQ', 2);
    assert.equal(elements.get('#enemy-hp').textContent, '40 / 48');
    assert.equal(elements.get('#energy').textContent, 'Energy: 1');
    press('KeyP'); press('KeyE');
    assert.equal(timers.size, 0, 'heal and attacks cannot interrupt enemy turn');
    defend(ENEMIES[0].patterns[0]);
    runSkill('KeyQ', 2, [0]);
    assert.equal(elements.get('#enemy-hp').textContent, '32 / 48', 'one missed strike loses that hit only');
    defend(ENEMIES[0].patterns[1]);
    runSkill('KeyW', 3);
    assert.equal(elements.get('#enemy-hp').textContent, '8 / 48');
    assert.equal(elements.get('#energy').textContent, 'Energy: 0');
    defend(ENEMIES[0].patterns[2]);
    runSkill('KeyQ', 2);
    assert.equal(elements.get('#upgrades').open, false, 'lethal contact waits for collapse');
    impact(); assert.equal(elements.get('#upgrades').open, true);
    press('KeyQ', { repeat: true }); assert.equal(elements.get('#upgrades').open, true);
    press('KeyQ'); assert.equal(elements.get('#upgrades').open, false);
    assert.match(elements.get('#build').textContent, /Parry charge: \+1 per parry/);
    elements.get('#restart').listeners.click();
    for (let turn = 0; turn < 3; turn++) {
      runSkill('KeyQ', 2, []); defend(ENEMIES[0].patterns[turn]);
    }
    assert.equal(elements.get('#energy').textContent, 'Energy: 3');
    runSkill('KeyE', 4);
    assert.equal(elements.get('#enemy-hp').textContent, '4 / 48');
    assert.equal(elements.get('#energy').textContent, 'Energy: 0');
    elements.get('#restart').listeners.click();
    runSkill('KeyQ', 2, []); defend(ENEMIES[0].patterns[0], true);
    assert.equal(elements.get('#player-hp').textContent, '35 / 40');
    runSkill('KeyQ', 2, []); defend(ENEMIES[0].patterns[1]);
    press('KeyP');
    assert.equal(elements.get('#player-hp').textContent, '40 / 40');
    assert.equal(elements.get('#energy').textContent, 'Energy: 0');
    assert.equal(elements.get('.actions').hidden, true, 'P heal spends the turn');
    elements.get('#restart').listeners.click();
    press('KeyQ'); elements.get('#restart').listeners.click();
    assert.equal(timers.size, 0, 'restart cancels a pending strike');
    assert.equal(elements.get('#attack-timing').hidden, true);
    press('KeyQ'); frame(now + 9000); impact(); impact();
    assert.equal(elements.get('#timing-step').textContent, '2 / 2', 'a stalled frame expires only the current cue');
    assert.equal(elements.get('main').classList['timing-focus'], true);
    elements.get('#restart').listeners.click();
  } finally {
    Math.random = previousRandom;
    Object.assign(globalThis, previous);
  }
});
