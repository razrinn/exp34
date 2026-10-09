import * as THREE from 'three';
import { GLTFLoader } from './node_modules/three/examples/jsm/loaders/GLTFLoader.js';
import { actionPose, deathPose, attackEffects, playerClipProgress, enemyAttackPose, enemyWindupPose, ENEMY_ATTACKS, PLAYER_IMPACT_MS, HOME_X, STRIKE_REACH, ENEMY_STEP_BACK_MS, retreatDistance } from './animation.js';

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
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const glowPaint = glowCanvas.getContext('2d');
  const glow = glowPaint.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, '#fff'); glow.addColorStop(.2, '#ffffffcc'); glow.addColorStop(1, '#ffffff00');
  glowPaint.fillStyle = glow; glowPaint.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const cueTextures = ['◇', '✕'].map(symbol => {
    const image = document.createElement('canvas'); image.width = image.height = 128;
    const paint = image.getContext('2d'); paint.textAlign = 'center'; paint.textBaseline = 'middle';
    paint.font = 'bold 90px sans-serif'; paint.strokeStyle = '#111'; paint.lineWidth = 8;
    paint.strokeText(symbol, 64, 64);
    paint.fillStyle = '#fff'; paint.shadowColor = '#fff'; paint.shadowBlur = 10; paint.fillText(symbol, 64, 64);
    return new THREE.CanvasTexture(image);
  });
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
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(48), 3));
    trailGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(48), 3));
    const indices = [];
    for (let i = 0; i < 7; i++) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    trailGeometry.setIndex(indices); trailGeometry.setDrawRange(0, 0);
    const trail = new THREE.Mesh(trailGeometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
    trail.frustumCulled = false;
    const sparks = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(144), 3)), new THREE.LineBasicMaterial({ color: '#ffdf9c', transparent: true, opacity: 0, depthWrite: false }));
    sparks.frustumCulled = false;
    const chargeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: '#a9dfff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    const chargeParticles = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(108), 3)), new THREE.PointsMaterial({ map: glowTexture, color: '#a9dfff', size: .12, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    chargeParticles.frustumCulled = false;
    const cue = new THREE.Sprite(new THREE.SpriteMaterial({ map: cueTextures[0], color: '#ffd469', transparent: true, depthTest: false, depthWrite: false }));
    cue.position.set(0, index === 3 ? 1.8 : 1.25, .5); cue.scale.setScalar(.9); cue.visible = false; cue.renderOrder = 10; group.add(cue);
    const shockwave = new THREE.Mesh(new THREE.RingGeometry(.85, 1, 48), new THREE.MeshBasicMaterial({ color: '#ffbf78', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    shockwave.rotation.x = -Math.PI / 2;
    const vfx = new THREE.Group(); vfx.add(trail, sparks, chargeGlow, chargeParticles, shockwave); vfx.visible = index < 2; scene.add(vfx);
    return { group, model, mixer, actions, effect: null, death: null, attacking: false, vfx, trail, sparks, chargeGlow, chargeParticles, shockwave, cue, history: [], burst: null };

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
  for (const [index, character] of models.entries()) {
    character.weapon = character.model.getObjectByName(index === 0 ? '1H_Sword' : index === 3 ? 'Skeleton_Staff' : 'Skeleton_Blade');
    character.weapon.geometry.computeBoundingBox();
    const length = character.weapon.geometry.boundingBox.max.y;
    character.tip = new THREE.Vector3(0, length, 0);
    character.base = new THREE.Vector3(0, length * .45, 0);
  }
  let enemy = models[1];
  let timing = null;
  let recovery = null;
  let counterReaction = null;
  let previous = performance.now();
  const black = new THREE.Color(0);
  const damageNumbers = [];
  const numberPosition = new THREE.Vector3();
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
      const dying = character.death && now >= character.death.at;
      if (dying && !character.death.origin) {
        character.death.origin = character.group.position.clone();
        character.death.yaw = character.group.rotation.y;
        play(character, 'hit', '#ef6868');
      }
      const effect = character.effect;
      const elapsed = now - (effect?.started || 0);
      const motion = actionPose(effect?.kind, elapsed);
      if (effect && !motion.active && !dying) {
        character.effect = null;
        idle(character);
      }
      const direction = character === models[0] ? 1 : -1;
      character.group.rotation.order = dying ? 'ZYX' : 'XYZ';
      let approach = 0;
      let windup = { lean: 0, twist: 0, lift: 0 };
      if (dying) {
        const action = character.actions.Hit_A;
        action.time = action.getClip().duration * Math.min(1, (now - character.death.at) / 300);
        character.mixer.update(0);
      } else if (character === enemy && recovery && now < recovery.at + recovery.duration) {
        const t = Math.max(0, Math.min(1, (now - recovery.at) / recovery.duration));
        const contact = ENEMY_ATTACKS[recovery.style].contact;
        sampleStrike(character, recovery.style, contact + (1 - contact) * t);
        approach = retreatDistance(now - recovery.at, recovery.duration, recovery.hold);
      } else if (character === enemy && timing && !character.effect && !dying) {
        const strike = enemyAttackPose(timing.impactAt - now, timing.duration, timing.hitIndex, timing.style);
        sampleStrike(character, timing.style, strike.clip);
        approach = strike.x;
        windup = enemyWindupPose(timing.impactAt - now, timing.duration, timing.style);
      } else if (character.effect) {
        const action = character.actions[CLIPS[character.effect.kind]];
        action.time = action.getClip().duration * playerClipProgress(character.effect.kind, now - character.effect.started);
        character.mixer.update(0);
      } else {
        if (character.attacking) idle(character);
        character.mixer.update(delta);
      }
      character.group.position.x = direction * (-HOME_X + motion.x + approach);
      character.group.position.y = motion.lift + windup.lift;
      character.group.rotation.y = (character === models[0] ? Math.PI / 2 : -Math.PI / 2) + windup.twist;
      character.group.rotation.z = (motion.lean + windup.lean) * direction;
      if (dying) {
        const fallen = deathPose(now - character.death.at);
        character.group.position.copy(character.death.origin);
        character.group.position.y += fallen.lift * (character === models[0] ? 1 : character === models[3] ? 1.6 : 1.3);
        character.group.rotation.y = character.death.yaw;
        character.group.rotation.z = fallen.lean * direction;
      }
      let style = { attack: 'slash', heavy: 'chop', counter: 'thrust' }[character.effect?.kind];
      let charge = style ? attackEffects(PLAYER_IMPACT_MS - elapsed, PLAYER_IMPACT_MS, style).charge : 0;
      character.cue.visible = false;
      let strength = style ? Math.max(0, 1 - Math.abs(elapsed - PLAYER_IMPACT_MS) / 220) : 0;
      if (character === enemy && timing && !character.effect && !dying) {
        style = timing.style;
        const remaining = timing.impactAt - now;
        const effects = attackEffects(remaining, timing.duration, style);
        charge = effects.charge;
        character.cue.visible = effects.cue;
        character.cue.material.color.set(timing.parryable === false ? '#ff4141' : '#ffe16b');
        character.cue.material.map = cueTextures[timing.parryable === false ? 1 : 0];
        strength = Math.max(0, 1 - Math.abs(remaining) / ENEMY_ATTACKS[style].swingMs);
      }
      if (character.burst && now - character.burst.at < 220) {
        style = character.burst.style;
        strength = Math.max(strength, 1 - Math.max(0, now - character.burst.at) / 220);
      }
      const color = new THREE.Color(style === 'chop' ? '#ffc078' : style === 'thrust' ? '#c8ddff' : '#d8f2ff');
      character.group.updateMatrixWorld(true);
      const tip = character.weapon.localToWorld(character.tip.clone());
      const base = character.weapon.localToWorld(character.base.clone());
      character.chargeGlow.position.copy(tip);
      character.chargeGlow.scale.setScalar(.2 + charge * .6);
      character.chargeGlow.material.color.copy(color);
      character.chargeGlow.material.opacity = charge * .85;
      character.chargeParticles.material.color.copy(color);
      character.chargeParticles.material.opacity = charge * .85;
      const gathering = character.chargeParticles.geometry.attributes.position;
      for (let i = 0; i < 36; i++) {
        const t = (now / (style === 'chop' ? 850 : 600) + i / 36) % 1;
        const radius = (1 - t) * (.4 + charge * .6);
        const angle = i * 2.4 + now / 350;
        gathering.setXYZ(i, tip.x + Math.cos(angle) * radius, tip.y + Math.sin(angle) * radius, tip.z + (i % 3 - 1) * radius * .6);
      }
      gathering.needsUpdate = true;
      const stroke = character === enemy ? timing?.impactAt : character.effect?.started;
      if (character.stroke !== stroke || strength <= 0 || now - (character.history.at(-1)?.at || 0) > 100) character.history = [];
      character.stroke = stroke;
      if (strength > 0) character.history.push({ tip, base, at: now });
      character.history = character.history.filter(point => now - point.at < 100).slice(-8);
      const positions = character.trail.geometry.attributes.position;
      const colors = character.trail.geometry.attributes.color;
      character.history.forEach((point, i) => {
        positions.setXYZ(i * 2, point.base.x, point.base.y, point.base.z);
        positions.setXYZ(i * 2 + 1, point.tip.x, point.tip.y, point.tip.z);
        const fade = Math.max(0, 1 - (now - point.at) / 100);
        for (const vertex of [i * 2, i * 2 + 1]) colors.setXYZ(vertex, color.r * fade, color.g * fade, color.b * fade);
      });
      positions.needsUpdate = colors.needsUpdate = true;
      character.trail.geometry.setDrawRange(0, Math.max(0, character.history.length - 1) * 6);
      const burst = character.burst;
      const age = burst ? Math.max(0, now - burst.at) : 160;
      character.sparks.material.opacity = age < 160 ? .8 * (1 - age / 160) : 0;
      if (burst && age < 160) {
        burst.point ||= tip.clone();
        character.sparks.material.color.copy(color);
        const particles = character.sparks.geometry.attributes.position;
        for (let i = 0; i < 24; i++) {
          const angle = i * Math.PI * 2 / 24;
          const radius = .04 + age / (burst.style === 'chop' ? 220 : 320);
          const dx = Math.cos(angle), dy = Math.sin(angle), dz = (i % 3 - 1) * .45;
          for (let end = 0; end < 2; end++) {
            const r = radius + end * .12;
            particles.setXYZ(i * 2 + end, burst.point.x + dx * r, burst.point.y + dy * r - age * age / 120000, burst.point.z + dz * r);
          }
        }
        particles.needsUpdate = true;
      }

      character.shockwave.material.opacity = burst?.style === 'chop' && age < 160 ? .45 * (1 - age / 160) : 0;
      if (burst?.point) {
        character.shockwave.position.set(burst.point.x, .025, burst.point.z);
        character.shockwave.scale.setScalar(.25 + age / 100);
      }
      character.model.traverse(node => {
        if (node.isMesh && node.material.emissive) {
          const weapon = /Sword|Blade|Staff/i.test(node.name) || /Skeleton_(Blade|Staff)/i.test(node.parent?.name || '');
          node.material.emissive.copy(character.cue.visible ? character.cue.material.color : weapon && (strength > 0 || charge > 0) ? color : character.effect ? character.effect.color : black);
          node.material.emissiveIntensity = dying ? Math.max(0, 1 - (now - character.death.at) / 180) * .12 : character.cue.visible ? .25 : weapon ? strength * .7 + charge * .9 : character.effect ? .12 : 0;
        }
      });
    }
    for (let i = damageNumbers.length - 1; i >= 0; i--) {
      const number = damageNumbers[i];
      const age = now - number.at;
      if (age >= 700) { number.node.remove(); damageNumbers.splice(i, 1); continue; }
      number.node.hidden = age < 0;
      if (age < 0) continue;
      const character = number.character;
      numberPosition.copy(character.group.position);
      numberPosition.y += character === models[3] ? 1.8 : 1.3;
      numberPosition.project(camera);
      const x = (numberPosition.x + 1) * canvas.clientWidth / 2 + 90;
      const y = (1 - numberPosition.y) * canvas.clientHeight / 2 - age / 14;
      number.node.style.left = `${Math.min(canvas.clientWidth - 24, Math.max(24, x))}px`;
      number.node.style.top = `${y}px`;
      number.node.style.opacity = Math.min(1, (700 - age) / 180);
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
        if (kind === 'parry') models[0].burst = { at: performance.now(), style: 'thrust' };
        if (kind === 'attack' || kind === 'heavy') models[0].burst = { at: performance.now(), style: kind === 'heavy' ? 'chop' : 'slash' };
        play(target === 'player' ? models[0] : enemy, target === 'enemy' ? 'hit' : kind, hex);
      }
    },
    die(target, delay = 0) {
      const character = target === 'player' ? models[0] : enemy;
      character.death = { at: performance.now() + delay, origin: null };
    },
    damage(amount, target, delay = 0) {
      const node = document.createElement('span');
      node.className = `damage-number ${target}`;
      node.textContent = String(amount); node.setAttribute('role', 'status');
      node.ariaLabel = `${amount} damage to ${target === 'player' ? 'you' : 'the enemy'}`; node.hidden = true;
      canvas.parentElement.append(node);
      damageNumbers.push({ node, character: target === 'player' ? models[0] : enemy, at: performance.now() + delay });
    },
    startAction(kind) { play(models[0], kind, '#91c4ce'); },
    enemyImpact(at, finished, style, nextDelay) {
      enemy.burst = { at, style };
      recovery = { at, style, hold: !finished && nextDelay <= 500 ? STRIKE_REACH - 1 : 0, duration: finished ? 300 : ENEMY_STEP_BACK_MS };
    },
    reset() {
      for (const number of damageNumbers) number.node.remove();
      damageNumbers.length = 0;
      timing = null;
      recovery = null;
      counterReaction = null;
      for (const character of models) { character.effect = null; character.death = null; character.burst = null; character.history = []; character.stroke = null; character.cue.visible = false; idle(character); }
    },
  };
}
