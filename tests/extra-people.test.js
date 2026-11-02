import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {Box3} from 'three';
test('five additional licensed people have real skinned meshes, animation clips and valid bounds',async()=>{
 for(const name of ['stocky','short','tall','elder','bandit']){
  const bytes=await readFile(new URL('../public/models/characters/civilian-'+name+'.glb',import.meta.url));const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length),'');
  const skins=[];gltf.scene.traverse(n=>{if(n.isSkinnedMesh)skins.push(n);});assert.ok(skins.length>0,name);assert.ok(gltf.animations.some(a=>a.name==='Walk'));assert.ok(gltf.animations.some(a=>a.name==='Punch'));assert.ok(gltf.scene.getObjectByName('RightHand'));assert.ok(gltf.scene.getObjectByName('LeftFoot'));
  const b=new Box3().setFromObject(gltf.scene);assert.equal(b.isEmpty(),false);assert.ok([...b.min.toArray(),...b.max.toArray()].every(Number.isFinite));
  if(name==='elder'){const beard=gltf.scene.getObjectByName('GreyBeard');assert.ok(beard);const bounds=new Box3().setFromObject(beard);assert.ok(bounds.max.x-bounds.min.x<.5,'beard must remain a small facial accessory');}
 }
});
