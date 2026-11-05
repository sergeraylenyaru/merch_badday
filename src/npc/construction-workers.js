import {NPC_LADDER_SPEED,NPC_MANTLE_SECONDS} from '../city/traversal-speeds.js';
import * as T from 'three';

export function createConstructionWorkers(world,state,site,ladders,{human}){
 const saved=state.adventure.constructionWorkers??={},workers=[],sx=site.w/24;
 for(let i=0;i<4;i++){
  const floor=i>0&&i<3?i*4.2:.2,l=ladders[Math.min(i,2)],start={x:i<3?l.x:site.x+4,z:site.z+12,y:floor};
  const n=human(start.x,start.z,'#d49a3c','worker');n.mesh.position.y=floor;n.home.copy(n.mesh.position);n.workerIndex=i;n.role=i===3?'Строитель с лопатой':'Строитель';n.weapon=i===3?'shovel':null;n.workerRecord=saved[i]??={health:60};n.health=n.workerRecord.health;n.dead=n.health<=0;n.deadAt=n.workerRecord.deadAt??null;if(n.dead&&n.workerRecord.position)n.mesh.position.fromArray(n.workerRecord.position);
  const west=site.x-21*sx,top=l.top,walk=(x,z,y)=>({x,z,y,kind:'walk'});
  n.workerRoute=i<3?[walk(l.x,site.z+13,floor),{kind:'climb',ladder:l,up:true},walk(west,site.z+13,top),walk(west,site.z-12.5,top),walk(site.x-3,site.z-12.5,top),walk(west,site.z-12.5,top),walk(west,site.z+13,top),walk(l.x,site.z+13,top),{kind:'climb',ladder:l,up:false},walk(l.x,site.z+13,floor)]:[walk(site.x+4,site.z+12,.2),walk(site.x-3,site.z+12,.2),walk(site.x-3,site.z+8,.2),walk(site.x+4,site.z+8,.2)];
  n.workerStep=0;workers.push(n);world.people.push(n);
 }
 function update(n,dt){
  const step=n.workerRoute[n.workerStep],p=n.mesh.position;
  if(step.kind==='climb'){
   const l=step.ladder;n.workerClimb??={y:p.y,mantle:0,phase:0};const c=n.workerClimb,goal=step.up?l.top:l.y0,direction=step.up?1:-1;c.phase+=dt*7;
   n.climb={kind:'ladder',phase:c.phase,moving:true,ladder:l.id};n.mesh.rotation.y=Math.atan2(-l.nx,-l.nz);
   if(!c.mantle){p.x=l.x+l.nx*.35;p.z=l.z+l.nz*.35;p.y=T.MathUtils.clamp(p.y+direction*dt*NPC_LADDER_SPEED,l.y0,l.top);if(Math.abs(p.y-goal)<.02)c.mantle=.001;}
   else{c.mantle=Math.min(1,c.mantle+dt/NPC_MANTLE_SECONDS);p.x=T.MathUtils.lerp(l.x+l.nx*.35,l.exit.x,c.mantle);p.z=T.MathUtils.lerp(l.z+l.nz*.35,l.exit.z,c.mantle);p.y=goal;if(c.mantle===1){n.climb=null;n.workerClimb=null;n.workerStep=(n.workerStep+1)%n.workerRoute.length;n.workerTrips=(n.workerTrips??0)+1;}}
   return;
  }
  n.climb=null;const dx=step.x-p.x,dz=step.z-p.z,d=Math.hypot(dx,dz);p.y=step.y;
  if(d<.13){n.workerStep=(n.workerStep+1)%n.workerRoute.length;return;}
  const speed=(n.waterFear?.until??0)>state.time?3.2:1.15,amount=Math.min(d,speed*dt),x=p.x+dx/d*amount,z=p.z+dz/d*amount;
  if(!world.blockedAt(x,z,.23,null,p.y+.03)){p.x=x;p.z=z;}
  const angle=Math.atan2(dx,dz);n.mesh.rotation.y+=Math.atan2(Math.sin(angle-n.mesh.rotation.y),Math.cos(angle-n.mesh.rotation.y))*(1-Math.exp(-dt*7));
 }
 return {workers,update,get diagnostics(){return workers.map(n=>({index:n.workerIndex,position:n.mesh.position.toArray(),step:n.workerStep,climbing:!!n.climb,trips:n.workerTrips??0,health:n.health,dead:n.dead,weapon:n.weapon}));}};
}
