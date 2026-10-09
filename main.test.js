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
        setAttribute() {}, style: { setProperty() {} }, dataset: {}, animations: [], clientWidth: 1280, checked: false, listeners: {}, open: false,
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
  const impact = () => {
    if (elements.get('#attack-timing')?.hidden === false) {
      const start = now;
      for (let index = 0; index < 3; index++) { now = start + 700 + index * 900; press(elements.get(`#timing-${index}`).dataset.key); }
      const [id, timer] = timers.entries().next().value; timers.delete(id); now = timer.at; timer.fn();
    }
    const [id, timer] = timers.entries().next().value; timers.delete(id); now = timer.at; timer.fn();
  };
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const frame = (at, timestamp = at) => { now = at; const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(timestamp); };
  const press = (code, overrides = {}) => listeners.keydown({
    code, target: { matches: () => false }, preventDefault() {}, ...overrides,
  });
  try {
    await import('./main.js');
    assert.equal(elements.get('.actions').hidden, false);
    assert.equal(elements.get('.defenses').hidden, true);
    for (const overrides of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { target: { matches: () => true } }]) press('KeyQ', overrides);
    let prevented = false;
    press('KeyI', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    prevented = false;
    press('Space', { target: { matches: selector => selector.includes('summary') }, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    elements.get('#upgrades').open = true;
    press('KeyQ');
    press('KeyI', { preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    elements.get('#upgrades').open = false;
    assert.equal(timers.size, 0);
    press('KeyW');
    press('KeyE');
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    press('KeyQ');
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    assert.equal(elements.get('#attack').disabled, true);
    assert.equal(elements.get('.timing-controls').hidden, false);
    press('KeyQ');
    assert.equal(timers.size, 1);
    impact();
    assert.equal(elements.get('#enemy-hp').textContent, '40 / 48');
    assert.equal(popups.at(-1).textContent, '8');
    assert.ok(popups.at(-1).className.includes('enemy'));
    assert.doesNotMatch(elements.get('#message').textContent, /8 damage/);
    assert.equal(elements.get('#energy').textContent, 'Energy: 1');
    assert.equal(elements.get('.actions').hidden, true);
    assert.equal(elements.get('.defenses').hidden, false);
    assert.equal(elements.get('.timing-controls').hidden, true);
    assert.equal(elements.get('#attack-cue').hidden, true);
    assert.equal(elements.get('#attack-cue').dataset.type, 'yellow');
    press('KeyQ');
    press('KeyW');
    press('KeyE');
    assert.equal(elements.get('#enemy-hp').textContent, '40 / 48');
    press('KeyO');
    assert.equal(elements.get('#dodge').disabled, true);
    assert.equal(elements.get('#parry').disabled, true);
    elements.get('#restart').listeners.click();
    press('KeyQ');
    elements.get('#restart').listeners.click();
    assert.equal(timers.size, 0);
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    press('KeyQ');
    impact();
    press('KeyI');
    assert.equal(elements.get('#parry').disabled, true);
    elements.get('#restart').listeners.click();
    press('KeyQ');
    impact();
    const start = now;
    // Late input arrives before the animation-frame loop has resolved the hit.
    frame(start + 1000);
    assert.equal(elements.get('#attack-cue').hidden, false);
    frame(start + 1300);
    assert.equal(elements.get('#attack-cue').hidden, true);
    now = start + 1501;
    press('KeyI');
    assert.equal(elements.get('#player-hp').textContent, '37 / 40');
    assert.equal(popups.at(-1).textContent, '3');
    assert.ok(popups.at(-1).className.includes('player'));
    assert.equal(elements.get('#parry').disabled, false);
    press('KeyQ');
    assert.equal(timers.size, 0);
    now = start + 2080;
    press('KeyI');
    // A queued RAF timestamp can predate the input; resolve against the live clock.
    frame(start + 2201, start + 2000);
    now = start + 2220;
    press('KeyI');
    press('KeyO');
    assert.equal(elements.get('#player-hp').textContent, '37 / 40');
    assert.equal(elements.get('#parry').disabled, false);
    frame(start + 3101);
    assert.equal(elements.get('#player-hp').textContent, '32 / 40');
    assert.equal(elements.get('#turn-label').textContent, 'RECOVERING');
    assert.equal(elements.get('#attack-cue').hidden, true);
    assert.equal(elements.get('#attack').disabled, true);
    press('KeyQ');
    assert.equal(timers.size, 1);
    impact();
    assert.equal(elements.get('#attack').disabled, false);
    press('KeyQ');
    assert.equal(timers.size, 1);
    elements.get('#restart').listeners.click();
    for (const [key, expected] of [['KeyQ', 'Counter: 7 damage'], ['KeyW', 'Starting energy: 1'], ['KeyE', 'Counter: 4 damage']]) {
      for (let round = 0; round < 4; round++) {
        press('KeyQ'); impact();
        const comboStart = now;
        const times = ENEMIES[0].patterns[round % 3].map(hit => hit.time);
        for (const time of times) {
          now = comboStart + time - 1;
          press('KeyI'); frame(comboStart + time + 1);
        }
        if (round === 3) {
          assert.equal(elements.get('#upgrades').open, false, 'finishing damage appears before rewards');
          const death = elements.get('#enemy-symbol').animations.at(-1).options;
          assert.equal(death.fill, 'forwards');
          assert.equal(death.delay, 320, 'counter collapse waits for contact');
        }
        if (timers.size) impact();
      }
      assert.equal(elements.get('#upgrades').open, true);
      press(key, { repeat: true });
      assert.equal(elements.get('#upgrades').open, true);
      press(key);
      assert.equal(elements.get('#upgrades').open, false);
      assert.match(elements.get('#fight-label').textContent, /Fight 2/);
      assert.equal(elements.get('#enemy-symbol').getAnimations().length, 0, 'new stage clears held death animation');
      assert.ok(elements.get('#build').textContent.includes(expected));
      if (key === 'KeyE') assert.match(elements.get('#heavy-detail').textContent, /^26 damage/);
      elements.get('#restart').listeners.click();
    }
    press('KeyQ');
    now += 2700;
    const [timingId, timingTimer] = timers.entries().next().value;
    timers.delete(timingId); timingTimer.fn(); impact();
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48', 'no timing inputs means an evade');
    assert.equal(elements.get('#energy').textContent, 'Energy: 1');
    assert.match(elements.get('#message').textContent, /evades/);
    elements.get('#restart').listeners.click();
    press('KeyQ');
    now += 700; elements.get(`#input-${elements.get('#timing-0').dataset.key.slice(-1).toLowerCase()}`).listeners.click();
    now += 2000;
    const [partialId, partialTimer] = timers.entries().next().value;
    timers.delete(partialId); partialTimer.fn(); impact();
    assert.equal(elements.get('#enemy-hp').textContent, '45 / 48', 'one success gives one third damage rounded');
    elements.get('#restart').listeners.click();
  } finally {
    Object.assign(globalThis, previous);
  }
});
