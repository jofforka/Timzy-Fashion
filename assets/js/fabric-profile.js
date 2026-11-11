/* Public, merchant-supplied fabric details. No inferred specifications. */
(function(root){
 'use strict';
 const occasions={wedding:'Wedding & celebration',work:'Work & formal',festive:'Festive & cultural',graduation:'Graduation',everyday:'Everyday style'};
 const fields={composition:'Composition',weight:'Weight',feel:'Texture & feel',breathability:'Breathability',care:'Care instructions',uses:'Recommended uses'};
 function safeVideo(value){try{const u=new URL(String(value||''));return u.protocol==='https:'&&!u.username&&!u.password&&/\.(mp4|webm)$/i.test(u.pathname)?u.href:'';}catch{return '';}}
 function profile(p){const raw=p?.raw?.fabricProfile||p?.fabricProfile||{};const out={};for(const key of Object.keys(fields))out[key]=typeof raw[key]==='string'?raw[key].trim().slice(0,400):'';out.videoUrl=safeVideo(raw.videoUrl);out.occasions=Array.isArray(raw.occasions)?[...new Set(raw.occasions.filter(x=>Object.hasOwn(occasions,x)))]:[];return out;}
 function isMaterial(p){return /^(fabrics?|materials?)$/i.test(p?.category||'');}
 function liveMaterials(products){return products.filter(p=>isMaterial(p)&&!p.raw?.sampleListing&&!p.sampleListing&&['published','out of stock'].includes(String(p.status||'').toLowerCase()));}
 const api={occasions,fields,profile,safeVideo,isMaterial,liveMaterials};
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.TimzyFabric=api;
})(typeof window==='undefined'?null:window);
