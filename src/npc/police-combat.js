export const POLICE_ATTACK = Object.freeze({duration:.35, impact:.18, interval:1.1, reach:1.85, damage:10, guardedDamage:2});

/** One strike per animation, checked at contact rather than at the start. */
export function policeCombat(person, {hostile, distance, clear, guarding=false, inVehicle=false, stunned=false}, dt) {
  const combat=person.combat??={remaining:0,cooldown:0,struck:false,sequence:0};
  if(!hostile||inVehicle||stunned){combat.remaining=0;combat.cooldown=0;combat.struck=false;return {attack:0,damage:0};}
  combat.cooldown=Math.max(0,combat.cooldown-dt);
  let damage=0;
  if(combat.remaining>0){
    combat.remaining=Math.max(0,combat.remaining-dt);
    if(!combat.struck&&POLICE_ATTACK.duration-combat.remaining>=POLICE_ATTACK.impact){
      combat.struck=true;
      if(distance<=POLICE_ATTACK.reach&&clear)damage=guarding?POLICE_ATTACK.guardedDamage:POLICE_ATTACK.damage;
    }
  }else if(combat.cooldown===0&&distance<=POLICE_ATTACK.reach&&clear){
    combat.remaining=POLICE_ATTACK.duration;combat.cooldown=POLICE_ATTACK.interval;
    combat.struck=false;combat.sequence++;
  }
  return {attack:combat.remaining,damage};
}
