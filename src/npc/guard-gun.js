export const GUARD_PISTOL=Object.freeze({range:24,windup:.45,interval:1.5,damage:8});
export function guardGun(person,{hostile=false,distance=Infinity,clear=false,stunned=false},dt){
 const gun=person.gunCombat??={windup:0,cooldown:0,sequence:0};
 if(!hostile||stunned||person.dead){gun.windup=0;gun.cooldown=0;return {shot:false,damage:0};}
 gun.cooldown=Math.max(0,gun.cooldown-dt);
 if(!clear||distance>GUARD_PISTOL.range){gun.windup=0;return {shot:false,damage:0};}
 if(gun.cooldown>0)return {shot:false,damage:0};
 gun.windup+=dt;
 if(gun.windup<GUARD_PISTOL.windup)return {shot:false,damage:0};
 gun.windup=0;gun.cooldown=GUARD_PISTOL.interval;gun.sequence++;
 return {shot:true,damage:GUARD_PISTOL.damage};
}
