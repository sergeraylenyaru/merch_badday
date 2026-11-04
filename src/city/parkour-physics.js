import {PLAYER_SHAPE} from '../spatial.js';
export const DOUBLE_JUMP_HEIGHT=PLAYER_SHAPE.height*3;
export function jumpImpulse({grounded,heightAboveGround,used}){
 if(grounded)return {velocity:8,double:false};
 if(!used&&heightAboveGround>DOUBLE_JUMP_HEIGHT)return {velocity:9,double:true};
 return null;
}
export function verticalStep(y,velocity,floor,dt){
 const nextVelocity=velocity-20*dt,nextY=y+nextVelocity*dt;
 return nextY<=floor&&nextVelocity<=0?{y:floor,velocity:0,grounded:true}:{y:nextY,velocity:nextVelocity,grounded:false};
}
// Resolve a landing inside the edge of a prop without moving vertically or respawning.
export function recoverFooting(position,blocked){
 if(!blocked(position.x,position.z))return null;
 for(let radius=.08;radius<=1.61;radius+=.08)for(let i=0;i<16;i++){const angle=i*Math.PI/8,p={x:position.x+Math.cos(angle)*radius,z:position.z+Math.sin(angle)*radius};if(!blocked(p.x,p.z))return p;}
 return null;
}
