/* Timzy virtual tailoring studio: procedural 3D prototype, not measurement-accurate. */
(async function(){
 const mount=document.getElementById('timzy3d');if(!mount)return;
 const status=document.getElementById('studioStatus');
 const colors={navy:0x203451,black:0x252525,cream:0xd5c6a5,burgundy:0x713645,forest:0x345847};
 const types={senator:'Senator',kaftan:'Kaftan',agbada:'Agbada'};
 let THREE;try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');}catch(e){status.textContent='3D preview unavailable. Your catalogue remains accessible below.';return;}
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xf0ede7);
 const camera=new THREE.PerspectiveCamera(35,1,0.1,100);camera.position.set(0,2.05,7.5);camera.lookAt(0,1.65,0);
 let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});}catch(e){status.textContent='3D is unavailable on this device.';return;}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 mount.appendChild(renderer.domElement);renderer.domElement.setAttribute('aria-label','Rotatable 3D male mannequin wearing a preview outfit');
 scene.add(new THREE.HemisphereLight(0xffffff,0x8c8a84,2.4));
 const light=new THREE.DirectionalLight(0xffffff,2.2);light.position.set(3,7,5);scene.add(light);
 const root=new THREE.Group();scene.add(root);
 const prototype=new THREE.Group();root.add(prototype);
 prototype.visible=false;
 let realisticAvatar=null;
 let humanMode=true;
 const skin=new THREE.MeshStandardMaterial({color:0x926449,roughness:0.88});
 const shoes=new THREE.MeshStandardMaterial({color:0x292524,roughness:0.8});
 const cloth=new THREE.MeshStandardMaterial({color:colors.navy,roughness:0.88,side:THREE.DoubleSide});
 const add=(geo,mat,x,y,z,parent=prototype)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m};
 const cylinder=(r1,r2,h,x,y,z,mat)=>add(new THREE.CylinderGeometry(r1,r2,h,18),mat,x,y,z);
 add(new THREE.SphereGeometry(.24,20,14),skin,0,3.45,0);
 cylinder(.115,.125,.18,0,3.2,0,skin);
 for(const sign of [-1,1]){
   const leg=cylinder(.16,.13,1.18,sign*.2,.84,0,cloth);
   cylinder(.115,.12,.38,sign*.2,.23,0,skin);
   const foot=add(new THREE.BoxGeometry(.28,.16,.49),shoes,sign*.2,.09,.12);
   const arm=cylinder(.135,.11,1.14,sign*.52,2.38,0,cloth);arm.rotation.z=sign*-.13;
   add(new THREE.SphereGeometry(.105,12,10),skin,sign*.6,1.77,0);
 }
 const torso=cylinder(.39,.33,1.2,0,2.54,0,cloth);
 const skirt=cylinder(.34,.4,.6,0,1.67,0,cloth);
 const robe=cylinder(.72,.62,1.72,0,2.16,0,cloth);robe.visible=false;
 const collar=add(new THREE.TorusGeometry(.16,.022,8,24),new THREE.MeshStandardMaterial({color:0xc5b99d}),0,3.09,.335);collar.rotation.x=Math.PI/2;
 const ground=add(new THREE.CylinderGeometry(1.15,1.2,.09,48),new THREE.MeshStandardMaterial({color:0xcac5bb}),0,-.05,0,scene);
 function outfit(type){robe.visible=type==='agbada';torso.visible=type!=='agbada';skirt.visible=type!=='agbada';skirt.scale.y=type==='kaftan'?1.4:1;status.textContent=types[type]+' — illustrative 3D preview, not a tailored fit.';}
 const typeSelect=document.getElementById('studioOutfit'),colorSelect=document.getElementById('studioColor');
 typeSelect.addEventListener('change',()=>outfit(typeSelect.value));
 colorSelect.addEventListener('change',()=>{cloth.color.setHex(colors[colorSelect.value]);});
 document.querySelectorAll('[data-studio-view]').forEach(btn=>btn.addEventListener('click',()=>{root.rotation.y=Number(btn.dataset.studioView);}));
 let dragging=false,last=0;renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;last=e.clientX;renderer.domElement.setPointerCapture(e.pointerId)});
 renderer.domElement.addEventListener('pointermove',e=>{if(dragging){root.rotation.y+=(e.clientX-last)*.012;last=e.clientX;}});
 renderer.domElement.addEventListener('pointerup',()=>dragging=false);renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
 document.getElementById('studioSave').addEventListener('click',()=>{
  const selection={outfit:typeSelect.value,color:colorSelect.value,version:1};
  try{localStorage.setItem('timzy-virtual-look',JSON.stringify(selection));status.textContent='Preview preferences saved on this device. This is not an order.';}catch(e){status.textContent='Unable to save preferences on this device.';}
 });
 try{const saved=JSON.parse(localStorage.getItem('timzy-virtual-look')||'null');if(saved&&types[saved.outfit]&&colors[saved.color]){typeSelect.value=saved.outfit;colorSelect.value=saved.color;cloth.color.setHex(colors[saved.color]);}}catch(e){}
 outfit(typeSelect.value);
 // Real human preview is intentionally separate from the illustrative clothing geometry.
 // Never imply these outfit selectors fit the imported human until garment meshes are authored.
 const humanButton=document.getElementById('studioHumanMode');
 const clothingButton=document.getElementById('studioClothingMode');
 function setMode(real){
   humanMode=real&&!!realisticAvatar;
   prototype.visible=false;
   if(realisticAvatar)realisticAvatar.visible=humanMode;
   document.querySelectorAll('[data-outfit-preview]').forEach(el=>{el.hidden=true});
   humanButton.setAttribute('aria-pressed',String(humanMode));
   clothingButton.setAttribute('aria-pressed',String(!humanMode));
   status.textContent=humanMode?'Real human model preview. Timzy garment fitting is not yet available.':'Realistic Timzy garments are being prepared; geometric outfit previews are retired.';
 }
 humanButton.addEventListener('click',()=>setMode(true));
 clothingButton.addEventListener('click',()=>setMode(false));
 try{
   const {GLTFLoader}=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js');
   const loader=new GLTFLoader();
   const avatarUrl='assets/models/timzy-male-avatar.glb';
   const response=await fetch(avatarUrl,{cache:'no-store'});
   if(!response.ok)throw new Error('Avatar unavailable ('+response.status+')');
   const binary=await response.arrayBuffer();
   if(binary.byteLength<20||new DataView(binary).getUint32(0,true)!==0x46546c67)throw new Error('Invalid GLB avatar');
   const avatar=await new Promise((resolve,reject)=>loader.parse(binary,'',resolve,reject));
   realisticAvatar=avatar.scene;
   const box=new THREE.Box3().setFromObject(realisticAvatar);
   const size=box.getSize(new THREE.Vector3());
   if(!Number.isFinite(size.y)||size.y<=0)throw Error('Invalid model bounds');
   const scale=3.55/size.y;
   realisticAvatar.scale.setScalar(scale);
   const scaledBox=new THREE.Box3().setFromObject(realisticAvatar);
   const center=scaledBox.getCenter(new THREE.Vector3());
   realisticAvatar.position.x-=center.x;
   realisticAvatar.position.z-=center.z;
   realisticAvatar.position.y-=scaledBox.min.y;
   root.add(realisticAvatar);
   const garments={senator:'assets/models/timzy-senator.glb',kaftan:'assets/models/timzy-kaftan.glb',agbada:'assets/models/timzy-agbada.glb'};
   const garmentObjects=new Map();
   const garmentSelect=document.getElementById('studioOutfit');
   const colourSelect=document.getElementById('studioColor');
   const originalMaterials=new WeakMap();
   function tintGarment(group){
     const tint=colors[colourSelect.value];
     group.traverse(object=>{
       if(!object.isMesh)return;
       if(!originalMaterials.has(object))originalMaterials.set(object,object.material);
       const original=originalMaterials.get(object);
       const copyMaterial=material=>{
         const copy=material.clone();
         if(copy.color)copy.color.setHex(tint);
         return copy;
       };
       object.material=Array.isArray(original)?original.map(copyMaterial):copyMaterial(original);
     });
   }
   async function loadGarment(type){
     for(const mesh of garmentObjects.values())mesh.visible=false;
     if(garmentObjects.has(type)){
       const cached=garmentObjects.get(type);cached.visible=true;tintGarment(cached);status.textContent='3D outfit preview only; confirm fabric and fit with a tailor.';return;
     }
     const url=garments[type];
     try{
       const response=await fetch(url);
       if(!response.ok)throw Error('Garment asset unavailable');
       const buffer=await response.arrayBuffer();
       if(buffer.byteLength<20||new DataView(buffer).getUint32(0,true)!==0x46546c67)throw Error('Invalid garment GLB');
       const result=await new Promise((resolve,reject)=>loader.parse(buffer,'',resolve,reject));
       if(request!==garmentRequest)return;
       const group=result.scene;
       // Garment assets must be authored in the avatar's normalized coordinate system.
       group.scale.copy(realisticAvatar.scale);
       group.position.copy(realisticAvatar.position);
       root.add(group);garmentObjects.set(type,group);
       tintGarment(group);
       status.textContent='3D outfit preview only. Fabric appearance and tailoring fit require confirmation.';
     }catch(error){
       if(request===garmentRequest)status.textContent='Real human model loaded; the selected tailored garment is not available yet.';
     }
   }
   garmentSelect.addEventListener('change',()=>{if(humanMode)loadGarment(garmentSelect.value)});
   colourSelect.addEventListener('change',()=>{if(humanMode)loadGarment(garmentSelect.value)});
   document.querySelectorAll('[data-outfit-preview]').forEach(el=>{el.hidden=false});
   clothingButton.disabled=true;
   setMode(true);
   document.querySelectorAll('[data-outfit-preview]').forEach(el=>{el.hidden=false});
   await loadGarment(garmentSelect.value);
 }catch(e){
   setMode(false);
   clothingButton.disabled=true;
   humanButton.disabled=true;
   humanButton.title='Human model could not be loaded';
   status.textContent='Realistic 3D fitting preview is not yet available. Choose your outfit from the catalogue below while we prepare the human model and garments.';
 }
 function resize(){const w=Math.max(260,mount.clientWidth),h=Math.max(400,mount.clientHeight);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}
 resize();const observer=new ResizeObserver(resize);observer.observe(mount);
 let visible=true;const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting});io.observe(mount);
 function frame(){requestAnimationFrame(frame);if(visible)renderer.render(scene,camera)}frame();
})();