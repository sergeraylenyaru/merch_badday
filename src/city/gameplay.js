export const SHIFT_DURATION = 1500;
export const wantedInterval=stress=>10+.35*Math.max(0,Math.min(100,Number(stress)||0));
export const wantedRemaining=state=>state.wanted>0?Math.max(0,wantedInterval(state.stress)-(state.wantedElapsed||0)-(state.wantedParkourCredit||0)):0;
export function rewardParkour(state){if(!(state.wanted>0)||Number.isFinite(state.lastParkourBonusAt)&&state.time-state.lastParkourBonusAt<5)return false;state.lastParkourBonusAt=state.time;state.wantedParkourCredit=(state.wantedParkourCredit||0)+10;tickWanted(state,0);return true;}
export function wantedFeedback(state){const remaining=wantedRemaining(state);return {pulse:state.wanted>0?(remaining<=10?'fast':remaining<=20?'slow':'none'):'none',parkour:Number.isFinite(state.lastParkourBonusAt)&&state.time>=state.lastParkourBonusAt&&state.time-state.lastParkourBonusAt<2};}
export function tickWanted(state,dt) {
 if(!Number.isFinite(dt)||dt<0)return;
 if(state.wanted<=0){state.wantedElapsed=0;state.wantedParkourCredit=0;return;}
 state.wanted=Math.ceil(state.wanted);
 state.wantedElapsed=(state.wantedElapsed||0)+dt;
 const interval=wantedInterval(state.stress);
 if((state.wantedParkourCredit||0)>0&&state.wantedElapsed+state.wantedParkourCredit+1e-9>=interval){state.wanted--;state.wantedElapsed=0;state.wantedParkourCredit=0;}
 while(state.wantedElapsed+1e-9>=interval && state.wanted>0){state.wanted--;state.wantedElapsed=Math.max(0,state.wantedElapsed-interval);}
 if(!state.wanted){state.wantedElapsed=0;state.wantedParkourCredit=0;}
}
export function raiseWanted(state,amount=1){
 if(!Number.isFinite(amount)||amount<=0)return 0;
 state.wantedElapsed=0;
 state.wantedParkourCredit=0;
 const calm=state.stress<50,last=state.lastWantedGainAt,now=state.time;
 if(calm&&Number.isFinite(last)&&now>=last&&now-last<5)return 0;
 const before=Math.ceil(state.wanted);
 state.wanted=Math.min(5,calm?before+1:Math.max(before+1,amount));
 if(state.wanted>before)state.lastWantedGainAt=now;
 return state.wanted-before;
}
export function freeRoam(state){state.ending=null;state.overtime=true;}
export function runningSpeed(state,walking){return walking?2.8:state.energy>0?10:state.shift.upgrades.boots?7.5:6.8;}
export const policeRunningSpeed=state=>runningSpeed(state,false)*.95;
