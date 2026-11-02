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
