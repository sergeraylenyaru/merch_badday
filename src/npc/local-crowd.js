import {POPULATION_SPAWN_DISTANCE,POPULATION_RECYCLE_DISTANCE} from '../city/visibility.js';
export const CROWD_LIMIT=10, CROWD_RADIUS=POPULATION_RECYCLE_DISTANCE,CROWD_SPAWN_MIN=POPULATION_SPAWN_DISTANCE;
/** Seed residents before the first frame; recycle them only beyond the mist. */
export function createLocalCrowd(world,life,blocked=world.blocked){
 const pool=world.people.filter(n=>n.kind==='civilian'&&!n.seated),nodes=[...(world.walkways?.nodes??[]),...world.boroughs.diagnostics.urbanDetails.placements.filter(p=>p.approach).map(p=>p.approach)];
 let next=0,initialized=false,lastSpawn=null;
 for(const p of pool){p.activePedestrian=false;p.mesh.visible=false;}
 return {
  update(player,now,yaw=0){
   if(initialized&&now<next)return;next=now+.9;
   for(const p of pool)if(p.activePedestrian&&Math.hypot(p.mesh.position.x-player.x,p.mesh.position.z-player.z)>CROWD_RADIUS){p.activePedestrian=false;p.mesh.visible=false;p.navigation=null;}
   let count=pool.filter(n=>n.activePedestrian).length,spawned=0;
   const candidates=nodes.filter(p=>{const d=Math.hypot(p.x-player.x,p.z-player.z);return initialized?d>=CROWD_SPAWN_MIN&&d<145:d>18&&d<95;});
   while(count<CROWD_LIMIT&&(!initialized||spawned<1)){
    const desired=initialized?125:24+count*6,angle=yaw+count*2.39996;
    candidates.sort((a,b)=>{const score=p=>Math.abs(Math.hypot(p.x-player.x,p.z-player.z)-desired)+Math.hypot(p.x-player.x+Math.sin(angle)*desired,p.z-player.z+Math.cos(angle)*desired)*.4;return score(a)-score(b);});
    const site=candidates.find(p=>!blocked(p.x,p.z,.4)&&pool.every(n=>!n.activePedestrian||Math.hypot(n.mesh.position.x-p.x,n.mesh.position.z-p.z)>9));
    const person=pool.find(n=>!n.activePedestrian&&n.stun<=0);if(!site||!person)break;
    person.mesh.position.set(site.x,world.groundHeight(site.x,site.z),site.z);person.home.copy(person.mesh.position);person.mesh.visible=true;person.activePedestrian=true;person.navigation=null;person.anger=0;life.assign(person,pool.indexOf(person));count++;spawned++;
    lastSpawn={x:site.x,z:site.z,distance:Math.hypot(site.x-player.x,site.z-player.z),time:now,initial:!initialized};
   }
   initialized=true;
  },
  get diagnostics(){return {active:pool.filter(n=>n.activePedestrian).length,total:pool.length,limit:CROWD_LIMIT,radius:CROWD_RADIUS,spawnMin:CROWD_SPAWN_MIN,lastSpawn};},
 };
}
