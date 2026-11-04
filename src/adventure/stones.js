import * as T from 'three';
import {RIVERS,point} from '../city/reference-layout.js';
import {pickupStone,consumeStone} from './state.js';
export function throwVelocity(from,to){const distance=Math.hypot(to.x-from.x,to.z-from.z),time=Math.max(.15,distance/18);return new T.Vector3((to.x-from.x)/time,Math.min(16,(to.y-from.y)/time+5*time),(to.z-from.z)/time);}
export function createStones(scene,world,state,callbacks){
 const root=new T.Group();root.name='collectable-and-thrown-stones';scene.add(root);const geometry=new T.IcosahedronGeometry(.15,1),material=new T.MeshStandardMaterial({color:'#a7aa96',roughness:1}),items=[],shots=[],a=state.adventure;let serial=0,lastAim=null;
 const candidates=[];
 for(const river of RIVERS)for(let i=1;i<river.length;i+=3){const p=point(...river[i]);for(const dx of [-7,7])candidates.push({x:p.x+dx,z:p.z,kind:'river'});}
 for(const f of world.yards.fences){candidates.push({x:f.x+f.nx*1.1,z:f.z+f.nz*1.1,kind:'fence'});}
 for(const p of world.boroughs.diagnostics.urbanDetails.placements.filter(p=>/trash-bin|recycling-bin/.test(p.id)))candidates.push({x:p.footprint.x+1.5,z:p.footprint.z,kind:'bin'});
 for(const r of world.roofs.filter(r=>r.kind==='residential').filter((_,i)=>i%4===0))candidates.push({x:r.x-1,z:r.z,y:r.y,kind:'roof'});
 function add(p,id,drop=null){const y=p.y??world.groundHeight(p.x,p.z);if(world.blockedAt(p.x,p.z,.2,null,y+.05)||world.water.isWater(p.x,p.z))return;const mesh=new T.Mesh(geometry,material);mesh.position.set(p.x,y+.16,p.z);mesh.rotation.set(.3,items.length*.9,.2);mesh.scale.set(1.2,.8,1);mesh.updateMatrixWorld(true);mesh.position.y+=y+.005-new T.Box3().setFromObject(mesh).min.y;root.add(mesh);items.push({id,mesh,x:p.x,z:p.z,y,kind:p.kind??'dropped',drop});}
 candidates.forEach((p,i)=>add(p,'stone:'+i));for(const p of a.stoneDrops)add(p,p.id,p);
 const sphere=new T.Sphere(),box=new T.Box3(),ray=new T.Ray(),hit=new T.Vector3();
 function rayTarget(origin,direction,max,people=true){let best=null,dist=max;ray.set(origin,direction);
  if(people)for(const n of world.people)if(n.mesh.visible&&n.stun<=0){sphere.center.copy(n.mesh.position).y+=1.05;sphere.radius=.48;if(ray.intersectSphere(sphere,hit)){const d=hit.distanceTo(origin);if(d<dist){dist=d;best={point:hit.clone(),person:n};}}}
  for(const b of world.blockers)if(b.enabled!==false){const y=b.y??b.h/2;box.min.set(b.x-b.w,y-b.h/2,b.z-b.d);box.max.set(b.x+b.w,y+b.h/2,b.z+b.d);if(ray.intersectBox(box,hit)){const d=hit.distanceTo(origin);if(d<dist){dist=d;best={point:hit.clone()};}}}
  return best;
 }
 function land(shot,p){root.remove(shot.mesh);const floor=world.parkour.floorAt(p.x,p.z,p.y+.4),drop={id:'thrown:'+state.time.toFixed(3)+':'+serial++,x:p.x,z:p.z,y:floor};a.stoneDrops.push(drop);if(a.stoneDrops.length>20){const removed=a.stoneDrops.shift(),i=items.findIndex(i=>i.id===removed.id);if(i>=0){root.remove(items[i].mesh);items.splice(i,1);}}add(drop,drop.id,drop);callbacks.changed();}
 return {
  nearest(p){if(a.stones>=5)return null;return items.filter(i=>!a.pickedStoneSites.includes(i.id)&&!i.drop?.taken&&Math.abs(p.y-i.y)<1.8&&Math.hypot(p.x-i.x,p.z-i.z)<1.6).sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0]??null;},
  pickup(item){if(pickupStone(state,item.id)){if(item.drop){item.drop.taken=true;root.remove(item.mesh);const i=items.indexOf(item);if(i>=0)items.splice(i,1);a.stoneDrops=a.stoneDrops.filter(d=>!d.taken);}callbacks.notify(`Камни: ${a.stones}/5 · 5 — выбрать, F или ЛКМ — бросить`);callbacks.changed();}else callbacks.notify('Запас камней полон · 5/5');},
  throw(camera){if(!consumeStone(state)){callbacks.notify('Нет камней. Поищите у воды, оград и мусорных баков.');return false;}const aim=new T.Raycaster();aim.setFromCamera(new T.Vector2(0,0),camera);const selected=rayTarget(aim.ray.origin,aim.ray.direction,45),target=selected?.point??aim.ray.at(32,new T.Vector3());lastAim={point:target.toArray(),person:selected?.person?world.people.indexOf(selected.person):null};const mesh=new T.Mesh(geometry,material);mesh.visible=false;root.add(mesh);shots.push({mesh,target,delay:.22,age:0,velocity:null});callbacks.changed();return true;},
  update(dt){const player=world.player.mesh.position;for(const i of items)i.mesh.visible=!a.pickedStoneSites.includes(i.id)&&!i.drop?.taken&&Math.hypot(i.x-player.x,i.z-player.z)<60;
   for(let index=shots.length-1;index>=0;index--){const s=shots[index];s.age+=dt;if(s.delay>0){s.delay-=dt;if(s.delay>0)continue;const hand=world.player.mesh.getObjectByName('PalmGripRight');s.mesh.position.copy(hand?hand.getWorldPosition(new T.Vector3()):new T.Vector3(player.x,player.y+1.4,player.z));s.velocity=throwVelocity(s.mesh.position,s.target);s.mesh.visible=true;}
    const from=s.mesh.position.clone(),next=from.clone().addScaledVector(s.velocity,dt);next.y-=5*dt*dt;s.velocity.y-=10*dt;const delta=next.clone().sub(from),length=delta.length(),contact=length?rayTarget(from,delta.normalize(),length+.12):null;
    if(contact){if(contact.person)callbacks.impact(contact.person);const p=contact.point.clone().addScaledVector(delta,-.3);land(s,p);shots.splice(index,1);continue;}
    const floor=world.parkour.floorAt(next.x,next.z,next.y+.1);if(next.y<=floor+.14||s.age>6){next.y=floor;land(s,next);shots.splice(index,1);continue;}s.mesh.position.copy(next);s.mesh.rotation.x+=dt*8;
   }
  },
  get diagnostics(){return {count:a.stones,lastAim,sites:items.map(i=>({id:i.id,x:i.x,z:i.z,y:i.y,kind:i.kind,available:!a.pickedStoneSites.includes(i.id)&&!i.drop?.taken})),flying:shots.map(s=>({position:s.mesh.position.toArray(),target:s.target.toArray(),delay:s.delay}))};},
  dispose(){root.removeFromParent();geometry.dispose();material.dispose();},
 };
}
