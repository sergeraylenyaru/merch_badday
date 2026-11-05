import {raiseWanted} from '../city/gameplay.js';

export const REPORT_CHANCE=Object.freeze({collision:.05,theft:.5,assault:.9});
// One roll per incident, before the existing wanted cooldown is touched.
export function reportCrime(state,amount=1,event='other',random=Math.random){
 const reported=random()<(REPORT_CHANCE[event]??1);
 const gained=reported?raiseWanted(state,amount):0;
 return {reported,gained};
}
