import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {boxesIntersect} from '../spatial.js';
import {meetsStreet} from './reference-layout.js';
export function createServiceYards(scene,world){
 const root=new T.Group();root.name='garage-service-yards';scene.add(root);const parts=new Map(),materials=new Map(),owned=[],yards=[],fences=[];world.parkourSurfaces??=[];
 function piece(g,color,x,y,z){g.translate(x,y,z);const key=color+':'+Math.floor(x/48)+','+Math.floor(z/48);if(!parts.has(key))parts.set(key,{color,list:[]});parts.get(key).list.push(g);}
 const draw=(x,y,z,w,h,d,color)=>piece(new T.BoxGeometry(w,h,d),color,x,y,z);
 function solid(x,z,w,h,d,kind){const y0=world.groundHeight(x,z),p=world.box(x,y0+h/2,z,w,h,d,'#737366',true);p.visible=false;p.userData.blocker.climbable=true;world.parkourSurfaces.push({x,z,w:w/2,d:d/2,y:y0+h,kind});return y0;}
 for(const [i,g]of [...world.garages].sort((a,b)=>a.z-b.z||a.x-b.x).entries()){
  if(i%4||yards.length>=10)continue;
  let selected=null;
  for(const nz of [1,-1]){const z=g.z+nz*(g.d+3),shape={x:g.x,z:z+nz*.4,w:3.15,d:2.3};if(meetsStreet(shape.x,shape.z,shape.w*2,shape.d*2)||world.blockers.some(b=>b.enabled!==false&&boxesIntersect(shape,b)))continue;if(world.blocked(shape.x,shape.z,.5))continue;selected={x:g.x,z,nz};break;}
  if(!selected)continue;const {x,z,nz}=selected,props=[];
  for(const [j,dx]of [[0,-.9],[1,1.35]]){
   const px=x+dx,pz=z+nz*1.4,height=j?1.35:.85,y0=solid(px,pz,1.3,height,1.3,j?'bin':'crate'),color=j?['#527b6a','#53798b','#9b814e'][i%3]:'#9b774e';
   if(j&&i%8===0){piece(new T.CylinderGeometry(.64,.64,height,10),color,px,y0+height/2,pz);for(const dy of [.15,height-.15])piece(new T.TorusGeometry(.645,.035,4,10).rotateX(Math.PI/2),'#56605b',px,y0+dy,pz);}
   else{draw(px,y0+height/2,pz,1.3,height,1.3,color);for(const dx2 of [-.46,.46])draw(px+dx2,y0+height/2,pz,.08,height+.03,1.34,j?'#394d4b':'#564f3b');draw(px,y0+height+.03,pz,1.39,.06,1.39,j?'#3c5550':'#b2996c');}
   props.push({x:px,z:pz,y:y0+height,kind:j?'bin':'crate'});
  }
  const y0=world.groundHeight(x,z),proxy=world.box(x,y0+1.05,z,5.8,2.1,.16,'#5a635d',true);proxy.visible=false;
  const color=i%8?'#73796c':'#876e50';for(let dx=-2.8;dx<=2.81;dx+=.28)draw(x+dx,y0+1.05,z,.22,2.1,.1,color);
  for(const y of [.4,1.65])draw(x,y0+y,z,5.8,.12,.15,'#46564e');
  const fence={id:'fence:'+g.id,x,z,w:2.9,d:.1,height:2.1,y0,nz,props};fences.push(fence);yards.push({garage:g.id,...selected,props,fence:fence.id});
 }
 for(const {color,list}of parts.values()){const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());owned.push(geometry);if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.9}));const mesh=new T.Mesh(geometry,materials.get(color));mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 return {yards,fences,get diagnostics(){return {yards,fences,platforms:world.parkourSurfaces};},dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
