import * as THREE from 'three';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { actionPose, playerClipProgress, enemyAttackPose, ENEMY_ATTACKS, PLAYER_IMPACT_MS, HOME_X, ENEMY_STEP_BACK_MS, retreatDistance } from './animation.js';

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
  const sky = document.createElement('canvas');
  sky.width = 1024; sky.height = 512;
  const skyPaint = sky.getContext('2d');
  const gradient = skyPaint.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#080e23');
  gradient.addColorStop(.6, '#30314a');
  gradient.addColorStop(1, '#a9684d');
  skyPaint.fillStyle = gradient;
  skyPaint.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 110; i++) {
    skyPaint.fillStyle = `rgba(210,225,255,${.2 + (i % 4) * .15})`;
    skyPaint.fillRect((i * 173) % 1024, (i * 97) % 300, 1.5, 1.5);
  }
  const halo = skyPaint.createRadialGradient(740, 140, 32, 740, 140, 100);
  halo.addColorStop(0, '#ffe2a2'); halo.addColorStop(.12, '#ffb272'); halo.addColorStop(1, '#ff805000');
  skyPaint.fillStyle = halo; skyPaint.fillRect(640, 40, 200, 200);
  skyPaint.fillStyle = '#0b1020'; skyPaint.beginPath(); skyPaint.arc(740, 140, 32, 0, Math.PI * 2); skyPaint.fill();
  scene.background = new THREE.CanvasTexture(sky);
  scene.fog = new THREE.Fog('#11191f', 12, 26);
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 120);
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
  const floor = new THREE.Mesh(new THREE.CircleGeometry(22, 64), new THREE.MeshStandardMaterial({ color: '#263238', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  for (const x of [-HOME_X, HOME_X]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(.85, .88, 48), new THREE.MeshBasicMaterial({ color: x < 0 ? '#588d97' : '#9c7850', side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, .01, 0);
    scene.add(ring);
  }
  const stone = new THREE.MeshStandardMaterial({ color: '#353a48', roughness: 1 });
  for (let i = 0; i < 13; i++) {
    const height = 5 + (i * 7 % 6);
    const mountain = new THREE.Mesh(new THREE.ConeGeometry(4 + i % 3, height, 5), stone);
    mountain.position.set(-24 + i * 4, height / 2 - 1, -19 - i % 3 * 3);
    mountain.rotation.y = i * .7;
    scene.add(mountain);
  }
  for (const [x, z, height] of [[-8, -6, 6], [8, -7, 7], [-4, -11, 5], [4, -11, 5]]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(.5, .7, height, 8), stone);
    pillar.position.set(x, height / 2, z); pillar.castShadow = true; scene.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, .35, 1.6), stone);
    cap.position.set(x, height, z); cap.rotation.y = .2 * x; scene.add(cap);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(9, .6, 1.4), stone);
  lintel.position.set(0, 5.2, -11); lintel.rotation.z = -.04; scene.add(lintel);
  const motes = new THREE.BufferGeometry();
  const motePositions = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) {
    motePositions[i * 3] = (i * 13 % 31) - 15;
    motePositions[i * 3 + 1] = (i * 7 % 23) / 4;
    motePositions[i * 3 + 2] = (i * 17 % 29) - 14;
  }
  motes.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const embers = new THREE.Points(motes, new THREE.PointsMaterial({ color: '#ffc08a', size: .035, transparent: true, opacity: .65, depthWrite: false }));
  scene.add(embers);
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
    const scale = (index === 0 ? 2.6 : index === 3 ? 4.2 : 3.5) / bounds.getSize(new THREE.Vector3()).y;
    model.scale.setScalar(scale);
    const group = new THREE.Group();
    group.add(model);
    group.position.x = index === 0 ? -HOME_X : HOME_X;
    group.rotation.y = index === 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(group);
    group.visible = index < 2;
    const mixer = new THREE.AnimationMixer(model);
    const actions = Object.fromEntries(gltf.animations.map(clip => [clip.name, mixer.clipAction(clip)]));
    actions.Idle.play();
    const vfx = new THREE.Group();
    const wind = new THREE.Mesh(new THREE.RingGeometry(.75, 1.05, 40, 1, 0, Math.PI * 1.35), new THREE.MeshBasicMaterial({ color: '#a9edff', side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const fire = new THREE.Mesh(new THREE.RingGeometry(.65, 1.12, 40, 1, 0, Math.PI * 1.6), wind.material.clone());
    fire.material.color.set('#ff8e42'); fire.rotation.y = Math.PI / 2;
    wind.rotation.x = Math.PI / 2;
    const boltPoints = [];
    for (let j = 0; j < 15; j++) boltPoints.push(new THREE.Vector3(-1 + j / 7, j === 0 || j === 14 ? 0 : (j % 2 ? .14 : -.14), (j % 3 - 1) * .08));
    const bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(boltPoints), new THREE.LineBasicMaterial({ color: '#b7a1ff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const flash = new THREE.PointLight('#a9edff', 0, 5);
    vfx.add(wind, fire, bolt, flash); vfx.visible = index < 2;
    wind.visible = fire.visible = bolt.visible = false; scene.add(vfx);
    return { group, model, mixer, actions, effect: null, attacking: false, vfx, wind, fire, bolt, flash, burst: null };
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
    now = performance.now();
    embers.position.y = Math.sin(now / 5000) * .25;
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
        approach = retreatDistance(now - recovery.at, recovery.duration);
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
      character.group.position.x = direction * (-HOME_X + motion.x + approach);
      character.group.position.y = motion.lift;
      character.group.rotation.z = motion.lean * direction;
      let style = { attack: 'slash', heavy: 'chop', counter: 'thrust' }[character.effect?.kind];
      let strength = style ? Math.max(0, 1 - Math.abs(elapsed - PLAYER_IMPACT_MS) / 220) : 0;
      if (character === enemy && timing && !character.effect) {
        style = timing.style;
        const remaining = timing.impactAt - now;
        strength = Math.max(0, 1 - Math.abs(remaining) / ENEMY_ATTACKS[style].swingMs);
      }
      if (character.burst && now - character.burst.at < 220) {
        style = character.burst.style;
        strength = Math.max(strength, 1 - Math.max(0, now - character.burst.at) / 220);
      }
      const color = style === 'chop' ? '#ff8e42' : style === 'thrust' ? '#b7a1ff' : '#a9edff';
      character.vfx.position.set(character.group.position.x + direction * .9, 1.7, 0);
      character.vfx.scale.setScalar(.75 + strength * .6);
      character.wind.visible = style === 'slash' && strength > 0;
      character.fire.visible = style === 'chop' && strength > 0;
      character.bolt.visible = style === 'thrust' && strength > 0;
      for (const mesh of [character.wind, character.fire, character.bolt]) mesh.material.opacity = strength * .75;
      character.wind.rotation.z = now / 140;
      character.fire.rotation.x = now / 190;
      character.flash.color.set(color); character.flash.intensity = strength * 3;
      character.model.traverse(node => {
        if (node.isMesh && node.material.emissive) {
          const weapon = /Sword|Blade|Staff/i.test(node.name) || /Skeleton_(Blade|Staff)/i.test(node.parent?.name || '');
          node.material.emissive.copy(weapon && strength > 0 ? character.flash.color : character.effect ? character.effect.color : black);
          node.material.emissiveIntensity = weapon ? strength * 1.5 : character.effect ? .3 : 0;
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
    scene.background.repeat.set(Math.min(1, camera.aspect / 2), Math.min(1, 2 / camera.aspect));
    scene.background.offset.set(.72 * (1 - scene.background.repeat.x), .28 * (1 - scene.background.repeat.y));
    const distance = Math.max(11, 9 / camera.aspect);
    const portrait = camera.aspect < 1;
    camera.position.set(-distance * (portrait ? .85 : .72), 1.6 + distance * .16, distance * (portrait ? .53 : .7));
    scene.fog.near = distance + 6;
    scene.fog.far = distance + 20;
    camera.lookAt(0, 1.6, 0);
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
        enemy.vfx.visible = false;
        enemy = nextEnemy;
        enemy.group.visible = true;
        enemy.vfx.visible = true;
      }
      timing = nextTiming;
    },
    feedback(kind, target, hex) {
      if (kind === 'counter') {
        play(models[0], kind, '#91c4ce');
        counterReaction = { at: performance.now() + PLAYER_IMPACT_MS, hex };
      } else {
        if (kind === 'attack' || kind === 'heavy') models[0].burst = { at: performance.now(), style: kind === 'heavy' ? 'chop' : 'slash' };
        play(target === 'player' ? models[0] : enemy, target === 'enemy' ? 'hit' : kind, hex);
      }
    },
    startAction(kind) { play(models[0], kind, '#91c4ce'); },
    enemyImpact(at, finished, style) { enemy.burst = { at, style }; recovery = { at, finished, style, duration: finished ? 300 : ENEMY_STEP_BACK_MS }; },
    reset() {
      timing = null;
      recovery = null;
      counterReaction = null;
      for (const character of models) { character.effect = null; character.burst = null; idle(character); }
    },
  };
}
