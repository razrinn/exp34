import test from 'node:test';
import assert from 'node:assert/strict';
import { playCue, setMusic, setMusicVolume } from './sound.js';

test('layered effects and music share a context, clean up, and respect blocked audio', async () => {
  const previous = globalThis.AudioContext;
  const previousInterval = globalThis.setInterval;
  const previousClear = globalThis.clearInterval;
  let contexts = 0;
  let instance;
  let tick;
  let cleared = false;
  const nodes = [];
  const gains = [];
  const parameter = () => ({ setValueAtTime(value) { this.value = value; }, exponentialRampToValueAtTime() {}, setTargetAtTime(value) { this.value = value; } });
  const node = () => ({ connect() {}, disconnect() { this.disconnected = true; } });
  globalThis.setInterval = fn => { tick = fn; return 123; };
  globalThis.clearInterval = id => { if (id === 123) cleared = true; };
  globalThis.AudioContext = class {
    constructor() { contexts++; instance = this; this.currentTime = 10; this.state = 'running'; this.sampleRate = 100; }
    createOscillator() { return this.createBufferSource(); }
    createBufferSource() {
      const source = { ...node(), frequency: parameter(), start(time) { this.startTime = time; }, stop(time) { this.stopTime = time; } };
      nodes.push(source); return source;
    }
    createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBiquadFilter() { return { ...node(), frequency: parameter() }; }
    createGain() { const gain = { ...node(), gain: parameter() }; gains.push(gain); return gain; }
  };
  try {
    for (const kind of ['attack', 'heavy', 'hit', 'parry', 'dodge', 'counter', 'heal']) {
      const before = nodes.length;
      assert.equal(await playCue(kind), true);
      assert.ok(nodes.length > before);
    }
    assert.equal(contexts, 1);
    assert.equal(await playCue('unknown'), false);
    for (const source of nodes) {
      assert.ok(source.stopTime > source.startTime);
      source.onended();
      assert.equal(source.disconnected, true);
      if (source.filter) assert.equal(source.filter.disconnected, true);
    }
    instance.state = 'suspended';
    instance.resume = async () => { instance.state = 'running'; };
    assert.equal(await playCue('parry'), true);
    const beforeMusic = nodes.length;
    assert.equal(await setMusic(true), true);
    assert.ok(nodes.length > beforeMusic);
    const bus = gains.find(gain => gain.gain.value === 0.35);
    setMusicVolume(0.7); assert.equal(bus.gain.value, 0.7);
    setMusicVolume(10); assert.equal(bus.gain.value, 1);
    const count = nodes.length;
    await setMusic(true); assert.equal(nodes.length, count, 'enabling twice does not double the soundtrack');
    instance.currentTime += 1;
    tick(); assert.ok(nodes.length > count, 'lookahead keeps music playing');
    await setMusic(false);
    assert.equal(cleared, true);
    for (const source of nodes.slice(beforeMusic)) assert.equal(source.disconnected, true);
    instance.state = 'suspended';
    let resume;
    instance.resume = () => new Promise(resolve => { resume = () => { instance.state = 'running'; resolve(); }; });
    const pending = setMusic(true);
    await setMusic(false);
    const cancelledCount = nodes.length;
    resume(); await pending;
    assert.equal(nodes.length, cancelledCount, 'muting during audio unlock prevents a late start');
    instance.state = 'suspended';
    instance.resume = async () => { throw new Error('Audio blocked'); };
    const blockedCount = nodes.length;
    assert.equal(await playCue('parry'), false);
    assert.equal(await setMusic(true), false);
    assert.equal(nodes.length, blockedCount);
  } finally {
    await setMusic(false);
    globalThis.AudioContext = previous;
    globalThis.setInterval = previousInterval;
    globalThis.clearInterval = previousClear;
  }
});
