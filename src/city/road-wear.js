import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ROAD_PROFILES,roadHeight} from './terrain.js';
export function planPotholes(roads=ROAD_PROFILES){
 const out=[];
 for(const [index,r]of roads.entries())for(const t of [.29,.73]){
  if(r.length<25)continue;const distance=r.length*t,lane=r.width*.24*(index%2?1:-1),x=r.start.x+r.dx*distance+r.dz*lane,z=r.start.z+r.dz*distance-r.dx*lane;
  if(r.heightAt(distance)>.06||roads.some(s=>{if(s===r)return false;const along=(x-s.start.x)*s.dx+(z-s.start.z)*s.dz;return along> -2&&along<s.length+2&&Math.abs((x-s.start.x)*s.dz-(z-s.start.z)*s.dx)<s.width/2+2;}))continue;
  out.push({x,z,size:1.25+(index%3)*.24,angle:index*1.73+t,road:index});
 }
 return out;
}
export async function createRoadWear(scene){
 const texture=await new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/road-pothole.svg`);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const material=new T.MeshStandardMaterial({map:texture,transparent:true,alphaTest:.07,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,roughness:1}),root=new T.Group(),chunks=new Map(),potholes=planPotholes();root.name='asphalt-pothole-decals';scene.add(root);
 for(const p of potholes){const g=new T.PlaneGeometry(p.size,p.size*.85,2,2);g.rotateX(-Math.PI/2);g.rotateY(p.angle);g.translate(p.x,0,p.z);const a=g.attributes.position;for(let i=0;i<a.count;i++)a.setY(i,roadHeight(a.getX(i),a.getZ(i))+.003);g.computeVertexNormals();const key=Math.floor(p.x/48)+','+Math.floor(p.z/48);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(g);}
 for(const list of chunks.values()){const g=mergeGeometries(list);list.forEach(p=>p.dispose());const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.renderOrder=1;root.add(mesh);}
 return {diagnostics:{potholes,batches:chunks.size},dispose(){root.traverse(n=>n.geometry?.dispose());root.removeFromParent();material.dispose();texture.dispose();}};
}
