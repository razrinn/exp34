import * as THREE from 'three';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { actionPose } from './animation.js';

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
    const scale = (index === 3 ? 2.65 : 2.2) / bounds.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(scale);
    const group = new THREE.Group();
    group.add(model);
    group.position.x = index === 0 ? -1.5 : 1.5;
    group.rotation.y = index === 0 ? 1.15 : -1.15;
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
  let pose = { x: 0, y: 0, rotation: 0 };
  let previous = performance.now();
  const black = new THREE.Color(0);
  function idle(character) {
    character.mixer.stopAllAction();
    character.actions.Idle.reset().play();
    character.attacking = false;
  }
  function play(character, kind, hex) {
    character.mixer.stopAllAction();
    const action = character.actions[CLIPS[kind]];
    action.reset().setLoop(THREE.LoopOnce, 1).play();
    action.clampWhenFinished = true;
    const duration = ['attack', 'heavy', 'counter'].includes(kind) ? 500 : 300;
    action.setEffectiveTimeScale(action.getClip().duration / (duration / 1000));
    character.effect = { kind, started: performance.now(), color: new THREE.Color(hex) };
  }
  function draw(now) {
    const delta = Math.min(.1, Math.max(0, (now - previous) / 1000));
    previous = now;
    for (const character of [models[0], enemy]) {
      const effect = character.effect;
      const motion = actionPose(effect?.kind, now - (effect?.started || 0));
      if (effect && !motion.active) {
        character.effect = null;
        idle(character);
      }
      if (character === enemy && timing && !character.effect) {
        const action = character.actions['1H_Melee_Attack_Chop'];
        if (!character.attacking) {
          character.mixer.stopAllAction();
          action.reset().play();
          action.paused = true;
          character.attacking = true;
        }
        // Stretch the wind-up; the final swing always occupies the last 240 ms.
        const windup = Math.max(1, timing.duration - Math.min(240, timing.duration));
        const swing = Math.min(240, timing.duration);
        const progress = timing.remaining > swing
          ? .35 * Math.max(0, (timing.duration - timing.remaining) / windup)
          : .35 + .4 * Math.max(0, 1 - timing.remaining / swing);
        action.time = action.getClip().duration * Math.min(.75, progress);
        character.mixer.update(0);
      } else {
        if (character.attacking) idle(character);
        character.mixer.update(delta);
      }
      const direction = character === models[0] ? 1 : -1;
      character.group.position.x = direction * (-1.5 + motion.x);
      character.group.position.y = motion.lift;
      character.group.rotation.z = motion.lean * direction;
      if (character === enemy && timing) character.group.position.x += pose.x / 100;
      character.model.traverse(node => {
        if (node.isMesh && node.material.emissive) {
          node.material.emissive.copy(character.effect?.color || black);
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
    const distance = Math.max(7.5, 8.8 / camera.aspect);
    camera.position.set(0, 1.1 + distance * .24, distance);
    camera.lookAt(0, 1.1, 0);
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
    render(name, nextPose = { x: 0, y: 0, rotation: 0 }, nextTiming = null) {
      const nextEnemy = models[{ Sentinel: 1, Duelist: 2, Warden: 3 }[name]];
      if (enemy !== nextEnemy) {
        enemy.group.visible = false;
        enemy = nextEnemy;
        enemy.group.visible = true;
      }
      timing = nextTiming;
      pose = nextPose;
    },
    feedback(kind, target, hex) {
      play(target === 'player' ? models[0] : enemy, target === 'enemy' ? 'hit' : kind, hex);
      if (['attack', 'heavy', 'counter'].includes(kind)) play(models[0], kind, '#91c4ce');
    },
    reset() {
      timing = null;
      for (const character of models) { character.effect = null; idle(character); }
    },
  };
}
