import {createSpawnVisibility} from '../city/spawn-visibility.js';
import * as T from 'three';
export const policeLimit=level=>level>0?Math.min(6,Math.ceil(level)+1):0;
export const POLICE_HEALTH=100,REINFORCEMENT_INTERVAL=18;
export function damagePolice(person,amount,now){
 if(!['police','worker'].includes(person.kind)||person.dead||!(amount>0))return false;
 person.health=Math.max(0,(person.health??(person.kind==='worker'?60:POLICE_HEALTH))-amount);person.stun=.65;
 if(person.health===0){person.dead=true;person.deadAt=now;person.attack=0;person.combat=null;person.activePolice=false;person.roofPursuit=null;if(person.climb)person.airborne={speed:0};person.climb=null;}
 if(person.policeRecord)Object.assign(person.policeRecord,{health:person.health,deadAt:person.deadAt??null,position:person.dead?person.mesh.position.toArray():null});
 if(person.workerRecord)Object.assign(person.workerRecord,{health:person.health,deadAt:person.deadAt??null,position:person.dead?person.mesh.position.toArray():null});
 return true;
}
/** A fixed, reusable pool: lower wanted levels never activate the entire roster. */
export function createPoliceResponse(world,state){
 const concealed=createSpawnVisibility(world),all=world.people.filter(n=>n.kind==='police'),pool=all.filter(n=>!n.patrolPolice),patrols=all.filter(n=>n.patrolPolice),saved=state.policeResponse??={officers:{},roster:[],lastLevel:0,nextAt:0,extra:0};
 saved.officers??={};saved.roster??=[];saved.extra??=0;
 for(const n of all){const r=saved.officers[n.policeIndex]??={health:POLICE_HEALTH};n.policeRecord=r;n.health=Math.max(0,Math.min(POLICE_HEALTH,Number(r.health)));if(!Number.isFinite(n.health))n.health=POLICE_HEALTH;n.dead=n.health===0;n.deadAt=r.deadAt??null;if(n.dead&&Array.isArray(r.position))n.mesh.position.fromArray(r.position);n.activePolice=false;n.mesh.visible=false;}
 function place(n,player,yaw){
  const nodes=world.walkways?.nodes??[],candidates=nodes.filter(p=>{const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);return d>28&&d<52&&(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)<d*.45&&!world.blockedAt(p.x,p.z,.4,null,world.groundHeight(p.x,p.z))&&!all.some(o=>o!==n&&o.activePolice&&Math.hypot(o.mesh.position.x-p.x,o.mesh.position.z-p.z)<4);});
  const p=candidates.sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z))[0];if(!p)return false;
  n.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);n.mesh.rotation.z=0;n.stun=0;n.fallSpeed=0;n.home.copy(n.mesh.position);n.navigation=null;n.roofPursuit=null;n.climb=null;n.airborne=null;n.patrolRoute=null;return true;
 }
 function deploy(player,yaw){
  const n=pool.find(n=>!saved.roster.includes(n.policeIndex)&&!n.dead&&!n.incidentTarget&&!n.incidentReturning);if(!n)return false;
  if(!place(n,player,yaw))return false;saved.roster.push(n.policeIndex);n.activePolice=true;return true;
 }
 return {
  patrolIntent(n){
   const p=n.mesh.position;if(!n.patrolRoute){const nodes=(world.walkways?.nodes??[]).filter(q=>Math.hypot(q.x-n.home.x,q.z-n.home.z)>4&&Math.hypot(q.x-n.home.x,q.z-n.home.z)<20).sort((a,b)=>Math.hypot(a.x-n.home.x,a.z-n.home.z)-Math.hypot(b.x-n.home.x,b.z-n.home.z));n.patrolRoute=[n.home,...[nodes[1],nodes[6],nodes[11]].filter(Boolean)];n.patrolStep=1%n.patrolRoute.length;}
   const target=n.patrolRoute[n.patrolStep];if(Math.hypot(p.x-target.x,p.z-target.z)<.5)n.patrolStep=(n.patrolStep+1)%n.patrolRoute.length;return n.patrolRoute[n.patrolStep];
  },
  dispatchIncident(target,player,yaw=0){const n=pool.find(n=>!n.activePolice&&!n.dead&&!n.incidentTarget&&!n.incidentReturning);if(!n||!place(n,player,yaw))return null;n.incidentTarget=target;n.activePolice=true;n.mesh.visible=true;target.incidentOfficer=n.policeIndex;return n;},
  update(player,now,yaw=0){
   const level=Math.ceil(state.wanted),base=policeLimit(level),previous=saved.lastLevel;
   if(!level){saved.roster=[];saved.extra=0;saved.nextAt=now+REINFORCEMENT_INTERVAL;}
   if(level<3){saved.extra=0;saved.nextAt=now+REINFORCEMENT_INTERVAL;}
   if(level>0&&level!==previous){
    if(!previous){saved.roster=[];saved.extra=0;saved.nextAt=now+REINFORCEMENT_INTERVAL;}
    let alive=saved.roster.filter(id=>pool.some(n=>n.policeIndex===id&&!n.dead)).length;
    while(alive<base&&deploy(player,yaw))alive++;
   }
   while(level>0&&saved.roster.length<base&&deploy(player,yaw)){}
   // Corpses stay down. A later reinforcement can reuse a slot only out of sight.
   if(level>=3&&now>=saved.nextAt){
    saved.nextAt=now+REINFORCEMENT_INTERVAL;
    for(const n of pool)if(n.dead&&now-n.deadAt>45&&Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z)>65&&concealed(player,n.mesh.position,yaw)){n.dead=false;n.deadAt=null;n.health=POLICE_HEALTH;n.stun=0;Object.assign(n.policeRecord,{health:POLICE_HEALTH,deadAt:null,position:null});saved.roster=saved.roster.filter(id=>id!==n.policeIndex);}
    const alive=saved.roster.filter(id=>pool.some(n=>n.policeIndex===id&&!n.dead)).length;
    if(alive<base+2&&deploy(player,yaw))saved.extra=Math.min(2,saved.extra+1);
   }
   const active=saved.roster.filter(id=>pool.some(n=>n.policeIndex===id&&!n.dead)).slice(0,base+(level>=3?saved.extra:0));
   for(const n of pool){if(n.incidentReturning&&now>(n.incidentUntil??0)&&Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z)>35&&concealed(player,n.mesh.position,yaw))n.incidentReturning=false;n.activePolice=active.includes(n.policeIndex)||!!n.incidentTarget||!!n.incidentReturning||(n.waterFear?.until??0)>now;if(!n.activePolice&&!n.dead){n.mesh.visible=false;n.attack=0;n.combat=null;}if(n.activePolice&&!n.roofPursuit&&!n.climb&&Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z)>130&&concealed(player,n.mesh.position,yaw))place(n,player,yaw);}
   let patrolling=patrols.filter(n=>n.patrolPrimed&&!n.dead).length;
   for(const n of patrols){if(!n.dead&&!n.patrolPrimed&&patrolling<2&&place(n,player,yaw)){n.patrolPrimed=true;patrolling++;n.activePolice=true;}}
   for(const n of patrols){n.activePolice=!!n.patrolPrimed&&!n.dead;if(n.activePolice&&Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z)>110&&concealed(player,n.mesh.position,yaw))place(n,player,yaw);if(!n.activePolice&&!n.dead)n.mesh.visible=false;}
   saved.lastLevel=level;
  },
  get diagnostics(){return {patrols:patrols.filter(n=>n.activePolice&&!n.dead).length,patrolPool:patrols.length,base:policeLimit(state.wanted),active:pool.filter(n=>n.activePolice&&!n.dead).length,incidents:pool.filter(n=>n.incidentTarget).length,dead:pool.filter(n=>n.dead).length,nextReinforcement:state.wanted>=3?Math.max(0,saved.nextAt-state.time):null};},
 };
}
export function createPoliceHealthBars(scene,world){
 const geometry=new T.PlaneGeometry(1,.09),background=new T.MeshBasicMaterial({color:'#202925',depthWrite:false}),fill=new T.MeshBasicMaterial({color:'#e17862',depthWrite:false});
 const bars=world.people.filter(n=>n.kind==='police'||n.kind==='worker').map(person=>{const root=new T.Group(),bg=new T.Mesh(geometry,background),fg=new T.Mesh(geometry,fill);root.add(bg,fg);scene.add(root);bg.renderOrder=20;fg.renderOrder=21;return {person,root,fg};});
 return {update(camera){for(const {person:n,root,fg}of bars){root.visible=n.mesh.visible&&!n.dead&&n.health<(n.kind==='worker'?60:POLICE_HEALTH)&&n.mesh.position.distanceTo(world.player.mesh.position)<24;if(!root.visible)continue;root.position.copy(n.mesh.position).y+=2.65;root.quaternion.copy(camera.quaternion);const ratio=n.health/(n.kind==='worker'?60:POLICE_HEALTH);fg.scale.x=ratio;fg.position.x=(ratio-1)/2;fg.position.z=.001;}},dispose(){bars.forEach(b=>b.root.removeFromParent());geometry.dispose();background.dispose();fill.dispose();}};
}
