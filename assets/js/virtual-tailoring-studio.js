/* Timzy virtual tailoring studio. */
(async function () {
  const mount = document.getElementById('timzy3d');
  if (!mount) return;

  const status = document.getElementById('studioStatus');
  const outfit = document.getElementById('studioOutfit');
  const color = document.getElementById('studioColor');
  const garments = {
    agbada: 'timzy-agbada.glb',
  };
  const colors = { navy: 0x203451, black: 0x252525, cream: 0xd5c6a5, burgundy: 0x713645, forest: 0x345847 };
  const storageKey = 'timzy-virtual-look';

  document.getElementById('studioSave').addEventListener('click', () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ outfit: outfit.value, color: color.value, version: 1 }));
      status.textContent = 'Preview preferences saved on this device. No order was placed.';
    } catch {
      status.textContent = 'Unable to save preview preferences on this device.';
    }
  });

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Object.hasOwn(garments, saved.outfit) && Object.hasOwn(colors, saved.color)) {
      outfit.value = saved.outfit;
      color.value = saved.color;
    }
  } catch {
    // Preferences are optional when storage is unavailable or cannot be read.
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

    const avatar = await loadModel('timzy-male-avatar.glb');
    // The skinned meshes need current world matrices before measuring the posed avatar.
    avatar.updateMatrixWorld(true);
    // Relax the arms for the drape of the Agbada sleeves.
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute('aria-label', 'Rotatable 3D outfit preview');
    mount.appendChild(renderer.domElement);

    function render() {
      renderer.render(scene, camera);
    }
    function resize() {
      const width = mount.clientWidth;
      const height = mount.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const halfWidth = Math.hypot(size.x, size.z) / 2;
      const distance = Math.max(size.y / 2, halfWidth / camera.aspect) * 1.2 / halfFov + halfWidth;
      camera.position.set(0, size.y / 2, distance);
      camera.lookAt(0, size.y / 2, 0);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
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

    const outfitCache = new Map();
    const fabricName = /\b(?:fabric|cloth|garment|main|outer|senator|kaftan|agbada)\b/i;
    let selection = 0;
    let current = null;

    async function loadOutfit(type) {
      const group = await loadModel(garments[type]);
      const materials = new Set();
      group.traverse(object => {
        if (!object.isMesh) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          const name = (material.name || '').replace(/[_-]/g, ' ');
          if (material.color && fabricName.test(name) &&
              !/\b(?:trim|lining|skin|hair|footwear|shoe|button)\b/i.test(name)) {
            materials.add(material);
          }
        }
      });
      return { group, materials };
    }

    function applyColor() {
      if (!current) return;
      for (const material of current.materials) material.color.setHex(colors[color.value]);
      render();
    }

    async function showOutfit() {
      const request = ++selection;
      const type = outfit.value;
      if (current) model.remove(current.group);
      current = null;
      root.visible = false;
      render();
      status.textContent = 'Loading the selected 3D outfit…';

      if (!outfitCache.has(type)) {
        outfitCache.set(type, loadOutfit(type).catch(error => {
          outfitCache.delete(type);
          throw error;
        }));
      }

      try {
        const selected = await outfitCache.get(type);
        if (request !== selection) return;
        current = selected;
        model.add(current.group);
        root.visible = true;
        applyColor();
        status.textContent = current.materials.size
          ? '3D outfit preview. Confirm fabric and fit with a tailor.'
          : '3D outfit preview. Colour changes are unavailable for this garment.';
      } catch {
        if (request === selection) status.textContent = 'The selected 3D outfit is still being prepared.';
      }
    }

    outfit.addEventListener('change', showOutfit);
    color.addEventListener('change', applyColor);
    await showOutfit();
  } catch {
    status.textContent = unavailable;
  }
})();
