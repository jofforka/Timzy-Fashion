/* Timzy virtual tailoring studio. */
(async function () {
  const mount = document.getElementById('timzy3d');
  if (!mount) return;
  const preview = document.getElementById('senator3dPreview');
  if (preview && !preview.open) {
    await new Promise(resolve => {
      function onToggle() {
        if (!preview.open) return;
        preview.removeEventListener('toggle', onToggle);
        resolve();
      }
      preview.addEventListener('toggle', onToggle);
    });
  }

  const status = document.getElementById('studioStatus');
  const controls = {
    build: document.getElementById('studioBuild'),
    top: document.getElementById('studioOutfit'),
    neckline: document.getElementById('studioNeckline'),
    topColor: document.getElementById('studioColor'),
    trouserStyle: document.getElementById('studioTrouserStyle'),
    shoeStyle: document.getElementById('studioShoeStyle'),
    trouserColor: document.getElementById('studioTrouser'),
    shoeColor: document.getElementById('studioShoe'),
  };
  const colors = {
    navy: 0x203451, black: 0x252525, cream: 0xd5c6a5,
    burgundy: 0x713645, forest: 0x345847, brown: 0x59402d,
  };
  const buildScales = { slim: [0.89, 0.91], standard: [1, 1], broad: [1.13, 1.15] };
  const storageKey = 'timzy-virtual-look';
  const saveButton = document.getElementById('studioSave');
  const viewButtons = Array.from(document.querySelectorAll('[data-studio-view]'));
  const interactiveFields = [...Object.values(controls), ...viewButtons, saveButton];
  interactiveFields.forEach(field => { field.disabled = true; });
  mount.setAttribute('aria-busy', 'true');

  document.getElementById('studioSave').addEventListener('click', () => {
    try {
      const values = Object.fromEntries(Object.entries(controls).map(([key, field]) => [key, field.value]));
      localStorage.setItem(storageKey, JSON.stringify({ ...values, version: 2 }));
      status.textContent = 'Outfit saved on this device.';
    } catch {
      status.textContent = 'Unable to save the outfit on this device.';
    }
  });

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    for (const [key, field] of Object.entries(controls)) {
      const value = saved?.version === 1 && key === 'topColor' ? saved.color : saved?.[key];
      if (Array.from(field.options).some(option => option.value === value)) field.value = value;
    }
  } catch {
    // Preferences are optional when storage cannot be read.
  }

  const unavailable = 'The 3D preview is unavailable. You can still browse the catalogue below.';
  try {
    const [THREE, { GLTFLoader }] = await Promise.all([
      import('three'),
      import('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js'),
    ]);
    const loader = new GLTFLoader();
    async function loadModel(file) {
      const url = new URL('../models/' + file, import.meta.url);
      const response = await fetch(url);
      if (!response.ok) throw new Error('Model unavailable: ' + response.status);
      const data = await response.arrayBuffer();
      if (data.byteLength < 20) throw new Error('Incomplete GLB: ' + file);
      const header = new DataView(data);
      if (header.getUint32(0, true) !== 0x46546c67 ||
          header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== data.byteLength) {
        throw new Error('Invalid GLB header: ' + file);
      }
      return (await loader.parseAsync(data, new URL('.', url).href)).scene;
    }

    const avatar = await loadModel('timzy-male-avatar.glb?v=2');
    // The skinned meshes need current world matrices before measuring the posed avatar.
    avatar.updateMatrixWorld(true);
    // Relax the arms for the fit of the Senator sleeves.
    for (const [side, angle] of [['L', -0.24], ['R', 0.24]]) {
      const bone = avatar.getObjectByName('upperarm01' + side);
      if (!bone?.isBone) continue;
      const worldRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.25, 0, angle));
      const parentRotation = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.premultiply(parentRotation.clone().invert().multiply(worldRotation).multiply(parentRotation));
    }
    avatar.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(avatar, true);
    const size = bounds.getSize(new THREE.Vector3());
    if (!Number.isFinite(size.length()) || size.y <= 0) throw new Error('Invalid avatar bounds');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0ede7);
    const root = new THREE.Group();
    const model = new THREE.Group();
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -bounds.min.y, -center.z);
    model.add(avatar);
    root.add(model);
    scene.add(root);
    // Keep the unclothed base mesh out of view until an outfit is available.
    root.visible = false;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8c8a84, 2.4));
    const light = new THREE.DirectionalLight(0xffffff, 2.2);
    light.position.set(3, 7, 5);
    scene.add(light);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    // Limit drawing-buffer cost on high-density mobile displays.
    const maxRenderPixels = 1200000;
    let previousWidth = 0, previousHeight = 0, previousRatio = 0;
    let frame = null;
    let contextLost = false;
    renderer.domElement.setAttribute('aria-label', 'Rotatable 3D outfit preview');
    mount.appendChild(renderer.domElement);

    function render() {
      if (frame !== null || contextLost || (preview && !preview.open)) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        if (!contextLost && (!preview || preview.open)) renderer.render(scene, camera);
      });
    }
    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const halfWidth = Math.hypot(size.x * root.scale.x, size.z * root.scale.z) / 2;
      const distance = Math.max(size.y / 2, halfWidth / camera.aspect) * 1.2 / halfFov + halfWidth;
      camera.position.set(0, size.y / 2, distance);
      camera.lookAt(0, size.y / 2, 0);
      camera.updateProjectionMatrix();
      const ratio = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(maxRenderPixels / (width * height)));
      if (width !== previousWidth || height !== previousHeight || ratio !== previousRatio) {
        renderer.setPixelRatio(ratio);
        renderer.setSize(width, height, false);
        previousWidth = width;
        previousHeight = height;
        previousRatio = ratio;
      }
      render();
    }
    new ResizeObserver(resize).observe(mount);
    resize();

    document.querySelectorAll('[data-studio-view]').forEach(button => {
      button.addEventListener('click', () => {
        root.rotation.y = Number(button.dataset.studioView);
        render();
      });
    });

    const canvas = renderer.domElement;
    canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      contextLost = true;
      status.textContent = '3D graphics interrupted. Waiting for recovery…';
    });
    canvas.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      status.textContent = root.visible ? '3D wardrobe ready.' : 'Loading interactive preview…';
      resize();
    });
    let pointer = null;
    let lastX = 0;
    canvas.addEventListener('pointerdown', event => {
      if (pointer !== null || event.button !== 0) return;
      pointer = event.pointerId;
      lastX = event.clientX;
      canvas.setPointerCapture(pointer);
    });
    canvas.addEventListener('pointermove', event => {
      if (event.pointerId !== pointer || !root.visible) return;
      root.rotation.y += (event.clientX - lastX) * 0.012;
      lastX = event.clientX;
      render();
    });
    canvas.addEventListener('lostpointercapture', event => {
      if (event.pointerId === pointer) pointer = null;
    });

    const wardrobe = await loadModel('timzy-wardrobe.glb');
    const longTop = wardrobe.getObjectByName('LongTunic');
    const shortTop = wardrobe.getObjectByName('ShortTunic');
    const trousers = wardrobe.getObjectByName('Trousers');
    const shoes = wardrobe.getObjectByName('Shoes');
    const polo = wardrobe.getObjectByName('PoloShirt');
    const relaxed = wardrobe.getObjectByName('RelaxedTrousers');
    const tall = wardrobe.getObjectByName('TallBoots');
    if (!longTop || !shortTop || !trousers || !shoes || !relaxed || !tall || !polo) throw new Error('Incomplete wardrobe');

    function findMaterials(group, prefix) {
      const materials = new Set();
      group.traverse(object => {
        if (!object.isMesh) return;
        for (const material of [object.material].flat()) {
          if (material.color && material.name.startsWith(prefix)) materials.add(material);
        }
      });
      return materials;
    }
    const slots = [
      [controls.topColor, new Set([...findMaterials(longTop, 'Main fabric'), ...findMaterials(shortTop, 'Main fabric'), ...findMaterials(polo, 'Main fabric')])],
      [controls.trouserColor, new Set([...findMaterials(trousers, 'Main fabric'), ...findMaterials(relaxed, 'Main fabric')])],
      [controls.shoeColor, new Set([...findMaterials(shoes, 'Shoe upper'), ...findMaterials(tall, 'Shoe upper')])],
    ];
    if (slots.some(([, materials]) => materials.size === 0)) throw new Error('Missing wardrobe materials');

    // The original tunic has 96 vertices per horizontal ring. Work from
    // immutable source positions so repeated selection never accumulates distortion.
    const tunicBodies = [longTop, shortTop].map(group => {
      const mesh = group.getObjectByName('Tailored long tunic');
      if (!mesh?.isMesh) throw new Error('Missing tunic body');
      mesh.geometry = mesh.geometry.clone();
      const position = mesh.geometry.attributes.position;
      return {group, mesh, position, original: new Float32Array(position.array),
        placket: group.getObjectByName('Concealed front placket')};
    });
    function tailorTunic(body, neckline) {
      const {mesh, position, original, placket} = body;
      const hem = body.group === longTop ? .57 : .825;
      for (let i = 0; i < position.count; i++) {
        const x = original[i*3], y = original[i*3+1], z = original[i*3+2];
        // Ease the narrow waist and gently reduce the excessive lower flare.
        // Retain clearance at the hips and leave shoulder/sleeve joins untouched.
        const waistEase = Math.max(0, 1-Math.abs(y-1.10)/.23);
        const hemEase = 1-THREE.MathUtils.smoothstep(y,hem,.94);
        let nx = x*(1+.12*waistEase-.09*hemEase);
        let ny = y, nz = z;
        // Lower the existing standing collar into the shoulder opening for
        // round and V-neck previews; the original collar remains selectable.
        if (neckline !== 'senator' && y > 1.49) {
          const t = THREE.MathUtils.smoothstep(y,1.49,1.566);
          const front = THREE.MathUtils.smoothstep(z,.035,.115);
          const dip = neckline === 'v' ? .075*front*Math.max(0,1-Math.abs(x)/.10) : .025*front;
          ny -= t*(.022+dip);
          nx *= 1+.12*t;
        }
        // Small longitudinal folds, not a physical cloth simulation.
        const fold = hemEase * .0025 * Math.cos(Math.atan2(z-.025,x)*9);
        nz += fold * Math.sign(z-.025);
        position.setXYZ(i,nx,ny,nz);
      }
      position.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
      if (placket) placket.visible = neckline === 'senator';
    }
    function applyLook() {
      controls.neckline.disabled = controls.top.value === 'polo';
      for (const body of tunicBodies) tailorTunic(body,controls.neckline.value);
      const [width, depth] = buildScales[controls.build.value];
      root.scale.set(width, 1, depth);
      longTop.visible = controls.top.value === 'long';
      shortTop.visible = controls.top.value === 'short';
      polo.visible = controls.top.value === 'polo';
      trousers.visible = controls.trouserStyle.value === 'tapered';
      relaxed.visible = !trousers.visible;
      shoes.visible = controls.shoeStyle.value === 'ankle';
      tall.visible = !shoes.visible;
      for (const [field, materials] of slots) {
        for (const material of materials) material.color.setHex(colors[field.value]);
      }
      resize();
    }
    model.add(wardrobe);
    root.visible = true;
    for (const field of Object.values(controls)) field.addEventListener('change', applyLook);
    applyLook();
    interactiveFields.forEach(field => { field.disabled = false; });
    controls.neckline.disabled = controls.top.value === 'polo';
    status.textContent = '3D wardrobe ready.';
  } catch (error) {
    console.error('Timzy wardrobe initialization failed:', error);
    mount.replaceChildren();
    status.textContent = unavailable;
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'Retry 3D preview';
    retry.addEventListener('click', () => location.reload());
    mount.appendChild(retry);
  } finally {
    mount.setAttribute('aria-busy', 'false');
  }
})();
