import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createScene } from './scene.js';

test('unsupported WebGL returns the playable symbol fallback', async () => {
  assert.equal(await createScene({ getContext: () => null }), null);
});

test('shipped characters contain combat clips, skinning, textures, and weapon slots', () => {
  const required = ['Idle', '1H_Melee_Attack_Chop', '1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Stab', 'Dodge_Backward', 'Block', 'Hit_A', 'Use_Item', 'Death_B'];
  for (const name of ['Knight', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage']) {
    const data = readFileSync(new URL(`./assets/characters/${name}.glb`, import.meta.url));
    assert.equal(data.toString('ascii', 0, 4), 'glTF');
    assert.equal(data.readUInt32LE(8), data.length);
    const model = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
    for (const clip of required) assert.ok(model.animations.some(a => a.name === clip), `${name}: missing ${clip}`);
    if (name === 'Knight') for (const clip of ['Jump_Start', 'Jump_Full_Short']) assert.ok(model.animations.some(a => a.name === clip));
    assert.ok(model.skins.length > 0);
    assert.ok(model.images.length > 0);
    assert.ok(model.nodes.some(n => n.name === 'handslot.r'));
  }
  for (const name of ['Skeleton_Blade', 'Skeleton_Staff']) {
    const url = new URL(`./assets/equipment/${name}.gltf`, import.meta.url);
    const model = JSON.parse(readFileSync(url));
    for (const resource of [...model.buffers, ...model.images]) assert.ok(existsSync(new URL(resource.uri, url)));
  }
});
