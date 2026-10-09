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
        style: {}, dataset: {}, checked: false, listeners: {}, open: false,
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
    assert.equal(elements.get('.actions').hidden, true);
    assert.equal(elements.get('.defenses').hidden, false);
    assert.equal(elements.get('#attack-cue').hidden, true);
    assert.equal(elements.get('#attack-cue').dataset.type, 'yellow');
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
    frame(start + 1000);
    assert.equal(elements.get('#attack-cue').hidden, false);
    frame(start + 1300);
    assert.equal(elements.get('#attack-cue').hidden, true);
    now = start + 1501;
    press('Space');
    assert.equal(elements.get('#player-hp').textContent, '37 / 40');
    assert.equal(elements.get('#parry').disabled, false);
    press('KeyQ');
    assert.equal(timers.size, 0);
    now = start + 2080;
    press('Space');
    // A queued RAF timestamp can predate the input; resolve against the live clock.
    frame(start + 2201, start + 2000);
    now = start + 2220;
    press('Space');
    press('ShiftLeft');
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
    for (const [key, expected] of [['Digit1', 'Counter: 7 damage'], ['Digit2', 'Starting energy: 1'], ['Digit3', 'Counter: 4 damage']]) {
      for (let round = 0; round < 4; round++) {
        press('KeyQ'); impact();
        const comboStart = now;
        const times = [[1500, 2200, 3100], [1800, 2800], [2400]][round % 3];
        for (const time of times) {
          now = comboStart + time - 1;
          press('Space'); frame(comboStart + time + 1);
        }
        if (timers.size) impact();
      }
      assert.equal(elements.get('#upgrades').open, true);
      press(key, { repeat: true });
      assert.equal(elements.get('#upgrades').open, true);
      press(key);
      assert.equal(elements.get('#upgrades').open, false);
      assert.match(elements.get('#fight-label').textContent, /Fight 2/);
      assert.ok(elements.get('#build').textContent.includes(expected));
      if (key === 'Digit3') assert.match(elements.get('#heavy-detail').textContent, /^26 damage/);
      elements.get('#restart').listeners.click();
    }
  } finally {
    Object.assign(globalThis, previous);
  }
});
