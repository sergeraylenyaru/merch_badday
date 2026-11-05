import {createLeninSquare} from './lenin-square.js';
import {bridgeSurfaces} from './bridge-surfaces.js';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareCityAsset} from './city-assets.js';
import {PARK_BRIDGES,point} from './reference-layout.js';
export const PARK_RIDES=[{id:'chain-swing',u:951,v:180,w:6.8,d:6.8},{id:'pirate-ship',u:821,v:205,w:6.5,d:5},{id:'mini-coaster',u:720,v:252,w:9.5,d:7}];
export async function createParkDetails(scene,world){
 const root=new T.Group();root.name='park-rides-and-footbridges';scene.add(root);const loader=new GLTFLoader(),mixers=[],assets=[],owned=[],materials=[],base=import.meta.env.BASE_URL;
 const models=await Promise.all(PARK_RIDES.map(r=>loader.loadAsync(`${base}models/park/${r.id}.glb`)));
 for(const [i,model]of models.entries()){const ride=PARK_RIDES[i],p=point(ride.u,ride.v);model.scene.position.set(p.x,0,p.z);root.add(model.scene);assets.push(model.scene);const mixer=new T.AnimationMixer(model.scene);model.animations.forEach(c=>mixer.clipAction(c).play());mixers.push(mixer);const proxy=world.box(p.x,.15,p.z,ride.w*2,.3,ride.d*2,'#9b8d72',true);proxy.visible=false;world.parkourSurfaces.push({...p,w:ride.w,d:ride.d,y:.3});}
 const bridge=prepareCityAsset((await loader.loadAsync(`${base}models/city-pack/bridge.glb`)).scene);for(const b of PARK_BRIDGES){
  const group=new T.Group();group.position.set(b.x,.35-4.8,b.z);group.rotation.y=-b.angle;group.scale.set(b.length/10,2,b.width/2);root.add(group);for(const part of bridge.batches){const mesh=new T.Mesh(part.geometry,part.material);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);}
  for(const side of [-1,1]){const horizontal=Math.abs(Math.cos(b.angle))>.9,x=b.x-Math.sin(b.angle)*side*(b.width/2+.12),z=b.z+Math.cos(b.angle)*side*(b.width/2+.12),rail=world.box(x,.8,z,horizontal?b.length:.12,.9,horizontal?.12:b.length,'#747f7b',true);rail.visible=false;}
  const {positions,uv,rampPositions,rampUV}=bridgeSurfaces(b);
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(Array.from({length:positions.length/3},(_,i)=>i));g.computeVertexNormals();world.terrainCollider(g);owned.push(g);
  // Collision covers the entire bridge. Only the two approach ramps need a
  // visible surface: the GLB already supplies the central wooden deck.
  const rampGeometry=new T.BufferGeometry();rampGeometry.setAttribute('position',new T.Float32BufferAttribute(rampPositions,3));rampGeometry.setAttribute('uv',new T.Float32BufferAttribute(rampUV,2));rampGeometry.computeVertexNormals();owned.push(rampGeometry);
  const m=new T.MeshStandardMaterial({color:'#b9b6a4',roughness:.9,side:T.DoubleSide});materials.push(m);const ramp=new T.Mesh(rampGeometry,m);ramp.name='bridge-approach-ramps:'+b.id;root.add(ramp);
 }
 const square=await createLeninSquare(scene,world);
 return {diagnostics:{square:square.diagnostics,rides:PARK_RIDES,bridges:PARK_BRIDGES,riverBanks:2,pondIsland:false},update(dt){mixers.forEach(m=>m.update(dt));},dispose(){square.dispose();mixers.forEach(m=>m.stopAllAction());root.removeFromParent();bridge.dispose();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());for(const asset of assets)asset.traverse(n=>{if(n.isMesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});}};
}
