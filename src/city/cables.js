import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {circleIntersectsBox} from '../spatial.js';
import {point} from './reference-layout.js';
export const ROOF_POST_HEIGHT=3.8;
export function cablePoint(wire,t){return {x:wire.a.x+(wire.b.x-wire.a.x)*t,z:wire.a.z+(wire.b.z-wire.a.z)*t,y:wire.a.y+(wire.b.y-wire.a.y)*t-Math.sin(Math.PI*t)*(wire.sag??.22)};}
export function planRoofCables(roofs,blockers=[]){
 const ordered=[...roofs].sort((a,b)=>a.id.localeCompare(b.id)),candidates=[],highway=point(0,337).z;
 function anchor(roof,other){
  const dx=other.x-roof.x,dz=other.z-roof.z,inset=1.65,t=Math.min((roof.w-inset)/Math.max(.001,Math.abs(dx)),(roof.d-inset)/Math.max(.001,Math.abs(dz)));
  return {x:roof.x+dx*t,z:roof.z+dz*t,y:roof.y+ROOF_POST_HEIGHT,roofY:roof.y,roofId:roof.id};
 }
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++){
  const r=ordered[i],s=ordered[j],a=anchor(r,s),b=anchor(s,r),length=Math.hypot(a.x-b.x,a.z-b.z);if(length<18||length>115||Math.abs(a.y-b.y)>6)continue;
  const wire={id:`roof-wire:${r.id}:${s.id}`,a,b,length,sag:Math.min(.8,length*.009),crossesHighway:(a.z-highway)*(b.z-highway)<0};
  let clear=true;for(let distance=0;distance<=length;distance+=.8){const q=cablePoint(wire,distance/length),feet=q.y-2.12;if(blockers.some(p=>p.enabled!==false&&feet<(p.y??p.h/2)+p.h/2+.1&&q.y>(p.y??p.h/2)-p.h/2&&circleIntersectsBox(q.x,q.z,.42,p))){clear=false;break;}}
  if(clear)candidates.push(wire);
 }
 candidates.sort((a,b)=>a.length-b.length||a.id.localeCompare(b.id));
 const wires=[],used=new Set();
 const add=w=>{if(!w||used.has(w.a.roofId)||used.has(w.b.roofId))return false;wires.push(w);used.add(w.a.roofId);used.add(w.b.roofId);return true;};
 for(const w of candidates.filter(w=>w.crossesHighway)){add(w);if(wires.length>=3)break;}
 for(let i=0;i<ordered.length&&wires.length<6;i+=5)add(candidates.find(w=>(w.a.roofId===ordered[i].id||w.b.roofId===ordered[i].id)&&!used.has(w.a.roofId)&&!used.has(w.b.roofId)));
 for(const w of candidates){if(wires.length>=6)break;add(w);}
 return wires;
}
export function createCables(scene,world){
 const root=new T.Group();root.name='rooftop-cables';scene.add(root);const wires=planRoofCables(world.roofs.filter(r=>!r.kind||r.kind==='residential'),world.blockers),posts=[],metal=[],owned=[];
 for(const wire of wires){
  for(const p of [wire.a,wire.b]){
   const proxy=world.box(p.x,p.roofY+ROOF_POST_HEIGHT/2,p.z,.25,ROOF_POST_HEIGHT,.25,'#776d55',true);proxy.visible=false;
   const post=new T.CylinderGeometry(.11,.17,ROOF_POST_HEIGHT+.15,7);post.translate(p.x,p.roofY+(ROOF_POST_HEIGHT+.15)/2,p.z);posts.push(post);
   const foot=new T.BoxGeometry(.65,.13,.65);foot.translate(p.x,p.roofY+.065,p.z);metal.push(foot);
   for(const dy of [0,.2]){const g=new T.BoxGeometry(.8,.07,.12);g.translate(p.x,p.y+dy,p.z);metal.push(g);}
  }
  const curve=new T.CatmullRomCurve3(Array.from({length:25},(_,n)=>{const p=cablePoint(wire,n/24);return new T.Vector3(p.x,p.y,p.z);}));metal.push(new T.TubeGeometry(curve,56,.035,4,false));
 }
 const mats=[new T.MeshStandardMaterial({color:'#786b50',roughness:.95}),new T.MeshStandardMaterial({color:'#353f3e',roughness:.8,metalness:.25})];
 for(const [i,list]of [posts,metal].entries())if(list.length){const g=mergeGeometries(list);list.forEach(g=>g.dispose());owned.push(g);const mesh=new T.Mesh(g,mats[i]);mesh.castShadow=true;root.add(mesh);}
 return {wires,get diagnostics(){return {count:wires.length,rooftop:true,highwayCrossings:wires.filter(w=>w.crossesHighway).length,wires};},dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
