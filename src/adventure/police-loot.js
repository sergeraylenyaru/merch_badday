export const BATON_DROP_CHANCE=.2;
export function rollPoliceLoot(state,person,index,random=Math.random){
 const a=state.adventure;if(person.kind!=='police'||!person.dead)return null;
 const id=`police:${index}:${person.deadAt??0}`;if(a.policeLootRolls.includes(id))return null;a.policeLootRolls.push(id);
 if(random()>=BATON_DROP_CHANCE)return null;
 const p=person.mesh.position,drop={id,weapon:'baton',x:p.x,z:p.z,y:p.y,taken:false};a.weaponDrops.push(drop);return drop;
}
