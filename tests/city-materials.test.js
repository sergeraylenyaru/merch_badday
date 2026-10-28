import test from'node:test';import assert from'node:assert/strict';import{Group,Mesh,BoxGeometry,MeshStandardMaterial,DataTexture,Color}from'three';import{prepareCityAsset}from'../src/city/city-assets.js';
test('city batching preserves real PBR textures, UVs, normal maps and material boundaries',()=>{
 const source=new Group(),texture=new DataTexture(new Uint8Array([255,100,30,255]),1,1),normal=new DataTexture(new Uint8Array([128,128,255,255]),1,1);
 const brick=new MeshStandardMaterial({map:texture,normalMap:normal,roughness:.63,metalness:.1}),glass=new MeshStandardMaterial({color:'#88bacc',metalness:.8,roughness:.2});
 const a=new Mesh(new BoxGeometry(2,3,4),brick),b=new Mesh(new BoxGeometry(2,3,4),brick),c=new Mesh(new BoxGeometry(2,3,4),glass);b.position.x=4;c.position.x=8;source.add(a,b,c);const asset=prepareCityAsset(source);assert.equal(asset.batches.length,2);
 const material=asset.batches.find(x=>x.material===brick);assert.equal(material.material.map,texture);assert.equal(material.material.normalMap,normal);assert.equal(material.material.roughness,.63);assert.ok(material.geometry.attributes.uv);assert.ok(material.geometry.attributes.normal);assert.equal(asset.batches.find(x=>x.material===glass).material.metalness,.8);
 let disposed=0;texture.addEventListener('dispose',()=>disposed++);asset.dispose();assert.equal(disposed,1);
});

import {createCityMaterialPool} from '../src/city/shared-materials.js';
test('separate city assets share PBR GPU resources until the whole city is disposed',()=>{
 const pool=createCityMaterialPool();
 const make=()=>{const root=new Group(),map=new DataTexture(new Uint8Array([180,170,160,255]),1,1);map.userData.cityTextureKey='same-colour';const material=new MeshStandardMaterial({map});material.userData.cityMaterialKey='same-material';root.add(new Mesh(new BoxGeometry(1,1,1),material));return root;};
 const a=prepareCityAsset(make(),pool),b=prepareCityAsset(make(),pool);assert.equal(a.batches[0].material,b.batches[0].material);assert.deepEqual(pool.diagnostics,{materials:1,textures:1});let disposed=0;a.batches[0].material.map.addEventListener('dispose',()=>disposed++);a.dispose();assert.equal(disposed,0);b.dispose();assert.equal(disposed,0);pool.finishLoading();pool.dispose();assert.equal(disposed,1);
});
