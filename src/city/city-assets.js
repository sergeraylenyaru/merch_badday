import {Box3,Matrix4} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Preserve imported PBR materials, UVs, normal/tangent data and material groups.
// The old flattening pass discarded UVs and replaced every material with white.
export function prepareCityAsset(source){
 source.updateMatrixWorld(true);
 const up=new Matrix4().makeRotationX(-Math.PI/2),bounds=new Box3(),groups=new Map(),batches=[];
 const originals=new Set(),materials=new Set(),textures=new Set();
 source.traverse(node=>{
  if(!node.isMesh)return;
  const geometry=node.geometry.clone().applyMatrix4(new Matrix4().multiplyMatrices(up,node.matrixWorld));
  if(!geometry.attributes.normal)geometry.computeVertexNormals();geometry.computeBoundingBox();bounds.union(geometry.boundingBox);originals.add(node.geometry);
  for(const m of Array.isArray(node.material)?node.material:[node.material]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}
  if(Array.isArray(node.material)){batches.push({geometry,material:node.material});return;}
  const signature=Object.entries(geometry.attributes).map(([key,a])=>`${key}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join(',');
  const key=`${node.material.uuid}/${!!geometry.index}/${signature}`;
  if(!groups.has(key))groups.set(key,{material:node.material,geometries:[]});groups.get(key).geometries.push(geometry);
 });
 for(const {material,geometries}of groups.values()){
  const geometry=geometries.length===1?geometries[0]:mergeGeometries(geometries);
  if(!geometry)throw Error('Cannot batch imported city model');
  if(geometries.length>1)geometries.forEach(g=>g.dispose());batches.push({geometry,material});
 }
 originals.forEach(g=>g.dispose());
 return {bounds,batches,dispose(){for(const b of batches)b.geometry.dispose();textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());}};
}
