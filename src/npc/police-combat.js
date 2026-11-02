export const POLICE_ATTACK = Object.freeze({duration:.35, impact:.18, interval:1.1, reach:1.85, damage:10, guardedDamage:2});
export const BATON_ATTACK=Object.freeze({duration:.64,impact:.32,interval:1.35,reach:2.25,damage:12,guardedDamage:3});
export const policeWeapon=index=>(index+1)%5===0?'baton':null;

/** One strike per animation, checked at contact rather than at the start. */
export function policeCombat(person, {hostile, distance, clear, guarding=false, inVehicle=false, stunned=false}, dt) {
  const combat=person.combat??={remaining:0,cooldown:0,struck:false,sequence:0};
  const profile=person.weapon==='baton'?BATON_ATTACK:POLICE_ATTACK;
  if(!hostile||inVehicle||stunned){combat.remaining=0;combat.cooldown=0;combat.struck=false;return {attack:0,damage:0};}
  combat.cooldown=Math.max(0,combat.cooldown-dt);
  let damage=0;
  if(combat.remaining>0){
    combat.remaining=Math.max(0,combat.remaining-dt);
    if(!combat.struck&&profile.duration-combat.remaining>=profile.impact){
      combat.struck=true;
      if(distance<=profile.reach&&clear)damage=guarding?profile.guardedDamage:profile.damage;
    }
  }else if(combat.cooldown===0&&distance<=profile.reach&&clear){
    combat.remaining=profile.duration;combat.cooldown=profile.interval;
    combat.struck=false;combat.sequence++;
  }
  return {attack:combat.remaining,damage};
}
