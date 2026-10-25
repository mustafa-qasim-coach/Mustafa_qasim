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
  camera.position.set(0, 2.7, 3.0);
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
  const photoFoodTextures = new Map();
  const photoFoodSlots = {
    rice: [0, 0], chicken: [1, 0], fish: [2, 0],
    meat: [0, 1], potato: [1, 1], pasta: [2, 1],
    eggs: [0, 2], vegetables: [1, 2], fruit: [2, 2],
  };
  const photoFoodSizes = {
    rice: [1.12, 0.94], chicken: [1.14, 0.94], fish: [1.18, 0.86],
    meat: [1.1, 0.96], potato: [1.12, 0.94], pasta: [1.12, 0.94],
    eggs: [1.1, 0.93], vegetables: [1.13, 0.96], fruit: [1.13, 0.95],
  };

  function loadPhotoFoodAtlas() {
    const atlas = new Image();
    atlas.decoding = 'async';
    atlas.onload = () => {
      const cropInset = 0.018;
      Object.entries(photoFoodSlots).forEach(([kind, [column, row]]) => {
        const sourceWidth = atlas.naturalWidth / 3;
        const sourceHeight = atlas.naturalHeight / 3;
        const insetX = sourceWidth * cropInset;
        const insetY = sourceHeight * cropInset;
        const tile = document.createElement('canvas');
        tile.width = 512;
        tile.height = 512;
        const context = tile.getContext('2d');
        if (!context) return;
        context.drawImage(
          atlas,
          column * sourceWidth + insetX,
          row * sourceHeight + insetY,
          sourceWidth - insetX * 2,
          sourceHeight - insetY * 2,
          0, 0, tile.width, tile.height,
        );
        const texture = new THREE.CanvasTexture(tile);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        texture.needsUpdate = true;
        photoFoodTextures.set(kind, texture);
      });
      refreshFood(currentItems, false);
    };
    atlas.onerror = () => console.info('Realistic food textures unavailable; using the built-in 3D food models.');
    atlas.src = new URL('./food-sprites-atlas.png', import.meta.url).href;
  }

  function addPhotoFood(parent, kind) {
    const texture = photoFoodTextures.get(kind);
    if (!texture) return false;
    const [width, height] = photoFoodSizes[kind] || [0.82, 0.68];
    const shadow = addMesh(parent, new THREE.CircleGeometry(1, 48), materials.photoShadow, [0, 0.115, 0], [width * 0.46, height * 0.42, 1], [-Math.PI / 2, 0, 0]);
    shadow.renderOrder = 1;
    const imageMaterial = new THREE.MeshPhysicalMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.035,
      roughness: 0.58,
      metalness: 0,
      clearcoat: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const servingGeometry = new THREE.PlaneGeometry(width, height, 16, 16);
    const vertices = servingGeometry.attributes.position;
    for (let index = 0; index < vertices.count; index += 1) {
      const x = vertices.getX(index) / (width * 0.5);
      const y = vertices.getY(index) / (height * 0.5);
      const mound = Math.max(0, 1 - x * x - y * y);
      vertices.setZ(index, mound * 0.045);
    }
    servingGeometry.computeVertexNormals();
    const serving = addMesh(parent, servingGeometry, imageMaterial, [0, 0.17, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
    serving.userData.disposeMaterial = true;
    serving.renderOrder = 2;
    return true;
  }

  function createFoodTexture({ base, shade, light, fleck, seed = 19, fibers = false }) {
    const surface = document.createElement('canvas');
    surface.width = 256;
    surface.height = 256;
    const context = surface.getContext('2d');
    if (!context) return null;
    let value = seed;
    const random = () => { value = (value * 16807) % 2147483647; return (value - 1) / 2147483646; };
    const gradient = context.createRadialGradient(74, 66, 8, 134, 136, 190);
    gradient.addColorStop(0, light);
    gradient.addColorStop(0.55, base);
    gradient.addColorStop(1, shade);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 300; i += 1) {
      const x = random() * 256;
      const y = random() * 256;
      const radius = 1 + random() * (fibers ? 4.5 : 7);
      context.globalAlpha = 0.08 + random() * 0.2;
      context.fillStyle = random() > 0.53 ? light : shade;
      context.beginPath();
      context.ellipse(x, y, radius * (fibers ? 1.8 : 1), radius * (fibers ? 0.55 : 1), random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    if (fibers) {
      for (let i = 0; i < 58; i += 1) {
        const x = random() * 256;
        const y = random() * 256;
        context.strokeStyle = random() > 0.55 ? light : shade;
        context.globalAlpha = 0.15 + random() * 0.18;
        context.lineWidth = 0.7 + random() * 1.1;
        context.beginPath();
        context.moveTo(x, y);
        context.quadraticCurveTo(x + (random() - 0.5) * 28, y + 12, x + (random() - 0.5) * 42, y + 30 + random() * 24);
        context.stroke();
      }
    }
    for (let i = 0; i < 170; i += 1) {
      const x = random() * 256;
      const y = random() * 256;
      context.globalAlpha = 0.25 + random() * 0.45;
      context.fillStyle = fleck;
      context.beginPath();
      context.ellipse(x, y, 0.7 + random() * 1.7, 0.7 + random() * 1.2, random() * Math.PI, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
    texture.needsUpdate = true;
    return texture;
  }

  const chickenTexture = createFoodTexture({ base: '#be7747', shade: '#70452f', light: '#e2aa70', fleck: '#503625', seed: 71, fibers: true });
  const fishTexture = createFoodTexture({ base: '#e48461', shade: '#c45e4b', light: '#ffc398', fleck: '#f5d9b9', seed: 83, fibers: true });
  const meatTexture = createFoodTexture({ base: '#854832', shade: '#482c25', light: '#b36c49', fleck: '#3b271f', seed: 97, fibers: true });
  const potatoTexture = createFoodTexture({ base: '#d2a25d', shade: '#8b6538', light: '#f3d18a', fleck: '#765734', seed: 113 });
  const material = (color, roughness = 0.48, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
  const materials = {
    porcelain: new THREE.MeshPhysicalMaterial({ color: '#e9eedf', roughness: 0.2, metalness: 0.1, clearcoat: 0.92, clearcoatRoughness: 0.13, side: THREE.DoubleSide }),
    inner: new THREE.MeshPhysicalMaterial({ color: '#d8dfc6', roughness: 0.28, metalness: 0.04, clearcoat: 0.72, side: THREE.DoubleSide }),
    brass: new THREE.MeshStandardMaterial({ color: '#b9a361', roughness: 0.25, metalness: 0.78 }),
    rice: material('#fff3d4', 0.82), riceShade: material('#ead8b1', 0.85),
    chicken: chickenTexture ? new THREE.MeshPhysicalMaterial({ color: '#fff9f0', map: chickenTexture, roughness: 0.46, clearcoat: 0.28, clearcoatRoughness: 0.34 }) : material('#bd7447', 0.56),
    chickenLight: material('#d79459', 0.5), crust: material('#78462f', 0.58), grill: material('#503326', 0.75),
    salmon: fishTexture ? new THREE.MeshPhysicalMaterial({ color: '#fff9f0', map: fishTexture, roughness: 0.42, clearcoat: 0.22 }) : material('#dc7655', 0.48),
    salmonLight: material('#f7c89d', 0.48), meat: meatTexture ? new THREE.MeshPhysicalMaterial({ color: '#fff9f0', map: meatTexture, roughness: 0.49, clearcoat: 0.24 }) : material('#79412f', 0.58),
    egg: material('#fff8e5', 0.35), yolk: material('#f4b330', 0.4),
    potato: potatoTexture ? new THREE.MeshPhysicalMaterial({ color: '#fffaf0', map: potatoTexture, roughness: 0.58, clearcoat: 0.12 }) : material('#d9a74f', 0.72), potatoSkin: material('#916b3d', 0.78),
    pasta: material('#e8bd61', 0.52), sauce: material('#bf4631', 0.56),
    oats: material('#dcc899', 0.9), bread: material('#b47a45', 0.76), breadInner: material('#f3d69c', 0.74),
    greens: material('#5f984b', 0.68), greensLight: material('#9ebf57', 0.66), greensDark: material('#3b713e', 0.7),
    tomato: material('#cf4a39', 0.4), cucumber: material('#72a951', 0.56), cucumberCore: material('#e1edb5', 0.65),
    nut: material('#ad7546', 0.76), peanut: material('#d9b77d', 0.82), avocado: material('#91a85b', 0.55), avocadoCore: material('#d8dd8a', 0.5), seed: material('#78523b', 0.55),
    dairy: material('#f2efdc', 0.34), fruitRed: material('#c94f47', 0.42), fruitYellow: material('#e5b541', 0.43), fruitPurple: material('#7861a2', 0.46),
    shadow: new THREE.MeshBasicMaterial({ color: '#050704', transparent: true, opacity: 0.24, depthWrite: false }),
    photoShadow: new THREE.MeshBasicMaterial({ color: '#241d17', transparent: true, opacity: 0.11, depthWrite: false }),
    selectedRing: new THREE.MeshBasicMaterial({ color: '#c5f36b', transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide }),
  };
  const sphereGeometry = new THREE.SphereGeometry(1, 28, 18);
  const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 24, 1);
  const sharedGeometries = new Set([sphereGeometry, cylinderGeometry]);
  const dummy = new THREE.Object3D();
  let currentItems = [];
  let currentCategory = 'protein';
  let previousVisualSignature = '';
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
    const cutletShape = new THREE.Shape();
    cutletShape.moveTo(-0.34, -0.1);
    cutletShape.bezierCurveTo(-0.39, -0.02, -0.3, 0.11, -0.17, 0.13);
    cutletShape.bezierCurveTo(-0.02, 0.21, 0.17, 0.17, 0.31, 0.08);
    cutletShape.bezierCurveTo(0.41, 0.01, 0.35, -0.11, 0.26, -0.15);
    cutletShape.bezierCurveTo(0.12, -0.23, -0.03, -0.17, -0.15, -0.16);
    cutletShape.bezierCurveTo(-0.24, -0.19, -0.31, -0.18, -0.34, -0.1);
    const cutletGeometry = new THREE.ExtrudeGeometry(cutletShape, {
      depth: 0.09,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.025,
      bevelThickness: 0.025,
      curveSegments: 16,
      steps: 1,
    });
    cutletGeometry.computeVertexNormals();
    const pieces = [
      { x: -0.21, z: -0.09, angle: -0.26, sx: 0.82, sz: 0.8 },
      { x: 0.17, z: -0.005, angle: 0.19, sx: 0.9, sz: 0.83 },
      { x: -0.005, z: 0.19, angle: -0.12, sx: 0.69, sz: 0.72 },
    ];
    pieces.forEach(({ x, z, angle, sx, sz }, index) => {
      const cutlet = addMesh(parent, cutletGeometry, materials.chicken, [x, 0.19 + index * 0.008, z], [sx, sz, 1], [-Math.PI / 2, angle, 0]);
      cutlet.castShadow = false;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotatePoint = (lx, lz, y) => [x + cos * lx + sin * lz, y, z - sin * lx + cos * lz];
      for (let line = -1; line <= 1; line += 1) {
        const localZ = line * 0.055 * sz;
        const start = rotatePoint(-0.2 * sx, localZ - 0.018, 0.305 + index * 0.008);
        const middle = rotatePoint(-0.015 * sx, localZ, 0.316 + index * 0.008);
        const end = rotatePoint(0.19 * sx, localZ + 0.018, 0.305 + index * 0.008);
        tube(parent, [start, middle, end], 0.007, index === 1 && line === 0 ? materials.chickenLight : materials.grill, 12);
      }
    });
    let seed = 29;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 18; i += 1) {
      const x = (random() - 0.5) * 0.72;
      const z = (random() - 0.5) * 0.34;
      const spice = ellipsoid(parent, i % 3 ? materials.greensDark : materials.potatoSkin, [x, 0.315 + random() * 0.014, z], [0.012 + random() * 0.009, 0.004, 0.008 + random() * 0.006]);
      spice.rotation.y = random() * Math.PI;
    }
  }

  function makeFish(parent) {
    ellipsoid(parent, materials.meat, [0, 0.195, 0], [0.57, 0.105, 0.29], [0.05, -0.15, 0]);
    ellipsoid(parent, materials.salmon, [0, 0.235, 0], [0.55, 0.11, 0.28], [0.05, -0.15, 0]);
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
      ellipsoid(parent, materials.crust, [x, y - 0.01, z], [0.27, 0.13, 0.19], [0.08, i * 0.55, 0.12]);
      ellipsoid(parent, materials.meat, [x, y + 0.014, z], [0.255, 0.12, 0.175], [0.08, i * 0.55, 0.12]);
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

  function makePortion(food, index, count, animateIn = false) {
    const group = new THREE.Group();
    group.userData.foodId = food.id;
    const kind = detectKind(food);
    const hasPhotoTexture = addPhotoFood(group, kind);
    if (hasPhotoTexture) { /* The cutout sprite supplies the realistic food surface. */ }
    else if (kind === 'rice') makeRice(group);
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
    const baseY = 0.12;
    group.position.set(layout[index][0], baseY + (animateIn && !reducedMotion ? 0.15 : 0), layout[index][1]);
    const portionScale = count >= 5 ? 0.66 : count === 4 ? 0.76 : count === 3 ? 0.86 : count === 2 ? 0.93 : 1;
    const amountScale = THREE.MathUtils.clamp(Math.sqrt(Math.max(1, Number(food.grams) || 100) / 100), 0.84, 1.2);
    const targetScale = portionScale * amountScale;
    group.scale.setScalar(animateIn && !reducedMotion ? targetScale * 0.56 : targetScale);
    group.userData.enterMotion = animateIn && !reducedMotion ? { start: performance.now(), baseY, targetScale } : null;
    group.rotation.y = (index * 0.48) + (kind === 'bread' ? -0.2 : 0);
    foodRoot.add(group);
    return group;
  }

  function releaseFoodMeshes() {
    foodRoot.traverse(object => {
      if (object.geometry && !sharedGeometries.has(object.geometry)) object.geometry.dispose();
      if (object.userData.disposeMaterial && object.material) object.material.dispose();
    });
    foodRoot.clear();
  }

  function refreshFood(items, animateIn = false) {
    currentItems = items;
    releaseFoodMeshes();
    if (!items.length) {
      return;
    }
    const visible = items.slice(-6);
    visible.forEach((food, index) => makePortion(food, index, visible.length, animateIn));
  }

  function updatePlate(_selected, items) {
    const meal = Array.isArray(items) ? items.filter(item => item && item.name) : [];
    const uniqueMeal = new Map();
    meal.forEach((item, index) => {
      const key = item.id == null ? item.name : String(item.id);
      const existing = uniqueMeal.get(key);
      if (existing) existing.grams = (Number(existing.grams) || 0) + (Number(item.grams) || 0);
      else uniqueMeal.set(key, { ...item, _order: index });
    });
    const normalized = [...uniqueMeal.values()].slice(-4).map((item, index) => ({ ...item, id: item.id ?? `plate-item-${index}` }));
    const signature = normalized.map(item => `${item.id}:${Number(item.grams) || 0}`).join('|');
    const animateIn = signature !== previousVisualSignature;
    refreshFood(normalized, animateIn);
    previousVisualSignature = signature;
    canvas.setAttribute('aria-label', normalized.length
      ? `معاينة ثلاثية الأبعاد للوجبة: ${normalized.map(item => item.name).join('، ')}`
      : 'طبق طعام ثلاثي الأبعاد فارغ. أضف أكلة للوجبة حتى تظهر بالصحن.');
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
    foodRoot.children.forEach(group => {
      const motion = group.userData.enterMotion;
      if (!motion) return;
      const progress = THREE.MathUtils.clamp((now - motion.start) / 520, 0, 1);
      const eased = 1 - ((1 - progress) ** 3);
      group.scale.setScalar(motion.targetScale * (0.56 + 0.44 * eased));
      group.position.y = motion.baseY + 0.15 * (1 - eased);
      if (progress >= 1) group.userData.enterMotion = null;
    });
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
  loadPhotoFoodAtlas();
  resize();
  if (window.__alarabinPlateData) updatePlate(null, window.__alarabinPlateData.items);
  else updatePlate(null, []);
  sceneCard.classList.add('three-ready');
  stage.setAttribute('aria-busy', 'false');
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  requestAnimationFrame(draw);
})();
