export const SHIFT_DURATION = 1500;
export const WANTED_INTERVAL = 20;
export function tickWanted(state,dt) {
 if(state.wanted<=0){state.wantedElapsed=0;return;}
 state.wanted=Math.ceil(state.wanted);
 state.wantedElapsed=(state.wantedElapsed||0)+dt;
 while(state.wantedElapsed>=WANTED_INTERVAL && state.wanted>0){state.wanted--;state.wantedElapsed-=WANTED_INTERVAL;}
 if(!state.wanted)state.wantedElapsed=0;
}
export function raiseWanted(state,amount=1){state.wanted=Math.min(5,Math.max(Math.ceil(state.wanted)+1,amount));state.wantedElapsed=0;}
export function freeRoam(state){state.ending=null;state.overtime=true;}
export function runningSpeed(state,walking){return walking?2.8:state.energy>0?10:state.shift.upgrades.boots?7.5:6.8;}
