import test from 'node:test';
import assert from 'node:assert/strict';
import { playCue } from './sound.js';

test('sound cues reuse the audio context, fade out, and disconnect their nodes', async () => {
  const previous = globalThis.AudioContext;
  let contexts = 0;
  let instance;
  const oscillators = [];
  const gains = [];
  const parameter = () => ({ setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  globalThis.AudioContext = class {
    constructor() { contexts++; instance = this; this.currentTime = 10; this.state = 'running'; }
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
    for (const kind of ['attack', 'heavy', 'hit', 'parry', 'dodge', 'counter', 'heal']) assert.equal(await playCue(kind), true);
    assert.equal(contexts, 1);
    assert.equal(oscillators.length, 7);
    for (let i = 0; i < oscillators.length; i++) {
      assert.equal(oscillators[i].startTime, 10);
      assert.ok(oscillators[i].stopTime > 10 && oscillators[i].stopTime <= 10.25);
      oscillators[i].onended();
      assert.equal(oscillators[i].disconnected, true);
      assert.equal(gains[i].disconnected, true);
    }
    instance.state = 'suspended';
    instance.resume = async () => {
      assert.equal(oscillators.length, 7);
      instance.state = 'running';
    };
    assert.equal(await playCue('parry'), true);
    assert.equal(oscillators.length, 8);
    instance.state = 'suspended';
    instance.resume = async () => { throw new Error('Audio blocked'); };
    assert.equal(await playCue('parry'), false);
    assert.equal(oscillators.length, 8);
  } finally {
    globalThis.AudioContext = previous;
  }
});
