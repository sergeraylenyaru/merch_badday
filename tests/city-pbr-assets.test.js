import test from 'node:test';import assert from 'node:assert/strict';import{readFile,readdir}from'node:fs/promises';
const root=new URL('../public/models/city-pack/',import.meta.url);
test('all 49 imported models retain geometry, UVs, PBR maps and local shared textures',async()=>{
 const manifest=JSON.parse(await readFile(new URL('models_manifest.json',root),'utf8'));
 const files=(await readdir(root)).filter(n=>n.endsWith('.glb')).sort();assert.equal(files.length,49);assert.deepEqual(files,Object.keys(manifest).map(n=>n+'.glb').sort());
 const textures=new Set();
 for(const name of files){const bytes=await readFile(new URL(name,root)),jsonLength=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+jsonLength));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(8),bytes.length);let faces=0;
  for(const mesh of gltf.meshes)for(const primitive of mesh.primitives){assert.notEqual(primitive.attributes.TEXCOORD_0,undefined,name+' UV');faces+=(gltf.accessors[primitive.indices??primitive.attributes.POSITION].count)/3;}
  assert.equal(faces,manifest[name.slice(0,-4)].faces,name+' triangle count');
  for(const view of gltf.bufferViews)assert.ok((view.byteOffset||0)+view.byteLength<=gltf.buffers[0].byteLength,name+' geometry buffer bounds');
  for(const material of gltf.materials){assert.ok(material.pbrMetallicRoughness.baseColorTexture,name+' colour');assert.ok(material.normalTexture,name+' normals');assert.ok(material.pbrMetallicRoughness.metallicRoughnessTexture,name+' roughness');assert.match(material.extras.cityMaterialKey,/^[a-f0-9]{64}$/);}
  for(const image of gltf.images){assert.match(image.uri,/^textures\/[a-z0-9_.-]+\.png$/);assert.equal(image.bufferView,undefined);textures.add(image.uri);}
 }
 for(const path of textures){const png=await readFile(new URL(path,root));assert.equal(png.readUInt32BE(0),0x89504e47);assert.ok([256,512].includes(png.readUInt32BE(16)));}
 const report=JSON.parse(await readFile(new URL('import-report.json',root),'utf8'));assert.equal(report.texture_pixels_changed,false);assert.equal(report.geometry_changed,false);assert.ok(Object.values(report.models).reduce((n,x)=>n+x.bytes_after,0)<Object.values(report.models).reduce((n,x)=>n+x.bytes_before,0)/3);
});
