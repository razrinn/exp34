import * as THREE from 'three';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { actionPose, playerClipProgress, enemyAttackPose, ENEMY_ATTACKS, PLAYER_IMPACT_MS } from './animation.js';

const CLIPS = {
  attack: '1H_Melee_Attack_Slice_Horizontal', heavy: '1H_Melee_Attack_Chop',
  counter: '1H_Melee_Attack_Stab', dodge: 'Dodge_Backward', parry: 'Block',
  hit: 'Hit_A', heal: 'Use_Item',
};

export async function createScene(canvas) {
  const context = canvas.getContext?.('webgl2', { antialias: true });
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#11191f');
  scene.fog = new THREE.Fog('#11191f', 12, 26);
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 40);
  scene.add(new THREE.HemisphereLight('#ddefff', '#343039', 2.2));
  const light = new THREE.DirectionalLight('#ffe1b6', 3);
  light.position.set(-3, 7, 5);
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.normalBias = .04;
  light.shadow.bias = -.0002;
  light.shadow.camera.left = light.shadow.camera.bottom = -6;
  light.shadow.camera.right = light.shadow.camera.top = 6;
  scene.add(light);
  const rim = new THREE.DirectionalLight('#73c6ff', 2);
  rim.position.set(4, 3, -4);
  scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 64), new THREE.MeshStandardMaterial({ color: '#263238', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  for (const x of [-1.5, 1.5]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.85, .88, 48), new THREE.MeshBasicMaterial({ color: x < 0 ? '#588d97' : '#9c7850', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, .01, 0);
    scene.add(ring);
  }
  const loader = new GLTFLoader();
  const files = ['Knight', 'Skeleton_Warrior', 'Skeleton_Rogue', 'Skeleton_Mage'];
  let loaded;
  try {
    loaded = await Promise.all(files.map(name => loader.loadAsync(`assets/characters/${name}.glb`)));
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const models = loaded.map((gltf, index) => {
    const model = gltf.scene;
    // The knight ships with several alternative weapons/shields enabled.
    model.traverse(node => {
      if (['1H_Sword_Offhand', '2H_Sword', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield'].includes(node.name)) node.visible = false;
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        node.material = node.material.clone();
      }
    });
    const bounds = new THREE.Box3().setFromObject(model);
    const scale = (index === 0 ? 2.2 : index === 3 ? 3.6 : 3.0) / bounds.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(scale);
    const group = new THREE.Group();
    group.add(model);
    group.position.x = index === 0 ? -1.5 : 1.5;
    group.rotation.y = index === 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(group);
    group.visible = index < 2;
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    actions.Idle.play();
    return { group, model, mixer, actions, effect: null, attacking: false };
  });
  // Skeleton models use the same hand attachment slots as the knight.
  let weapons;
  try {
    weapons = await Promise.all(['Skeleton_Blade', 'Skeleton_Staff'].map(name => loader.loadAsync(`assets/equipment/${name}.gltf`)));
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  for (let i = 1; i < models.length; i++) {
    const weapon = weapons[i === 3 ? 1 : 0].scene.clone(true);
    weapon.traverse(node => { if (node.isMesh) node.castShadow = true; });
    models[i].model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName('handslot.r')).add(weapon);
  }
  let enemy = models[1];
  let timing = null;
  let recovery = null;
  let counterReaction = null;
  let previous = performance.now();
  const black = new THREE.Color(0);
  function idle(character) {
    character.mixer.stopAllAction();
    character.actions.Idle.reset().play();
    character.attacking = false;
  }
  function play(character, kind, hex) {
    character.attacking = false;
    character.mixer.stopAllAction();
    const action = character.actions[CLIPS[kind]];
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
    action.paused = true;
    character.effect = { kind, started: performance.now(), color: new THREE.Color(hex) };
  }
  function sampleStrike(character, style, progress) {
    const clip = ENEMY_ATTACKS[style].clip;
    const action = character.actions[clip];
    if (character.attacking !== clip) {
      character.mixer.stopAllAction();
      action.reset().play();
      action.paused = true;
      character.attacking = clip;
    }
    action.time = action.getClip().duration * progress;
    character.mixer.update(0);
  }
  function draw(now) {
    if (counterReaction && now >= counterReaction.at) {
      play(enemy, 'hit', counterReaction.hex);
      counterReaction = null;
    }
    const delta = Math.min(.1, Math.max(0, (now - previous) / 1000));
    previous = now;
    for (const character of [models[0], enemy]) {
      const effect = character.effect;
      const elapsed = now - (effect?.started || 0);
      const motion = actionPose(effect?.kind, elapsed);
      if (effect && !motion.active) {
        character.effect = null;
        idle(character);
      }
      const direction = character === models[0] ? 1 : -1;
      let approach = 0;
      if (character === enemy && recovery && now < recovery.at + recovery.duration) {
        const t = Math.max(0, Math.min(1, (now - recovery.at) / recovery.duration));
        const contact = ENEMY_ATTACKS[recovery.style].contact;
        sampleStrike(character, recovery.style, contact + (1 - contact) * t);
        approach = recovery.finished ? 1.4 * (1 - t * t * (3 - 2 * t)) : 1.4;
      } else if (character === enemy && timing && !character.effect) {
        const strike = enemyAttackPose(timing.impactAt - now, timing.duration, timing.hitIndex, timing.style);
        sampleStrike(character, timing.style, strike.clip);
        approach = strike.x;
      } else if (character.effect) {
        const action = character.actions[CLIPS[character.effect.kind]];
        action.time = action.getClip().duration * playerClipProgress(character.effect.kind, now - character.effect.started);
        character.mixer.update(0);
      } else {
        if (character.attacking) idle(character);
        character.mixer.update(delta);
      }
      character.group.position.x = direction * (-1.5 + motion.x + approach);
      character.group.position.y = motion.lift;
      character.group.rotation.z = motion.lean * direction;
      character.model.traverse(node => {
        if (node.isMesh && node.material.emissive) {
          node.material.emissive.copy(character.effect ? character.effect.color : black);
          node.material.emissiveIntensity = character.effect ? .3 : 0;
        }
      });
    }
    renderer.render(scene, camera);
    requestAnimationFrame(draw);
  }
  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const distance = Math.max(8.2, 8.8 / camera.aspect);
    camera.position.set(-distance * .72, 1.4 + distance * .18, distance * .7);
    camera.lookAt(.4, 1.4, 0);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  requestAnimationFrame(draw);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    canvas.closest('.arena').classList.remove('has-webgl');
  });
  canvas.addEventListener('webglcontextrestored', () => location.reload());
  return {
    render(name, nextTiming = null) {
      const nextEnemy = models[{ Sentinel: 1, Duelist: 2, Warden: 3 }[name]];
      if (enemy !== nextEnemy) {
        enemy.group.visible = false;
        enemy = nextEnemy;
        enemy.group.visible = true;
      }
      timing = nextTiming;
    },
    feedback(kind, target, hex) {
      if (kind === 'counter') {
        play(models[0], kind, '#91c4ce');
        counterReaction = { at: performance.now() + PLAYER_IMPACT_MS, hex };
      } else play(target === 'player' ? models[0] : enemy, target === 'enemy' ? 'hit' : kind, hex);
    },
    startAction(kind) { play(models[0], kind, '#91c4ce'); },
    enemyImpact(at, finished, style) { recovery = { at, finished, style, duration: finished ? 300 : 160 }; },
    reset() {
      timing = null;
      recovery = null;
      counterReaction = null;
      for (const character of models) { character.effect = null; idle(character); }
    },
  };
}
