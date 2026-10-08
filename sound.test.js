import test from 'node:test';
import assert from 'node:assert/strict';
import { playCue } from './sound.js';

test('sound cues reuse the audio context, fade out, and disconnect their nodes', () => {
  const previous = globalThis.AudioContext;
  let contexts = 0;
  const oscillators = [];
  const gains = [];
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  globalThis.AudioContext = class {
    constructor() { contexts++; this.currentTime = 10; this.state = 'running'; }
    createOscillator() {
      const node = {
        frequency: parameter(), connect() {},
        start(time) { this.startTime = time; },
        stop(time) { this.stopTime = time; },
        disconnect() { this.disconnected = true; },
      };
      oscillators.push(node);
      return node;
    }
    createGain() {
      const node = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(node);
      return node;
    }
  };
  try {
    for (const kind of ['attack', 'heavy', 'hit', 'parry', 'dodge', 'counter', 'heal']) playCue(kind);
    assert.equal(contexts, 1);
    assert.equal(oscillators.length, 7);
    for (let i = 0; i < oscillators.length; i++) {
      assert.equal(oscillators[i].startTime, 10);
      assert.ok(oscillators[i].stopTime > 10 && oscillators[i].stopTime <= 10.25);
      oscillators[i].onended();
      assert.equal(oscillators[i].disconnected, true);
      assert.equal(gains[i].disconnected, true);
    }
  } finally {
    globalThis.AudioContext = previous;
  }
});
