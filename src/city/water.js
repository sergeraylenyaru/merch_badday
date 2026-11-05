import {pixel,isReferenceWater} from './reference-layout.js';
import {WATER_LEVEL} from './terrain.js';
import {PLAYER_SHAPE} from '../spatial.js';
export const DROWNING_DAMAGE=8,SINK_SECONDS=3;
export function underwater(feetY){return feetY+PLAYER_SHAPE.eyeHeight<WATER_LEVEL;}
export function tickDrowning(state,clock,dt,submerged){
 if(!submerged||state.health<=0){clock.seconds=0;return 0;}
 clock.seconds+=Math.max(0,dt);const points=Math.floor(clock.seconds+1e-8);clock.seconds-=points;
 const damage=Math.min(state.health,points*DROWNING_DAMAGE);state.health-=damage;state.stress=Math.min(100,state.stress+points*2);return damage;
}
export function stepSinking(car,dt,bed){
 if(car.sunk)return false;
 car.waterTime=Math.min(SINK_SECONDS,(car.waterTime??0)+Math.max(0,dt));
 const t=car.waterTime/SINK_SECONDS;car.mesh.position.y=(car.waterStartY??0)+(bed-(car.waterStartY??0))*t;
 if(car.waterTime>=SINK_SECONDS){car.sunk=true;car.speed=0;car.mesh.position.y=bed;return true;}return false;
}
export function createWater(world,state){
 const clock={seconds:0};let headUnder=false;
 const isWater=(x,z)=>{const p=pixel(x,z);return isReferenceWater(p.x,p.y)&&(world.coast?.floorAt(x,z)??-Infinity)<=WATER_LEVEL;};
 function carTick(car,dt){
  if(car.sunk)return false;
  if(car.nameplate)car.nameplate.visible=false;
  if(!car.waterTime){if(!isWater(car.mesh.position.x,car.mesh.position.z))return false;car.waterStartY=car.mesh.position.y;car.waterDistance=0;}
  const p=car.mesh.position,step=Math.min(Math.max(0,4.5-(car.waterDistance??0)),Math.abs(car.speed)*dt);
  const nx=p.x+Math.sin(car.heading)*Math.sign(car.speed)*step,nz=p.z+Math.cos(car.heading)*Math.sign(car.speed)*step;
  if(step>0&&isWater(nx,nz)&&!world.vehicleBlocked(car,nx,nz,car.heading,true)){p.x=nx;p.z=nz;car.waterDistance=(car.waterDistance??0)+step;}
  car.speed*=Math.exp(-dt*1.3);return stepSinking(car,dt,world.groundHeight(p.x,p.z));
 }
 return {isWater,carTick,
  update(dt,driver){for(const car of world.vehicles)if(car!==driver&&car.waterTime>0&&!car.sunk)carTick(car,dt);headUnder=!driver&&isWater(world.player.mesh.position.x,world.player.mesh.position.z)&&underwater(world.player.mesh.position.y);return tickDrowning(state,clock,dt,headUnder);},
  get diagnostics(){return {level:WATER_LEVEL,headUnder,clock:clock.seconds,sinking:world.vehicles.filter(v=>v.waterTime>0).map(v=>({id:v.id,seconds:v.waterTime,sunk:!!v.sunk,y:v.mesh.position.y}))};},
 };
}
