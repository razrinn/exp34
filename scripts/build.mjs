import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import assert from 'node:assert/strict';

const output = new URL('../dist/', import.meta.url);
const root = new URL('../', import.meta.url);
await rm(output, { recursive: true, force: true });
const files = [
  'index.html', 'style.css', 'favicon.svg', 'main.js', 'combat.js', 'save.js',
  'sound.js', 'scene.js', 'scene-clock.js', 'animation.js', 'attack-timing.js',
  'CREDITS.md', 'node_modules/three/LICENSE',
  'node_modules/three/build/three.module.js', 'node_modules/three/build/three.core.js',
  'node_modules/three/examples/jsm/loaders/GLTFLoader.js',
  'node_modules/three/examples/jsm/utils/BufferGeometryUtils.js',
  'node_modules/three/examples/jsm/utils/SkeletonUtils.js',
];
for (const file of [...files, 'assets']) {
  const target = new URL(file, output);
  await mkdir(dirname(target.pathname), { recursive: true });
  await cp(new URL(file, root), target, { recursive: true });
}
// Verify copied modules resolve locally before uploading a broken game.
for (const file of files.filter(file => file.endsWith('.js'))) {
  const source = (await readFile(new URL(file, output), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [, dependency] of source.matchAll(/^(?:import|export)\s+[^;]*?\bfrom\s*['"]([^'"]+)['"]/gm)) {
    const target = dependency === 'three'
      ? new URL('node_modules/three/build/three.module.js', output).pathname
      : resolve(dirname(new URL(file, output).pathname), dependency);
    assert.ok((await stat(target)).isFile(), `Missing dependency: ${file} → ${dependency}`);
  }
}
console.log('Static game ready in dist/');
