export const CROWD_LIMIT=10, CROWD_RADIUS=55;

/** Reuse a fixed actor pool; only nearby residents need simulation/animation. */
export function createLocalCrowd(world,life,blocked=world.blocked){
  const pool=world.people.filter(n=>n.kind==='civilian'&&!n.seated);
  const nodes=[...(world.walkways?.nodes??[]),...world.boroughs.diagnostics.urbanDetails.placements.filter(p=>p.approach).map(p=>p.approach)];
  let next=0,initialized=false;
  for(const person of pool){person.activePedestrian=false;person.mesh.visible=false;}
  return {
    update(player,now,yaw=0){
      if(initialized&&now<next)return;next=now+.5;
      for(const person of pool)if(person.activePedestrian&&Math.hypot(person.mesh.position.x-player.x,person.mesh.position.z-player.z)>CROWD_RADIUS){person.activePedestrian=false;person.mesh.visible=false;person.navigation=null;}
      let count=pool.filter(n=>n.activePedestrian).length;
      const candidates=nodes.filter(p=>{const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);return d>8&&d<42&&(!initialized||(-Math.sin(yaw)*dx-Math.cos(yaw)*dz)<d*.35);})
        .sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z));
      let spawned=0;
      for(const p of candidates){
        if(count>=CROWD_LIMIT||(initialized&&spawned>=3))break;
        if(blocked(p.x,p.z,.4)||pool.some(n=>n.activePedestrian&&Math.hypot(n.mesh.position.x-p.x,n.mesh.position.z-p.z)<2.5))continue;
        const person=pool.find(n=>!n.activePedestrian&&n.stun<=0);if(!person)break;
        person.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);person.home.copy(person.mesh.position);
        person.mesh.visible=true;person.activePedestrian=true;person.navigation=null;person.anger=0;
        life.assign(person,pool.indexOf(person));count++;spawned++;
      }
      initialized=true;
      if(world.state?.wanted>0)for(const officer of world.people.filter(n=>n.kind==='police')){
        if(Math.hypot(officer.mesh.position.x-player.x,officer.mesh.position.z-player.z)<90)continue;
        const p=candidates.find(p=>Math.hypot(p.x-player.x,p.z-player.z)>30&&!blocked(p.x,p.z,.4));
        if(p){officer.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);officer.home.copy(officer.mesh.position);officer.navigation=null;}
      }
    },
    get diagnostics(){return {active:pool.filter(n=>n.activePedestrian).length,total:pool.length,limit:CROWD_LIMIT,radius:CROWD_RADIUS};},
  };
}
