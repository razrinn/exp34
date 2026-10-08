import test from 'node:test';
import assert from 'node:assert/strict';
import { createScene } from './scene.js';

test('scene falls back without WebGL and draws the shared mesh for both fighters', () => {
  assert.equal(createScene({ getContext: () => null }), null);
  const previous = globalThis.ResizeObserver;
  const calls = [];
  const gl = new Proxy({
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformLocation: (_, name) => name,
    getAttribLocation: () => 0,
  }, { get(target, key) { return target[key] || ((...args) => calls.push([key, ...args])); } });
  globalThis.ResizeObserver = class { observe() {} };
  try {
    const scene = createScene({ getContext: () => gl, clientWidth: 800, clientHeight: 400, addEventListener() {} });
    scene.render('Sentinel');
    assert.equal(calls.find(([name]) => name === 'bufferData')[2].length, 36 * 6);
    assert.equal(calls.filter(([name]) => name === 'drawArrays').length, 17);
    const initial = calls.filter(([name, uniform]) => name === 'uniform3fv' && uniform === 'size').at(-1)[2][1];
    scene.render('Warden', { x: -50, y: 0, rotation: -45 });
    const boss = calls.filter(([name, uniform]) => name === 'uniform3fv' && uniform === 'size').at(-1)[2][1];
    assert.equal(boss, initial * 1.15);
    assert.ok(calls.some(([name, uniform, value]) => name === 'uniform1f' && uniform === 'tilt' && Math.abs(value) > .5));
  } finally {
    globalThis.ResizeObserver = previous;
  }
});
