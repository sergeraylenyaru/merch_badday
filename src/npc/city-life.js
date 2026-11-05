import {LOCAL_POINTS,point,districtAt} from '../city/reference-layout.js';
import {streetWaypoints} from './crossings.js';

/** Personal circuits connect actual usable destinations, not circles on lawns. */
export function createCityLife(world){
  const destinations=[];
  const add=(position,kind,lookAt=position)=>{
    if(!world.blocked(position.x,position.z,.4))destinations.push({...position,kind,lookAt,district:districtAt(position.x)});
  };
  for(const p of world.boroughs.diagnostics.urbanDetails.placements){
    if(p.approach)add(p.approach,'home',point(p.u,p.v));
    if(p.id.startsWith('bench-'))add({...point(p.u,p.v),z:point(p.u,p.v).z+1.4},'rest',point(p.u,p.v));
    if(p.id==='information-board')add({...point(p.u,p.v),z:point(p.u,p.v).z+1.6},'notice',point(p.u,p.v));
  }
  for(const site of world.food?.entrances()??[])add(site.approach,'shop',point(site.u,site.v));
  for(const [u,v] of LOCAL_POINTS)add(point(u,v+22),'shop',point(u,v));
  for(const u of [215,520,1130,1410])add(point(u+10,305),'bus',point(u,305));
  for(const seat of world.park?.diagnostics.square?.seats??[])add(seat,'rest',seat.lookAt);
  for(const node of world.walkways?.nodes??[])add(node,'walk',node.lookAt??node);
  const walkers=world.people.filter(n=>n.kind==='civilian'&&!n.seated);
  function assign(person,index){
    const p=person.mesh.position;
    // Older authored spawn points may now lie under a courtyard prop.
    if(world.blocked(p.x,p.z,.4)){
      let safe=null;
      for(let r=.75;r<=6&&!safe;r+=.75)for(let i=0;i<16&&!safe;i++){
        const x=p.x+Math.cos(i*Math.PI/8)*r,z=p.z+Math.sin(i*Math.PI/8)*r;
        if(!world.blocked(x,z,.4))safe={x,z};
      }
      if(safe){p.x=safe.x;p.z=safe.z;person.home.copy(p);}
    }
    const choices=destinations.filter(d=>d.district===districtAt(p.x)&&Math.hypot(p.x-d.x,p.z-d.z)<40)
      .sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z));
    const route=[{x:p.x,z:p.z,kind:'home',lookAt:{x:p.x,z:p.z}}];
    for(const kind of ['walk','rest','notice','shop','home','walk']){
      const matching=choices.filter(d=>d.kind===kind);if(matching.length)route.push(matching[index%Math.min(3,matching.length)]);
    }
    person.dailyRoute={stops:route,index:route.length>1?1+index%(route.length-1):0,wait:index%3,visits:0};
  }
  walkers.forEach(assign);
  function cityLife(person,dt){
    const route=person.dailyRoute;
    if(!route)return {target:person.home,speed:1.1};
    const stop=route.stops[route.index],p=person.mesh.position;
    if(route.wait>0){const rest=route.restStop??stop;route.wait=Math.max(0,route.wait-dt);return {target:null,speed:0,lookAt:rest.lookAt,social:rest.kind==='shop',activity:rest.kind==='notice'?{id:route.visits,clip:'Interact',duration:route.restDuration??4,remaining:route.wait}:null};}
    if(Math.hypot(p.x-stop.x,p.z-stop.z)<.45){
      route.visits++;route.index=(route.index+1)%route.stops.length;route.wait=2+(route.visits%4);
      // Keep the reached stop during its pause, then walk to the next one.
      route.restStop=stop;route.restDuration=route.wait;
      route.travel=null;
      return {target:null,speed:0,lookAt:stop.lookAt};
    }
    route.travel??=streetWaypoints(p,stop,world.blocked);
    while(route.travel.length>1&&Math.hypot(p.x-route.travel[0].x,p.z-route.travel[0].z)<.45)route.travel.shift();
    const target=route.travel[0]??stop;
    return {target,speed:1.1+(person.phase%3)*.12,lookAt:target,social:false,activity:null};
  }
  cityLife.assign=assign;return cityLife;
}
