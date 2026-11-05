import * as T from 'three';
import {clearSegment} from '../npc/navigation.js';

/** Body capsules and solid geometry share the same nearest-hit ray. */
export function equipmentRay(world,origin,direction,range,{people=true}={}){
 const ray=new T.Ray(origin,direction),sphere=new T.Sphere(),box=new T.Box3(),hit=new T.Vector3();
 let result={point:ray.at(range,new T.Vector3()),person:null,distance:range};
 const accept=person=>{const distance=origin.distanceTo(hit);if(distance<=result.distance+1e-7)result={point:hit.clone(),person,distance};};
 if(people)for(const n of world.people)if(n.mesh.visible&&!n.dead&&!n.insideCar&&n.stun<=0){
  for(const height of [.65,1.05,1.45]){sphere.center.copy(n.mesh.position).y+=height;sphere.radius=.34;if(ray.intersectSphere(sphere,hit))accept(n);}
 }
 for(const b of world.blockers)if(b.enabled!==false){const y=b.y??b.h/2;box.min.set(b.x-b.w,y-b.h/2,b.z-b.d);box.max.set(b.x+b.w,y+b.h/2,b.z+b.d);if(ray.intersectBox(box,hit))accept(null);}
 // A spray cannot pass through banks, roofs, or raised paths.
 for(let d=.1;d<result.distance;d+=.15){ray.at(d,hit);if(hit.y<=world.groundHeight(hit.x,hit.z)){accept(null);break;}}
 return result;
}

export function frightenWithWater(person,origin,now){
 person.waterFear={until:now+5,origin:{x:origin.x,z:origin.z}};
 person.anger=0;person.attack=0;person.guardAlert=0;person.combat=null;person.gunCombat=null;
 if(person.seated&&!person.insideCar){person.seated=false;person.seatWeight=0;person.seat=null;person.fleeUntil=now+5;person.home.copy(person.mesh.position);}
}

export function waterEscapeGoal(person,blocked){
 const p=person.mesh.position,fear=person.waterFear;
 if(fear.goal&&Math.hypot(p.x-fear.goal.x,p.z-fear.goal.z)>.5&&clearSegment(p,fear.goal,blocked,.34))return fear.goal;
 const angle=Math.atan2(p.x-fear.origin.x,p.z-fear.origin.z);
 for(const distance of [8,5,3,1.5])for(const turn of [0,Math.PI/4,-Math.PI/4,Math.PI/2,-Math.PI/2,Math.PI*.75,-Math.PI*.75]){
  const goal={x:p.x+Math.sin(angle+turn)*distance,z:p.z+Math.cos(angle+turn)*distance};
  if(clearSegment(p,goal,blocked,.34)){fear.goal=goal;return goal;}
 }
 return null;
}
