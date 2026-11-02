export const DEFEAT_SECONDS=3;
export function beginDefeat(state,origin,policeLevel=0){
 if(state.defeat)return state.defeat;
 state.health=0;
 state.defeat={elapsed:0,phase:'falling',policeLevel,penalty:policeLevel>0?100+Math.ceil(policeLevel)*70:150,groundY:origin.floor??origin.y??0,origin:{x:origin.x,y:origin.y??0,z:origin.z}};
 return state.defeat;
}
export function advanceDefeat(state,dt){
 const d=state.defeat;if(!d)return false;d.elapsed=Math.min(DEFEAT_SECONDS,d.elapsed+Math.max(0,dt));
 if(d.elapsed>=DEFEAT_SECONDS)d.phase='ready';return d.phase==='ready';
}
export function healAtHospital(state){
 const d=state.defeat;if(!d||d.phase!=='ready')return false;
 state.money=Math.max(0,state.money-d.penalty);state.fines+=d.penalty;state.time+=d.policeLevel?80:100;
 state.health=100;state.stress=Math.min(30,state.stress);state.wanted=0;state.wantedElapsed=0;state.defeat=null;
 state.adventure.vitals={rest:0,strain:0};state.onboarding.carTaken=true;return true;
}
