export const SHIFT_DURATION = 1500;
export const wantedInterval=stress=>10+.35*Math.max(0,Math.min(100,Number(stress)||0));
export function tickWanted(state,dt) {
 if(!Number.isFinite(dt)||dt<0)return;
 if(state.wanted<=0){state.wantedElapsed=0;return;}
 state.wanted=Math.ceil(state.wanted);
 state.wantedElapsed=(state.wantedElapsed||0)+dt;
 const interval=wantedInterval(state.stress);
 while(state.wantedElapsed+1e-9>=interval && state.wanted>0){state.wanted--;state.wantedElapsed=Math.max(0,state.wantedElapsed-interval);}
 if(!state.wanted)state.wantedElapsed=0;
}
export function raiseWanted(state,amount=1){
 if(!Number.isFinite(amount)||amount<=0)return 0;
 state.wantedElapsed=0;
 const calm=state.stress<50,last=state.lastWantedGainAt,now=state.time;
 if(calm&&Number.isFinite(last)&&now>=last&&now-last<5)return 0;
 const before=Math.ceil(state.wanted);
 state.wanted=Math.min(5,calm?before+1:Math.max(before+1,amount));
 if(state.wanted>before)state.lastWantedGainAt=now;
 return state.wanted-before;
}
export function freeRoam(state){state.ending=null;state.overtime=true;}
export function runningSpeed(state,walking){return walking?2.8:state.energy>0?10:state.shift.upgrades.boots?7.5:6.8;}
