import * as THREE from 'three';

(() => {
  const canvas = document.getElementById('nutrition-plate-canvas');
  const stage = canvas?.closest('.plate-stage');
  const sceneCard = canvas?.closest('.macro-scene');
  if (!canvas || !stage || !sceneCard) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (error) {
    console.info('3D food preview unavailable; the plate illustration remains active.', error);
    return;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  camera.position.set(0, 1.7, 3.1);
  camera.lookAt(0, 0.08, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;

  scene.add(new THREE.HemisphereLight(0xf4f7e9, 0x313a27, 2.1));
  const keyLight = new THREE.DirectionalLight(0xfff6dc, 3.25);
  keyLight.position.set(-3.7, 6, 4.2);
  scene.add(keyLight);
  const limeLight = new THREE.PointLight(0xc5f36b, 15, 8, 2);
  limeLight.position.set(3.5, 2.7, -1.7);
  scene.add(limeLight);
  const fillLight = new THREE.PointLight(0xf5fbff, 8, 9, 2);
  fillLight.position.set(-3, 2, -3.5);
  scene.add(fillLight);

  const plateRig = new THREE.Group();
  scene.add(plateRig);
  const foodRoot = new THREE.Group();
  plateRig.add(foodRoot);

  const material = (color, roughness = 0.48, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const materials = {
    porcelain: new THREE.MeshPhysicalMaterial({ color: '#e9eedf', roughness: 0.2, metalness: 0.1, clearcoat: 0.92, clearcoatRoughness: 0.13, side: THREE.DoubleSide }),
    inner: new THREE.MeshPhysicalMaterial({ color: '#d8dfc6', roughness: 0.28, metalness: 0.04, clearcoat: 0.72, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ color: '#b9a361', roughness: 0.25, metalness: 0.78 }),
    rice: material('#fff3d4', 0.82), riceShade: material('#ead8b1', 0.85),
    chicken: material('#a75c36', 0.62), chickenLight: material('#c88345', 0.58), grill: material('#593321', 0.75),
    salmon: material('#dc7655', 0.48), salmonLight: material('#f2b181', 0.54), meat: material('#79412f', 0.58),
    egg: material('#fff8e5', 0.35), yolk: material('#f4b330', 0.4),
    potato: material('#d9a74f', 0.72), potatoSkin: material('#916b3d', 0.78),
    pasta: material('#e8bd61', 0.52), sauce: material('#bf4631', 0.56),
    oats: material('#dcc899', 0.9), bread: material('#b47a45', 0.76), breadInner: material('#f3d69c', 0.74),
    greens: material('#5f984b', 0.68), greensLight: material('#9ebf57', 0.66), greensDark: material('#3b713e', 0.7),
    tomato: material('#cf4a39', 0.4), cucumber: material('#72a951', 0.56), cucumberCore: material('#e1edb5', 0.65),
    nut: material('#ad7546', 0.76), peanut: material('#d9b77d', 0.82), avocado: material('#91a85b', 0.55), avocadoCore: material('#d8dd8a', 0.5), seed: material('#78523b', 0.55),
    dairy: material('#f2efdc', 0.34), fruitRed: material('#c94f47', 0.42), fruitYellow: material('#e5b541', 0.43), fruitPurple: material('#7861a2', 0.46),
    shadow: new THREE.MeshBasicMaterial({ color: '#050704', transparent: true, opacity: 0.24, depthWrite: false }),
    selectedRing: new THREE.MeshBasicMaterial({ color: '#c5f36b', transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }),
  };
  const sphereGeometry = new THREE.SphereGeometry(1, 28, 18);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1);
  const sharedGeometries = new Set([sphereGeometry, cylinderGeometry]);
  const dummy = new THREE.Object3D();
  let currentItems = [];
  let currentCategory = 'protein';
  let userRotationUntil = 0;
  let pointer = null;
  let lastFrame = performance.now();

  const addMesh = (parent, geometry, mat, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) => {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...position);
    object.scale.set(...scale);
    object.rotation.set(...rotation);
    parent.add(object);
    return object;
  };
  const ellipsoid = (parent, mat, position, scale, rotation = [0, 0, 0]) => addMesh(parent, sphereGeometry, mat, position, scale, rotation);
  const tube = (parent, points, radius, mat, segments = 20) => {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return addMesh(parent, new THREE.TubeGeometry(curve, segments, radius, 7, false), mat);
  };
  const torus = (parent, radius, tubeRadius, mat, y) => addMesh(parent, new THREE.TorusGeometry(radius, tubeRadius, 10, 104), mat, [0, y, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);

  function buildPlate() {
    const profile = [
      new THREE.Vector2(0, 0.105), new THREE.Vector2(0.62, 0.105), new THREE.Vector2(0.91, 0.105),
      new THREE.Vector2(1.04, 0.12), new THREE.Vector2(1.16, 0.17), new THREE.Vector2(1.31, 0.205),
      new THREE.Vector2(1.45, 0.19), new THREE.Vector2(1.53, 0.145), new THREE.Vector2(1.54, 0.095),
      new THREE.Vector2(1.49, 0.052), new THREE.Vector2(1.37, 0.025), new THREE.Vector2(1.17, 0.042),
      new THREE.Vector2(0.88, 0.035), new THREE.Vector2(0.54, 0.012), new THREE.Vector2(0, 0.012),
    ];
    addMesh(plateRig, new THREE.LatheGeometry(profile, 112), materials.porcelain, [0, 0, 0]);
    addMesh(plateRig, new THREE.CylinderGeometry(0.57, 0.7, 0.13, 72), materials.inner, [0, -0.045, 0]);
    addMesh(plateRig, new THREE.TorusGeometry(0.55, 0.038, 12, 72), materials.porcelain, [0, -0.12, 0]);
    torus(plateRig, 1.45, 0.014, materials.brass, 0.187);
    torus(plateRig, 1.16, 0.009, materials.brass, 0.168);
    torus(plateRig, 1.02, 0.012, materials.inner, 0.122);
    const shadow = addMesh(plateRig, new THREE.CircleGeometry(1, 64), materials.shadow, [0.08, -0.19, -0.02], [1.67, 1.08, 1], [-Math.PI / 2, 0, 0]);
    shadow.renderOrder = -1;
    const glint = new THREE.PointLight('#fff3ce', 8, 3.6, 2);
    glint.position.set(-1.7, 1.4, 1.3);
    plateRig.add(glint);
  }

  function detectKind(food) {
    const text = `${food?.name || ''} ${food?.category || ''}`.toLocaleLowerCase('ar');
    const category = `${food?.category || ''}`;
    if (/رز|تمن|برغل|برياني/.test(text)) return 'rice';
    if (/بطاط|بتات/.test(text)) return 'potato';
    if (/معكرون|مكرون|نودلز|باستا/.test(text)) return 'pasta';
    if (/شوفان/.test(text)) return 'oats';
    if (/خبز|توست|صمون/.test(text)) return 'bread';
    if (/تمر/.test(text)) return 'dates';
    if (/موز|تفاح|برتقال|عنب|فراول|فاكه/.test(text)) return 'fruit';
    if (/دجاج|صدر|بانيه|بانيا/.test(text)) return 'chicken';
    if (/سمك|تونة|تونه|سلمون|سالمون/.test(text)) return 'fish';
    if (/بيض/.test(text)) return 'eggs';
    if (/لحم|كباب|غنم|بقر/.test(text)) return 'meat';
    if (/خضار|سلط|طماط|خيار|قرنابيط|بروكلي|خس/.test(text)) return 'vegetables';
    if (/زيت|مكسر|فول سوداني|لوز|جوز|طحيني|أفوكادو|افوكادو|زبدة/.test(text)) return 'fats';
    if (/حليب|روب|لبن|جبن|زباد/.test(text)) return 'dairy';
    if (/بروتين|كارب|دهون/.test(category + text)) {
      if (/بروتين/.test(category + text)) return 'protein';
      if (/دهون/.test(category + text)) return 'fats';
      return 'carbs';
    }
    return 'vegetables';
  }

  function makeRice(parent) {
    ellipsoid(parent, materials.riceShade, [0, 0.17, 0], [0.43, 0.11, 0.37]);
    const grainCount = 118;
    const grains = new THREE.InstancedMesh(sphereGeometry, materials.rice, grainCount);
    let seed = 47;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < grainCount; i += 1) {
      const radius = 0.42 * Math.sqrt(random());
      const angle = random() * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.85;
      const mound = Math.max(0, 1 - radius / 0.45) * 0.15;
      dummy.position.set(x, 0.22 + mound + random() * 0.055, z);
      dummy.rotation.set((random() - 0.5) * 1.1, angle, (random() - 0.5) * 1.4);
      dummy.scale.set(0.074 + random() * 0.035, 0.016, 0.027);
      dummy.updateMatrix();
      grains.setMatrixAt(i, dummy.matrix);
    }
    grains.instanceMatrix.needsUpdate = true;
    parent.add(grains);
  }

  function makeChicken(parent) {
    const pieces = [[-0.17, 0.23, -0.08, -0.12], [0.21, 0.22, -0.02, 0.24], [0.02, 0.24, 0.17, -0.32]];
    pieces.forEach(([x, y, z, angle], index) => {
      ellipsoid(parent, index === 1 ? materials.chickenLight : materials.chicken, [x, y, z], [0.35, 0.13, 0.24], [0.12, angle, 0.02]);
      for (let line = -1; line <= 1; line += 1) {
        const offset = line * 0.078;
        tube(parent, [[x - 0.16, y + 0.095, z + offset - 0.035], [x - 0.02, y + 0.12, z + offset], [x + 0.13, y + 0.095, z + offset + 0.035]], 0.009, materials.grill, 10);
      }
    });
  }

  function makeFish(parent) {
    ellipsoid(parent, materials.salmon, [0, 0.22, 0], [0.57, 0.13, 0.29], [0.05, -0.15, 0]);
    ellipsoid(parent, materials.salmonLight, [0, 0.306, 0], [0.45, 0.022, 0.205], [0, -0.15, 0]);
    for (let i = -2; i <= 2; i += 1) {
      const x = i * 0.14;
      tube(parent, [[x - 0.045, 0.325, -0.16], [x, 0.337, 0], [x + 0.045, 0.325, 0.16]], 0.009, materials.salmon, 9);
    }
    ellipsoid(parent, materials.lemon || materials.fruitYellow, [0.49, 0.16, 0.27], [0.12, 0.035, 0.12], [-0.15, 0.2, 0]);
  }

  function makeEggs(parent) {
    [[-0.2, 0], [0.2, 0.03]].forEach(([x, z], i) => {
      ellipsoid(parent, materials.egg, [x, 0.16, z], [0.3, 0.055, 0.22], [0, i * 0.28, 0]);
      ellipsoid(parent, materials.yolk, [x - 0.025, 0.214, z], [0.105, 0.052, 0.095]);
      ellipsoid(parent, materials.yolk, [x + 0.24, 0.175, z + 0.17], [0.045, 0.012, 0.035]);
    });
  }

  function makePotatoes(parent) {
    for (let i = 0; i < 7; i += 1) {
      const angle = (Math.PI * 2 * i) / 7;
      const x = Math.cos(angle) * (0.16 + (i % 2) * 0.06);
      const z = Math.sin(angle) * (0.15 + (i % 2) * 0.06);
      ellipsoid(parent, materials.potato, [x, 0.19 + (i % 3) * 0.02, z], [0.22, 0.095, 0.13], [0.1, angle, 0.15]);
      if (i % 2 === 0) ellipsoid(parent, materials.potatoSkin, [x - 0.04, 0.26, z + 0.018], [0.09, 0.012, 0.025], [0, angle, 0]);
    }
    for (let i = 0; i < 6; i += 1) ellipsoid(parent, materials.greensLight, [-0.35 + i * 0.09, 0.14, 0.35], [0.075, 0.015, 0.045], [0, i * 0.3, 0]);
  }

  function makePasta(parent) {
    const colors = [materials.pasta, materials.pasta, materials.pasta, materials.sauce, materials.pasta];
    for (let strand = 0; strand < 5; strand += 1) {
      const z = (strand - 2) * 0.105;
      const points = [];
      for (let step = 0; step <= 10; step += 1) {
        const t = step / 10;
        points.push([-0.48 + t * 0.96, 0.17 + Math.sin(t * Math.PI * 4 + strand) * 0.055 + Math.cos(t * Math.PI * 2) * 0.035, z + Math.sin(t * Math.PI * 3 + strand * 0.8) * 0.055]);
      }
      tube(parent, points, strand === 3 ? 0.04 : 0.033, colors[strand], 28);
    }
    [[-0.18, 0.26, -0.2], [0.2, 0.25, 0.2], [0.3, 0.22, -0.11]].forEach(point => ellipsoid(parent, materials.tomato, point, [0.085, 0.055, 0.075]));
  }

  function makeOats(parent) {
    ellipsoid(parent, materials.oats, [0, 0.14, 0], [0.43, 0.11, 0.34]);
    for (let i = 0; i < 45; i += 1) {
      const angle = i * 2.399;
      const radius = 0.36 * Math.sqrt((i + 1) / 46);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.84;
      ellipsoid(parent, i % 4 === 0 ? materials.breadInner : materials.oats, [x, 0.22 + (1 - radius / 0.4) * 0.06, z], [0.06, 0.012, 0.034], [0.1, angle, (i % 5) * 0.14]);
    }
    [[-0.32, 0.17, -0.16], [0.3, 0.17, 0.17]].forEach(([x, y, z]) => ellipsoid(parent, materials.fruitPurple, [x, y, z], [0.07, 0.06, 0.07]));
  }

  function makeBread(parent) {
    addMesh(parent, new THREE.BoxGeometry(0.58, 0.13, 0.44), materials.bread, [-0.1, 0.18, 0], [1, 1, 1], [0, -0.15, 0]);
    addMesh(parent, new THREE.BoxGeometry(0.48, 0.055, 0.35), materials.breadInner, [-0.1, 0.255, 0], [1, 1, 1], [0, -0.15, 0]);
    addMesh(parent, new THREE.BoxGeometry(0.55, 0.12, 0.41), materials.bread, [0.19, 0.15, 0.12], [1, 1, 1], [0, 0.23, 0]);
  }

  function makeDates(parent) {
    for (let i = 0; i < 6; i += 1) {
      const angle = i * Math.PI / 3;
      const x = Math.cos(angle) * 0.2;
      const z = Math.sin(angle) * 0.18;
      ellipsoid(parent, materials.meat, [x, 0.18, z], [0.14, 0.08, 0.08], [0.18, angle, 0.2]);
      ellipsoid(parent, materials.nut, [x, 0.245, z - 0.012], [0.055, 0.012, 0.018], [0, angle, 0]);
    }
  }

  function makeFruit(parent) {
    const colorSet = [materials.fruitRed, materials.fruitYellow, materials.fruitPurple];
    for (let i = 0; i < 8; i += 1) {
      const angle = i * 2.4;
      const radius = 0.12 + (i % 3) * 0.095;
      const fruit = ellipsoid(parent, colorSet[i % colorSet.length], [Math.cos(angle) * radius, 0.18 + (i % 3) * 0.035, Math.sin(angle) * radius], [0.1, 0.09, 0.095], [0.1, angle, 0.08]);
      if (i % 3 === 1) ellipsoid(parent, materials.greens, [fruit.position.x, 0.27 + (i % 3) * 0.035, fruit.position.z], [0.025, 0.03, 0.02]);
    }
  }

  function makeMeat(parent) {
    [[-0.2, 0.21, -0.06], [0.19, 0.2, 0.03], [0.0, 0.23, 0.18]].forEach(([x, y, z], i) => {
      ellipsoid(parent, i === 1 ? materials.chicken : materials.meat, [x, y, z], [0.26, 0.13, 0.18], [0.08, i * 0.55, 0.12]);
      tube(parent, [[x - 0.1, y + 0.1, z - 0.08], [x, y + 0.12, z], [x + 0.1, y + 0.1, z + 0.08]], 0.01, materials.grill, 10);
    });
  }

  function makeVegetables(parent) {
    for (let i = 0; i < 9; i += 1) {
      const angle = i * 2.4;
      const radius = 0.1 + (i % 3) * 0.09;
      ellipsoid(parent, i % 3 === 0 ? materials.greensDark : materials.greens, [Math.cos(angle) * radius, 0.17 + (i % 3) * 0.025, Math.sin(angle) * radius], [0.22, 0.045, 0.105], [0.15, angle, 0.22]);
    }
    [[-0.31, 0.18, 0.22], [0.32, 0.17, -0.2], [0.33, 0.17, 0.2]].forEach(point => ellipsoid(parent, materials.tomato, point, [0.09, 0.08, 0.09]));
    for (let i = 0; i < 4; i += 1) {
      const angle = (Math.PI * 2 * i) / 4;
      const cucumber = addMesh(parent, cylinderGeometry, materials.cucumber, [Math.cos(angle) * 0.28, 0.16, Math.sin(angle) * 0.27], [0.1, 0.027, 0.1]);
      cucumber.rotation.y = angle;
      const cucumberCore = addMesh(parent, cylinderGeometry, materials.cucumberCore, [Math.cos(angle) * 0.28, 0.179, Math.sin(angle) * 0.27], [0.074, 0.012, 0.074]);
      cucumberCore.rotation.y = angle;
    }
  }

  function makeFats(parent) {
    if (/أفوكادو|افوكادو/.test(currentItems.find(item => item.id === parent.userData.foodId)?.name || '')) {
      ellipsoid(parent, materials.greensDark, [0, 0.16, 0], [0.45, 0.12, 0.35], [0.05, 0.18, 0]);
      ellipsoid(parent, materials.avocado, [0, 0.23, 0], [0.38, 0.09, 0.29], [0.05, 0.18, 0]);
      ellipsoid(parent, materials.avocadoCore, [0, 0.29, 0], [0.25, 0.045, 0.19]);
      ellipsoid(parent, materials.seed, [0.02, 0.34, 0.01], [0.09, 0.055, 0.075]);
      return;
    }
    for (let i = 0; i < 7; i += 1) {
      const angle = i * 2.4;
      const radius = i % 2 ? 0.24 : 0.11;
      ellipsoid(parent, i % 3 === 0 ? materials.nut : materials.peanut, [Math.cos(angle) * radius, 0.19, Math.sin(angle) * radius], [0.13, 0.065, 0.075], [0.15, angle, 0.24]);
    }
  }

  function makeDairy(parent) {
    ellipsoid(parent, materials.dairy, [0, 0.18, 0], [0.43, 0.13, 0.34]);
    for (let i = 0; i < 5; i += 1) {
      const angle = i * 2.4;
      ellipsoid(parent, i % 2 ? materials.fruitRed : materials.fruitPurple, [Math.cos(angle) * 0.24, 0.3, Math.sin(angle) * 0.2], [0.075, 0.065, 0.07]);
    }
  }

  function makeGenericProtein(parent) {
    for (let i = 0; i < 6; i += 1) {
      const angle = i * 2.4;
      ellipsoid(parent, i % 2 ? materials.chickenLight : materials.meat, [Math.cos(angle) * 0.23, 0.19 + (i % 3) * 0.025, Math.sin(angle) * 0.18], [0.16, 0.09, 0.12], [0.1, angle, 0.18]);
    }
  }

  function makeGenericCarbs(parent) {
    ellipsoid(parent, materials.pasta, [0, 0.17, 0], [0.42, 0.1, 0.34]);
    for (let i = 0; i < 26; i += 1) {
      const angle = i * 2.4;
      const radius = 0.38 * Math.sqrt((i + 1) / 27);
      ellipsoid(parent, i % 3 ? materials.rice : materials.oats, [Math.cos(angle) * radius, 0.24, Math.sin(angle) * radius * 0.8], [0.055, 0.018, 0.027], [0, angle, 0.15]);
    }
  }

  function makePortion(food, index, count) {
    const group = new THREE.Group();
    group.userData.foodId = food.id;
    const kind = detectKind(food);
    if (kind === 'rice') makeRice(group);
    else if (kind === 'chicken') makeChicken(group);
    else if (kind === 'fish') makeFish(group);
    else if (kind === 'eggs') makeEggs(group);
    else if (kind === 'potato') makePotatoes(group);
    else if (kind === 'pasta') makePasta(group);
    else if (kind === 'oats') makeOats(group);
    else if (kind === 'bread') makeBread(group);
    else if (kind === 'dates') makeDates(group);
    else if (kind === 'fruit') makeFruit(group);
    else if (kind === 'meat') makeMeat(group);
    else if (kind === 'vegetables') makeVegetables(group);
    else if (kind === 'fats') makeFats(group);
    else if (kind === 'dairy') makeDairy(group);
    else if (kind === 'protein') makeGenericProtein(group);
    else makeGenericCarbs(group);

    const layout = count === 1
      ? [[0, 0.02]]
      : count === 2 ? [[-0.44, 0.03], [0.44, 0.03]]
        : count === 3 ? [[-0.43, 0.19], [0.43, 0.19], [0, -0.39]]
          : count === 4 ? [[-0.43, 0.28], [0.43, 0.28], [-0.43, -0.33], [0.43, -0.33]]
            : Array.from({ length: count }, (_, i) => {
              const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
              return [Math.cos(angle) * 0.57, Math.sin(angle) * 0.49];
            });
    if (food.current) {
      addMesh(group, new THREE.RingGeometry(0.38, 0.405, 52), materials.selectedRing, [0, 0.135, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    }
    group.position.set(layout[index][0], 0.12, layout[index][1]);
    const portionScale = count >= 5 ? 0.66 : count === 4 ? 0.76 : count === 3 ? 0.86 : count === 2 ? 0.93 : 1;
    const amountScale = THREE.MathUtils.clamp(Math.sqrt(Math.max(1, Number(food.grams) || 100) / 100), 0.84, 1.2);
    group.scale.setScalar(portionScale * amountScale);
    group.rotation.y = (index * 0.48) + (kind === 'bread' ? -0.2 : 0);
    foodRoot.add(group);
    return group;
  }

  function addEmptyGarnish() {
    const garnish = new THREE.Group();
    ellipsoid(garnish, materials.greens, [-0.25, 0.17, 0], [0.25, 0.045, 0.12], [0.1, -0.5, 0.15]);
    ellipsoid(garnish, materials.greensLight, [-0.05, 0.18, -0.13], [0.24, 0.045, 0.12], [0.1, 0.3, -0.18]);
    ellipsoid(garnish, materials.greensDark, [0.16, 0.17, 0.04], [0.25, 0.045, 0.12], [0.1, 0.7, 0.18]);
    ellipsoid(garnish, materials.tomato, [0.1, 0.19, -0.02], [0.12, 0.095, 0.12]);
    ellipsoid(garnish, materials.tomato, [-0.17, 0.19, 0.11], [0.09, 0.07, 0.09]);
    ellipsoid(garnish, materials.fruitYellow, [0.3, 0.16, -0.2], [0.12, 0.03, 0.11], [0.2, -0.2, 0]);
    garnish.position.set(0, 0.12, 0);
    foodRoot.add(garnish);
  }

  function releaseFoodMeshes() {
    foodRoot.traverse(object => {
      if (object.geometry && !sharedGeometries.has(object.geometry)) object.geometry.dispose();
    });
    foodRoot.clear();
  }

  function refreshFood(items) {
    currentItems = items;
    releaseFoodMeshes();
    if (!items.length) {
      addEmptyGarnish();
      return;
    }
    const visible = items.slice(-6);
    visible.forEach((food, index) => makePortion(food, index, visible.length));
  }

  function updatePlate(selected, items) {
    const meal = Array.isArray(items) ? items.filter(item => item && item.name) : [];
    const uniqueMeal = new Map();
    meal.forEach((item, index) => {
      const key = item.id == null ? item.name : String(item.id);
      const existing = uniqueMeal.get(key);
      if (existing) existing.grams = (Number(existing.grams) || 0) + (Number(item.grams) || 0);
      else uniqueMeal.set(key, { ...item, _order: index });
    });
    let visibleMeal = [...uniqueMeal.values()];
    if (selected?.name) {
      const key = selected.id == null ? null : String(selected.id);
      const found = key == null ? -1 : visibleMeal.findIndex(item => String(item.id) === key);
      if (found < 0) visibleMeal.unshift({ ...selected, current: true, _order: -1 });
      else visibleMeal[found] = { ...visibleMeal[found], current: true };
    }
    const normalized = [
      ...visibleMeal.filter(item => item.current),
      ...visibleMeal.filter(item => !item.current).slice(-3),
    ].slice(0, 4).map((item, index) => ({ ...item, id: item.id ?? `plate-item-${index}` }));
    refreshFood(normalized);
    canvas.setAttribute('aria-label', normalized.length
      ? `معاينة ثلاثية الأبعاد للوجبة: ${normalized.map(item => item.name).join('، ')}`
      : 'طبق طعام ثلاثي الأبعاد تفاعلي. اختار أكلة حتى تظهر بالصحن.');
  }

  function resize() {
    const { width, height } = stage.getBoundingClientRect();
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  function draw(now) {
    requestAnimationFrame(draw);
    if (document.hidden) return;
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    if (!reducedMotion && now > userRotationUntil) plateRig.rotation.y += delta * 0.075;
    renderer.render(scene, camera);
  }

  canvas.addEventListener('pointerdown', event => {
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
    userRotationUntil = performance.now() + 3200;
    canvas.classList.add('is-dragging');
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    plateRig.rotation.y += dx * 0.009;
    plateRig.rotation.x = THREE.MathUtils.clamp(plateRig.rotation.x + dy * 0.003, -0.16, 0.24);
  });
  const releasePointer = event => {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    canvas.classList.remove('is-dragging');
    userRotationUntil = performance.now() + 2600;
  };
  canvas.addEventListener('pointerup', releasePointer);
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('lostpointercapture', releasePointer);
  canvas.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      plateRig.rotation.y += event.key === 'ArrowLeft' ? 0.28 : -0.28;
      userRotationUntil = performance.now() + 2600;
    }
  });

  window.updateAlarabin3DPlate = updatePlate;
  window.updateAlarabin3DCategory = category => {
    currentCategory = category;
    sceneCard.dataset.active = category;
    const tint = category === 'carbs' ? '#e7d27f' : category === 'fats' ? '#a9cf75' : '#e7a879';
    limeLight.color.set(tint);
  };
  buildPlate();
  resize();
  if (window.__alarabinPlateData) updatePlate(window.__alarabinPlateData.selected, window.__alarabinPlateData.items);
  else addEmptyGarnish();
  sceneCard.classList.add('three-ready');
  stage.setAttribute('aria-busy', 'false');
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  requestAnimationFrame(draw);
})();
