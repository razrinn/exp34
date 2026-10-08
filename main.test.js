import test from 'node:test';
import assert from 'node:assert/strict';

test('keyboard actions respect turns, costs, held keys, and browser controls', async () => {
  const elements = new Map();
  const listeners = {};
  const previous = { document: globalThis.document, requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, {
        style: {}, checked: false, listeners: {}, open: false,
        showModal() { this.open = true; },
        close() { this.open = false; },
        animate() {},
        addEventListener(type, handler) { this.listeners[type] = handler; },
      });
      return elements.get(selector);
    },
    querySelectorAll: () => [],
    addEventListener(type, handler) { listeners[type] = handler; },
  };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  const press = (code, overrides = {}) => listeners.keydown({
    code, target: { matches: () => false }, preventDefault() {}, ...overrides,
  });
  try {
    await import('./main.js');
    for (const overrides of [{ repeat: true }, { ctrlKey: true }, { altKey: true }, { metaKey: true }, { target: { matches: () => true } }]) press('KeyQ', overrides);
    press('KeyW');
    press('KeyE');
    assert.equal(elements.get('#enemy-hp').textContent, '48 / 48');
    press('KeyQ');
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
    press('Space');
    assert.equal(elements.get('#parry').disabled, true);
  } finally {
    Object.assign(globalThis, previous);
  }
});
