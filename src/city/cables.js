import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {circleIntersectsBox} from '../spatial.js';
import {meetsStreet} from './reference-layout.js';
export function cablePoint(wire,t){return {x:wire.a.x+(wire.b.x-wire.a.x)*t,z:wire.a.z+(wire.b.z-wire.a.z)*t,y:wire.a.y+(wire.b.y-wire.a.y)*t-Math.sin(Math.PI*t)*.22};}
export function createCables(scene,world){
 const root=new T.Group();root.name='courtyard-overhead-wires';scene.add(root);const wires=[],wood=[],metal=[],owned=[];
 const roofs=[...world.roofs].sort((a,b)=>a.id.localeCompare(b.id));
 const clear=(x,z)=>!world.blockers.some(b=>b.enabled!==false&&b.h>1&&circleIntersectsBox(x,z,.5,b));
 const anchors=r=>[-1,1].flatMap(s=>[{x:r.x+s*(r.w+2),z:r.z},{x:r.x,z:r.z+s*(r.d+2)}]).filter(p=>clear(p.x,p.z)&&!meetsStreet(p.x,p.z,.8,.8)).map(p=>({...p,y:world.groundHeight(p.x,p.z)+5.8}));
 for(let i=0;i<roofs.length;i+=5){const r=roofs[i],others=roofs.filter(p=>p!==r&&Math.hypot(p.x-r.x,p.z-r.z)>18&&Math.hypot(p.x-r.x,p.z-r.z)<80).sort((a,b)=>Math.hypot(a.x-r.x,a.z-r.z)-Math.hypot(b.x-r.x,b.z-r.z));let chosen=null;
  for(const other of others){const options=anchors(r).flatMap(a=>anchors(other).map(b=>({a,b,length:Math.hypot(a.x-b.x,a.z-b.z)}))).filter(p=>p.length>16&&p.length<65).sort((a,b)=>a.length-b.length);
   chosen=options.find(p=>{for(let s=0;s<=p.length;s+=.8){const t=s/p.length,q=cablePoint(p,t);if(world.blockers.some(b=>b.enabled!==false&&b.h>q.y-2.12&&circleIntersectsBox(q.x,q.z,.4,b)))return false;}return true;});if(chosen)break;
  }
  if(!chosen)continue;const wire={id:'wire:'+r.id,...chosen};wires.push(wire);
  for(const p of [wire.a,wire.b]){const base=world.groundHeight(p.x,p.z),proxy=world.box(p.x,base+3,p.z,.28,6,.28,'#776d55',true);proxy.visible=false;const g=new T.CylinderGeometry(.14,.2,6,7);g.translate(p.x,base+3,p.z);wood.push(g);for(const dy of [0,.2]){const g=new T.BoxGeometry(.8,.08,.12);g.translate(p.x,p.y+dy,p.z);metal.push(g);}}
  const curve=new T.CatmullRomCurve3(Array.from({length:17},(_,n)=>{const p=cablePoint(wire,n/16);return new T.Vector3(p.x,p.y,p.z);}));metal.push(new T.TubeGeometry(curve,40,.035,4,false));
 }
 const mats=[new T.MeshStandardMaterial({color:'#786b50',roughness:.95}),new T.MeshStandardMaterial({color:'#353f3e',roughness:.8,metalness:.25})];
 for(const [i,list]of [wood,metal].entries())if(list.length){const g=mergeGeometries(list);list.forEach(g=>g.dispose());owned.push(g);const mesh=new T.Mesh(g,mats[i]);mesh.castShadow=true;root.add(mesh);}
 return {wires,get diagnostics(){return {count:wires.length,wires};},dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}};
}
