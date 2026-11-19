#!/usr/bin/env node
// Run: node scripts/check-3d-assets.cjs
// Non-zero exit when any required binary model is missing or malformed.
const fs=require('node:fs');
const path=require('node:path');
const files=['timzy-male-avatar.glb','timzy-senator.glb','timzy-kaftan.glb','timzy-agbada.glb'];
let errors=0;
for(const name of files){
 const file=path.join(__dirname,'..','assets','models',name);
 if(!fs.existsSync(file)){console.error('MISSING '+file);errors++;continue;}
 const data=fs.readFileSync(file);
 if(data.length<20||data.toString('ascii',0,4)!=='glTF'||data.readUInt32LE(4)!==2||data.readUInt32LE(8)!==data.length){
   console.error('INVALID GLB header/length '+file);errors++;continue;
 }
 const chunkLength=data.readUInt32LE(12);
 if(data.toString('ascii',16,20)!=='JSON'||chunkLength>data.length-20){
   console.error('INVALID GLB JSON chunk '+file);errors++;continue;
 }
 try{
   const gltf=JSON.parse(data.toString('utf8',20,20+chunkLength));
   if(!Array.isArray(gltf.meshes)||!gltf.meshes.length||!Array.isArray(gltf.scenes)||!gltf.scenes.length)throw Error('no mesh/scene');
   console.log('OK '+name+' ('+(data.length/1048576).toFixed(2)+' MB, '+gltf.meshes.length+' meshes)');
 }catch(e){console.error('INVALID GLB scene '+file+': '+e.message);errors++;}
}
if(errors){console.error(errors+' asset check(s) failed');process.exitCode=1;}
