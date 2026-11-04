import {createSpawnVisibility} from '../city/spawn-visibility.js';
export const CROWD_LIMIT=12,CROWD_RADIUS=130,CROWD_SPAWN_MIN=16;
export function createLocalCrowd(world,life,blocked=world.blocked){
 const pool=world.people.filter(n=>n.kind==='civilian'&&!n.seated),nodes=[...(world.walkways?.nodes??[]),...world.boroughs.diagnostics.urbanDetails.placements.filter(p=>p.approach).map(p=>p.approach)],concealed=createSpawnVisibility(world);
 let next=0,initialized=false,lastSpawn=null,lastPlayer={x:0,z:0};for(const n of pool){n.activePedestrian=false;n.mesh.visible=false;}
 return {update(player,now,yaw=0,eye=null){
  lastPlayer=player;if(initialized&&now<next)return;next=now+.8;
  const near=()=>pool.filter(n=>n.activePedestrian&&Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z)<55).length;
  for(const n of pool)if(n.activePedestrian){const d=Math.hypot(n.mesh.position.x-player.x,n.mesh.position.z-player.z);if(d>285||(d>85||d>55&&near()<8)&&n.stun<=0&&concealed(player,n.mesh.position,yaw,{eye})){n.activePedestrian=false;n.mesh.visible=false;n.navigation=null;if(d>285)n.stun=0;}}
  let count=pool.filter(n=>n.activePedestrian).length,spawned=0;
  const candidates=nodes.filter(p=>{const d=Math.hypot(p.x-player.x,p.z-player.z);return initialized?d>=CROWD_SPAWN_MIN&&d<70:d>12&&d<55;});
  while(count<CROWD_LIMIT&&(!initialized||spawned<1&&near()<8)){
   const desired=initialized?28+count%3*8:16+count%4*9,angle=yaw+count*2.39996;
   candidates.sort((a,b)=>{const score=p=>Math.abs(Math.hypot(p.x-player.x,p.z-player.z)-desired)+Math.hypot(p.x-player.x+Math.sin(angle)*desired,p.z-player.z+Math.cos(angle)*desired)*.25;return score(a)-score(b);});
   const site=candidates.find(p=>!blocked(p.x,p.z,.4)&&pool.every(n=>!n.activePedestrian||Math.hypot(n.mesh.position.x-p.x,n.mesh.position.z-p.z)>7.5)&&(!initialized||concealed(player,p,yaw,{eye})));
   const n=pool.find(n=>!n.activePedestrian&&n.stun<=0);if(!site||!n)break;
   n.mesh.position.set(site.x,world.groundHeight(site.x,site.z),site.z);n.home.copy(n.mesh.position);n.mesh.visible=true;n.activePedestrian=true;n.navigation=null;n.anger=0;life.assign(n,pool.indexOf(n));
   if(initialized&&n.dailyRoute){const arrivals=nodes.filter(p=>Math.hypot(p.x-player.x,p.z-player.z)>15&&Math.hypot(p.x-player.x,p.z-player.z)<36&&!blocked(p.x,p.z,.4));const stop=arrivals[(pool.indexOf(n)*37)%arrivals.length];if(stop){n.dailyRoute.stops.splice(1,0,{...stop,kind:'walk',lookAt:stop});n.dailyRoute.index=1;n.dailyRoute.wait=0;}}
   count++;spawned++;lastSpawn={x:site.x,z:site.z,distance:Math.hypot(site.x-player.x,site.z-player.z),time:now,initial:!initialized,reason:initialized?concealed(player,site,yaw,{eye}):'initial-street-life'};
  }initialized=true;
 },get diagnostics(){const people=pool.filter(n=>n.activePedestrian);return {active:people.length,nearby:people.filter(n=>Math.hypot(n.mesh.position.x-lastPlayer.x,n.mesh.position.z-lastPlayer.z)<55).length,total:pool.length,limit:CROWD_LIMIT,radius:CROWD_RADIUS,spawnMin:CROWD_SPAWN_MIN,lastSpawn};}};
}
