import test from 'node:test';
import assert from 'node:assert/strict';

test('keyboard actions respect turns, costs, held keys, and browser controls', async () => {
  const elements = new Map();
  const listeners = {};
  const timers = new Map();
  let timerId = 0;
  let now = 0;
  const frames = new Map();
  let frameId = 0;
  const previous = { performance: globalThis.performance, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = {
    body: { classList: { remove() {} } },
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        style: {}, checked: false, listeners: {}, open: false,
        showModal() { this.open = true; },
        close() { this.open = false; },
        animate() {},
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
  const impact = () => { const [id, timer] = timers.entries().next().value; timers.delete(id); now = timer.at; timer.fn(); };
  globalThis.requestAnimationFrame = fn => { frames.set(++frameId, fn); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const frame = at => { now = at; const callbacks = [...frames.values()]; frames.clear(); for (const fn of callbacks) fn(now); };
  const press = (code, overrides = {}) => listeners.keydown({
    code, target: { matches: () => false }, preventDefault() {}, ...overrides,
  });
  try {
    await import('./main.js');
    for (const overrides of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { target: { matches: () => true } }]) press('KeyQ', overrides);
    let prevented = false;
    press('Space', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    prevented = false;
    press('Space', { target: { matches: selector => selector.includes('summary') }, preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    elements.get('#upgrades').open = true;
    press('KeyQ');
    press('Space', { preventDefault() { prevented = true; } });
    assert.equal(prevented, false);
    elements.get('#upgrades').open = false;
    assert.equal(timers.size, 0);
    press('KeyW');
    press('KeyE');
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    press('KeyQ');
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    assert.equal(elements.get('#attack').disabled, true);
    press('KeyQ');
    assert.equal(timers.size, 1);
    impact();
    assert.equal(elements.get('#enemy-hp').textContent, '40 / 48');
    assert.equal(elements.get('#energy').textContent, 'Energy: 1');
    press('KeyQ');
    press('KeyW');
    press('KeyE');
    assert.equal(elements.get('#enemy-hp').textContent, '40 / 48');
    press('ShiftLeft');
    assert.equal(elements.get('#dodge').disabled, true);
    assert.equal(elements.get('#parry').disabled, true);
    elements.get('#restart').listeners.click();
    press('KeyQ');
    elements.get('#restart').listeners.click();
    assert.equal(timers.size, 0);
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    press('KeyQ');
    impact();
    press('Space');
    assert.equal(elements.get('#parry').disabled, true);
    elements.get('#restart').listeners.click();
    press('KeyQ');
    impact();
    const start = now;
    // Late input arrives before the animation-frame loop has resolved the hit.
    now = start + 1501;
    press('Space');
    assert.equal(elements.get('#player-hp').textContent, '37 / 40');
    assert.equal(elements.get('#parry').disabled, false);
    press('KeyQ');
    assert.equal(timers.size, 0);
    now = start + 2080;
    press('Space');
    frame(start + 2201);
    assert.equal(elements.get('#player-hp').textContent, '37 / 40');
    assert.equal(elements.get('#parry').disabled, false);
    frame(start + 3101);
    assert.equal(elements.get('#player-hp').textContent, '32 / 40');
    assert.equal(elements.get('#turn-label').textContent, 'RECOVERING');
    assert.equal(elements.get('#attack').disabled, true);
    press('KeyQ');
    assert.equal(timers.size, 1);
    impact();
    assert.equal(elements.get('#attack').disabled, false);
    press('KeyQ');
    assert.equal(timers.size, 1);
    elements.get('#restart').listeners.click();
  } finally {
    Object.assign(globalThis, previous);
  }
});
