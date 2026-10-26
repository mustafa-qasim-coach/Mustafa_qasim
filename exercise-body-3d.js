import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('body-model-canvas');
  const stage = canvas?.closest('.body-model-stage');
  if (!canvas || !stage) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    console.info('3D muscle model unavailable; the accessible two-view drawing remains active.', error);
    return;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0.12, 1.68, 6.15);
  camera.lookAt(0, 1.65, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;

  scene.add(new THREE.HemisphereLight(0xf6f4e8, 0x30291f, 2.1));
  const keyLight = new THREE.DirectionalLight(0xffe6cd, 3.0);
  keyLight.position.set(-3, 5, 4);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xbde775, 2.1);
  rimLight.position.set(3.2, 2.6, -3.5);
  scene.add(rimLight);
  const fillLight = new THREE.PointLight(0xf6f4ec, 1.0, 8);
  fillLight.position.set(0, 2, 4);
  scene.add(fillLight);

  const model = new THREE.Group();
  scene.add(model);
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);
  const skin = new THREE.MeshPhysicalMaterial({ color: '#bd9474', roughness: 0.43, clearcoat: 0.18, clearcoatRoughness: 0.5 });
  const skinLight = new THREE.MeshPhysicalMaterial({ color: '#d0a17e', roughness: 0.39, clearcoat: 0.24, clearcoatRoughness: 0.42 });
  const skinShadow = new THREE.MeshPhysicalMaterial({ color: '#a77b5e', roughness: 0.48, clearcoat: 0.12 });
  const trunks = new THREE.MeshStandardMaterial({ color: '#26301f', roughness: 0.8 });
  const groove = new THREE.MeshStandardMaterial({ color: '#72533e', roughness: 0.8 });
  const zoneMeshes = new Map();

  function register(mesh, zone, baseColor) {
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    if (zone) {
      mesh.userData.zone = zone;
      mesh.userData.baseColor = baseColor || mesh.material.color.getStyle();
      if (!zoneMeshes.has(zone)) zoneMeshes.set(zone, []);
      zoneMeshes.get(zone).push(mesh);
    }
    model.add(mesh);
    return mesh;
  }
  function oval(name, pos, size, mat = skin, zone = null, color = null) {
    const mesh = new THREE.Mesh(sphereGeometry, mat.clone());
    mesh.name = name;
    mesh.position.set(...pos);
    mesh.scale.set(...size);
    if (color) mesh.material.color.set(color);
    return register(mesh, zone, mesh.material.color.getStyle());
  }
  function segment(name, a, b, radiusA, radiusB, mat = skin) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusB, radiusA, direction.length(), 24, 1), mat.clone());
    mesh.name = name;
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return register(mesh, null, null);
  }
  function joint(name, pos, radius, mat = skin) { return oval(name, pos, [radius, radius, radius], mat); }
  function line(points, radius = 0.006, mat = groove) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat);
    return register(mesh, null, null);
  }
  function muscle(name, zone, pos, size, color = '#c99674', rotation = 0) {
    const mesh = oval(name, pos, size, skinLight, zone, color);
    mesh.rotation.z = rotation;
    mesh.material.emissive = new THREE.Color('#000000');
    mesh.material.emissiveIntensity = 0;
    return mesh;
  }

  // Sculpted torso, neck and head.
  const torsoProfile = [
    [0, 0], [0.20, 0.03], [0.28, 0.13], [0.29, 0.32], [0.31, 0.52],
    [0.36, 0.73], [0.42, 0.92], [0.43, 1.08], [0.37, 1.25], [0.27, 1.41], [0.17, 1.48], [0, 1.49],
  ].map(([radius, y]) => new THREE.Vector2(radius, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoProfile, 64), skin.clone());
  torso.name = 'torso'; torso.position.y = 1.34; torso.scale.z = 0.67; register(torso, null, null);
  oval('pelvis', [0, 1.39, 0], [0.31, 0.22, 0.22], skin);
  oval('training-shorts', [0, 1.34, 0.025], [0.31, 0.16, 0.225], trunks);
  oval('neck', [0, 2.82, 0], [0.13, 0.19, 0.13], skin);
  oval('head', [0, 3.06, 0.005], [0.19, 0.25, 0.175], skinLight);
  oval('ear-left', [-0.185, 3.06, 0], [0.035, 0.06, 0.035], skin);
  oval('ear-right', [0.185, 3.06, 0], [0.035, 0.06, 0.035], skin);
  oval('nose', [0, 3.025, 0.17], [0.035, 0.052, 0.038], skinShadow);
  oval('eye-left', [-0.066, 3.09, 0.161], [0.018, 0.012, 0.009], groove);
  oval('eye-right', [0.066, 3.09, 0.161], [0.018, 0.012, 0.009], groove);
  line([[-0.038, 2.98, 0.169], [0, 2.972, 0.178], [0.038, 2.98, 0.169]], 0.004, groove);

  // Chest, shoulders and visible abdominal regions.
  muscle('left pectoral', 'chest', [-0.205, 2.48, 0.252], [0.22, 0.16, 0.075], '#d2a17d', -0.05);
  muscle('right pectoral', 'chest', [0.205, 2.48, 0.252], [0.22, 0.16, 0.075], '#d2a17d', 0.05);
  muscle('front deltoid left', 'frontDelts', [-0.46, 2.48, 0.115], [0.145, 0.18, 0.15], '#c59170', -0.28);
  muscle('front deltoid right', 'frontDelts', [0.46, 2.48, 0.115], [0.145, 0.18, 0.15], '#c59170', 0.28);
  muscle('side deltoid left', 'sideDelts', [-0.555, 2.43, 0.005], [0.115, 0.18, 0.15], '#c38f6e', -0.18);
  muscle('side deltoid right', 'sideDelts', [0.555, 2.43, 0.005], [0.115, 0.18, 0.15], '#c38f6e', 0.18);
  line([[0, 2.62, 0.297], [0, 2.47, 0.318], [0, 2.35, 0.315]], 0.004, groove);
  [[-0.095, 2.18, 'upperAbs'], [0.095, 2.18, 'upperAbs'], [-0.095, 1.98, 'upperAbs'], [0.095, 1.98, 'upperAbs'], [-0.09, 1.78, 'lowerAbs'], [0.09, 1.78, 'lowerAbs']].forEach(([x, y, zone], index) => {
    muscle(`ab ${index + 1}`, zone, [x, y, 0.218], [0.083, 0.092, 0.042], index < 4 ? '#c99875' : '#bd8d6d');
  });
  muscle('oblique left', 'obliques', [-0.275, 1.95, 0.105], [0.078, 0.25, 0.09], '#b8896a', -0.1);
  muscle('oblique right', 'obliques', [0.275, 1.95, 0.105], [0.078, 0.25, 0.09], '#b8896a', 0.1);

  // Back anatomy is sculpted on the reverse surface of the same rotatable model.
  muscle('upper trapezius left', 'traps', [-0.13, 2.67, -0.18], [0.17, 0.20, 0.075], '#ba8a68', -0.18);
  muscle('upper trapezius right', 'traps', [0.13, 2.67, -0.18], [0.17, 0.20, 0.075], '#ba8a68', 0.18);
  muscle('rear deltoid left', 'rearDelts', [-0.49, 2.45, -0.105], [0.14, 0.17, 0.14], '#c38f6e', -0.25);
  muscle('rear deltoid right', 'rearDelts', [0.49, 2.45, -0.105], [0.14, 0.17, 0.14], '#c38f6e', 0.25);
  muscle('lat left', 'lats', [-0.22, 2.15, -0.205], [0.19, 0.34, 0.065], '#b98664', -0.1);
  muscle('lat right', 'lats', [0.22, 2.15, -0.205], [0.19, 0.34, 0.065], '#b98664', 0.1);
  muscle('mid back left', 'midBack', [-0.09, 2.32, -0.255], [0.105, 0.26, 0.045], '#c49572', -0.08);
  muscle('mid back right', 'midBack', [0.09, 2.32, -0.255], [0.105, 0.26, 0.045], '#c49572', 0.08);
  muscle('lower back left', 'lowerBack', [-0.095, 1.85, -0.205], [0.105, 0.21, 0.045], '#b98a69', -0.08);
  muscle('lower back right', 'lowerBack', [0.095, 1.85, -0.205], [0.105, 0.21, 0.045], '#b98a69', 0.08);
  line([[0, 2.72, -0.235], [0, 2.34, -0.298], [0, 1.95, -0.26], [0, 1.64, -0.20]], 0.006, groove);

  // Arms, elbows, forearms and hands. Each side stays mirrored as the model rotates.
  for (const side of [-1, 1]) {
    const shoulder = [side * 0.53, 2.44, 0];
    const elbow = [side * 0.65, 1.97, 0.015];
    const wrist = [side * 0.72, 1.48, 0.045];
    segment(`upper arm ${side}`, shoulder, elbow, 0.125, 0.098, skin);
    segment(`forearm ${side}`, elbow, wrist, 0.092, 0.063, skin);
    joint(`elbow ${side}`, elbow, 0.092, skin);
    oval(`hand ${side}`, [side * 0.73, 1.37, 0.06], [0.07, 0.12, 0.055], skinLight);
    muscle(`biceps ${side}`, 'biceps', [side * 0.615, 2.20, 0.094], [0.084, 0.20, 0.071], '#d3a17d', side * 0.12);
    muscle(`brachialis ${side}`, 'brachialis', [side * 0.675, 2.055, 0.065], [0.075, 0.115, 0.07], '#be8d6b', side * 0.22);
    muscle(`triceps ${side}`, 'triceps', [side * 0.62, 2.20, -0.086], [0.09, 0.22, 0.073], '#b98766', side * 0.12);
    muscle(`forearm flexors ${side}`, 'forearms', [side * 0.697, 1.72, 0.068], [0.072, 0.22, 0.065], '#c89572', side * 0.11);
  }

  // Legs: front quadriceps, inner thighs, rear hamstrings/glutes and calves.
  for (const side of [-1, 1]) {
    const hip = [side * 0.17, 1.28, 0];
    const knee = [side * 0.19, 0.69, 0.015];
    const ankle = [side * 0.18, 0.15, 0.015];
    segment(`thigh ${side}`, hip, knee, 0.155, 0.105, skin);
    segment(`lower leg ${side}`, knee, ankle, 0.093, 0.062, skin);
    joint(`knee ${side}`, knee, 0.088, skinLight);
    oval(`foot ${side}`, [side * 0.18, 0.085, 0.10], [0.09, 0.07, 0.18], skin);
    muscle(`quadriceps ${side}`, 'quads', [side * 0.18, 0.99, 0.096], [0.135, 0.31, 0.074], '#d1a07c', side * 0.045);
    muscle(`adductor ${side}`, 'adductors', [side * 0.085, 0.99, 0.08], [0.082, 0.28, 0.07], '#bd8d6c', -side * 0.08);
    muscle(`hamstring ${side}`, 'hamstrings', [side * 0.18, 0.98, -0.092], [0.13, 0.31, 0.07], '#bd8d6c', side * 0.04);
    muscle(`glute ${side}`, 'glutes', [side * 0.15, 1.38, -0.18], [0.17, 0.18, 0.10], '#c49270', -side * 0.04);
    muscle(`calf ${side}`, 'calves', [side * 0.18, 0.40, -0.062], [0.095, 0.22, 0.086], '#c49170', side * 0.04);
    muscle(`tibialis ${side}`, 'tibialis', [side * 0.18, 0.42, 0.07], [0.063, 0.22, 0.057], '#d1a07b', side * 0.025);
  }

  const ground = new THREE.Mesh(new THREE.CircleGeometry(0.72, 64), new THREE.MeshBasicMaterial({ color: '#060806', transparent: true, opacity: 0.55, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = 0.015; model.add(ground);
  const floorRing = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.008, 8, 72), new THREE.MeshBasicMaterial({ color: '#90aa61', transparent: true, opacity: 0.52 }));
  floorRing.rotation.x = Math.PI / 2; floorRing.position.y = 0.025; model.add(floorRing);

  function highlightZone(zone) {
    zoneMeshes.forEach((meshes, key) => meshes.forEach(mesh => {
      const active = key === zone;
      mesh.material.color.set(active ? '#d4f083' : mesh.userData.baseColor);
      mesh.material.emissive.set(active ? '#67912e' : '#000000');
      mesh.material.emissiveIntensity = active ? 0.38 : 0;
    }));
  }
  window.addEventListener('alarabin:model-muscle', event => highlightZone(event.detail?.zone || null));
  window.addEventListener('alarabin:model-view', event => {
    targetYaw = event.detail?.view === 'back' ? Math.PI : 0;
    userRotationUntil = performance.now() + 6000;
  });

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let yaw = 0, targetYaw = 0, pitch = 0, targetPitch = 0;
  let pointer = null, lastFrame = performance.now(), lastFace = 'front';
  let userRotationUntil = performance.now() + 5000;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function updateFace() {
    const face = Math.cos(yaw) >= 0 ? 'front' : 'back';
    if (face === lastFace) return;
    lastFace = face;
    window.dispatchEvent(new CustomEvent('alarabin:model-yaw', { detail: { yaw: THREE.MathUtils.radToDeg(yaw), view: face } }));
    const label = document.getElementById('body-model-face-label');
    if (label) label.textContent = face === 'front' ? 'أمامي · اسحب للتدوير' : 'خلفي · اسحب للتدوير';
  }
  function resize() {
    const rect = stage.getBoundingClientRect();
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  function chooseMuscle(event) {
    const rect = canvas.getBoundingClientRect();
    pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    const targetParts = [];
    zoneMeshes.forEach(meshes => targetParts.push(...meshes));
    const hit = raycaster.intersectObjects(targetParts, false).find(item => item.object.userData.zone);
    if (hit) window.dispatchEvent(new CustomEvent('alarabin:muscle-select', { detail: { zone: hit.object.userData.zone } }));
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
    userRotationUntil = performance.now() + 6500;
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) pointer.moved = true;
    if (pointer.moved) {
      targetYaw += dx * 0.012;
      targetPitch = THREE.MathUtils.clamp(targetPitch + dy * 0.004, -0.20, 0.20);
      userRotationUntil = performance.now() + 6500;
    }
    pointer.x = event.clientX; pointer.y = event.clientY;
  });
  const release = event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const moved = pointer.moved;
    pointer = null;
    canvas.classList.remove('is-dragging');
    if (!moved) chooseMuscle(event);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', () => { pointer = null; canvas.classList.remove('is-dragging'); });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); targetYaw += event.key === 'ArrowLeft' ? 0.32 : -0.32;
      userRotationUntil = performance.now() + 6500;
    }
  });

  function draw(now) {
    const delta = Math.min((now - lastFrame) / 1000, 0.04);
    lastFrame = now;
    if (!pointer) {
      yaw += (targetYaw - yaw) * Math.min(1, delta * 8);
      pitch += (targetPitch - pitch) * Math.min(1, delta * 8);
      if (!reducedMotion && now > userRotationUntil) targetYaw += delta * 0.045;
    }
    model.rotation.set(pitch, yaw, 0);
    updateFace();
    renderer.render(scene, camera);
    requestAnimationFrame(draw);
  }

  resize();
  new ResizeObserver(resize).observe(stage);
  stage.classList.add('three-ready');
  canvas.setAttribute('aria-label', 'مجسم عضلي ثلاثي الأبعاد؛ اسحب لتدويره واضغط على عضلة لعرض تمارينها');
  requestAnimationFrame(draw);
})();
