import {NPC_LADDER_SPEED,NPC_MANTLE_SECONDS} from '../city/traversal-speeds.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createRoofPursuit(world){
 const ladders=world.parkour.diagnostics.ladders.map(l=>({...l,nx:l.nx??(l.x-l.exit.x)/1.55,nz:l.nz??(l.z-l.exit.z)/1.55})),roofs=world.roofs;
 const ladderFor=id=>ladders.find(l=>l.id===(roofs.find(r=>r.id===id)?.scaffoldAccess??id));
 const routeRoof=id=>{const r=roofs.find(r=>r.id===id);if(!r?.scaffoldAccess)return r;const s=roofs.find(s=>s.id===r.scaffoldAccess);if(!s)return r;const minX=Math.min(r.x-r.w,s.x-s.w),maxX=Math.max(r.x+r.w,s.x+s.w),minZ=Math.min(r.z-r.d,s.z-s.d),maxZ=Math.max(r.z+r.d,s.z+s.d);return {...r,x:(minX+maxX)/2,z:(minZ+maxZ)/2,w:(maxX-minX)/2,d:(maxZ-minZ)/2};};
 const facing=l=>Math.atan2(-l.nx,-l.nz);
 function moveRoof(n,target,speed,dt,roof){
  const p=n.mesh.position,d=distance(p,target);if(d<.05)return;
  const step=Math.min(d,speed*dt),x=p.x+(target.x-p.x)*step/d,z=p.z+(target.z-p.z)*step/d;
  const inside=(x,z)=>Math.abs(x-roof.x)<roof.w-.45&&Math.abs(z-roof.z)<roof.d-.45&&(!world.parkour.floorAt||world.parkour.floorAt(x,z,roof.y+.1)>=roof.y-.15)&&!world.blockedAt(x,z,.27,null,roof.y);
  if(inside(x,z)){p.x=x;p.z=z;}else{if(inside(x,p.z))p.x=x;if(inside(p.x,z))p.z=z;}
  n.mesh.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);p.y=roof.y;
 }
 return {
  update(n,player,dt,hostile){
   n.climb=null;let route=n.roofPursuit,p=n.mesh.position;
   const support=route?.phase!=='roof'?true:world.parkour.floorAt?Math.abs(p.y-(routeRoof(route?.roofId??route?.id)?.y??p.y))<.3&&world.parkour.floorAt(p.x,p.z,p.y+.1)>=p.y-.15:roofs.find(r=>Math.abs(p.x-r.x)<r.w-.08&&Math.abs(p.z-r.z)<r.d-.08&&Math.abs(p.y-r.y)<.3);
   if(route?.phase==='roof'&&!support){n.roofPursuit=null;route=null;n.airborne={speed:0};}
   if(n.airborne){const floor=world.parkour.floorAt?.(p.x,p.z,p.y+.1)??world.groundHeight(p.x,p.z);n.airborne.speed-=18*dt;p.y=Math.max(floor,p.y+n.airborne.speed*dt);if(p.y<=floor+.01)n.airborne=null;return {handled:true};}
   const climbing=world.parkour.motion?.ladder;
   const foundRoof=hostile?roofs.find(r=>r.id===climbing&&player.y>world.groundHeight(player.x,player.z)+2.5||player.y>=r.y-.5&&Math.abs(player.x-r.x)<r.w+.8&&Math.abs(player.z-r.z)<r.d+.8):null;
   const targetRoof=foundRoof?.ownerRoofId?roofs.find(r=>r.id===foundRoof.ownerRoofId):foundRoof;
   if(!route&&targetRoof){const l=ladderFor(targetRoof.id);if(l)route=n.roofPursuit={id:l.id,roofId:targetRoof.id,phase:'approach',travel:0};}
   if(!route)return {};
   const l=ladderFor(route.id),roof=routeRoof(route.roofId??route.id);if(!l||!roof){n.roofPursuit=null;return {};}
   const base={x:l.x+l.nx*.30,z:l.z+l.nz*.30};
   if(route.phase==='approach'){
    if(!targetRoof||targetRoof.id!==(route.roofId??route.id)){n.roofPursuit=null;return {};}
    if(distance(p,base)>.85)return {approach:base};
    if(world.people.some(o=>o!==n&&o.roofPursuit?.id===l.id&&o.roofPursuit.phase!=='approach'&&Math.abs(o.mesh.position.y-l.y0)<2.6))return {handled:true};
    route.phase='climb';route.direction=1;p.x=base.x;p.z=base.z;p.y=l.y0+.12;
   }
   if(route.phase==='climb'){
    n.mesh.rotation.y=facing(l);const direction=route.direction;
    const occupied=distance(p,player)<.9&&(player.y-p.y)*direction>0&&Math.abs(player.y-p.y)<2.45||world.people.some(o=>o!==n&&o.roofPursuit?.id===l.id&&distance(p,o.mesh.position)<.9&&(o.mesh.position.y-p.y)*direction>0&&Math.abs(o.mesh.position.y-p.y)<2.45);
    const step=occupied?0:direction*NPC_LADDER_SPEED*dt;p.y=Math.max(l.y0+.1,Math.min(l.top,p.y+step));route.travel+=Math.abs(step);
    n.climb={phase:route.travel*5.5,moving:!occupied,reach:.30,ladder:l.id};
    if(direction>0&&p.y>=l.top-.2){route.phase='mantle';route.elapsed=0;route.from={x:p.x,y:p.y,z:p.z};route.to=l.exit;}
    if(direction<0&&p.y<=l.y0+.11){p.y=world.groundHeight(p.x,p.z);n.roofPursuit=null;n.climb=null;}
    return {handled:true};
   }
   if(route.phase==='mantle'){
    route.elapsed+=dt;const t=Math.min(1,route.elapsed/NPC_MANTLE_SECONDS),u=t*t*(3-2*t);
    p.set(route.from.x+(route.to.x-route.from.x)*u,route.from.y+(route.to.y-route.from.y)*u,route.from.z+(route.to.z-route.from.z)*u);
    n.mesh.rotation.y=facing(l);n.climb={phase:route.travel*5.5,moving:true,reach:.30,ladder:l.id};
    if(t===1){route.phase=route.direction>0?'roof':'climb';n.climb=null;}
    return {handled:true};
   }
   if(route.phase==='roof'){
    p.y=roof.y;
    if(targetRoof?.id===roof.id)return {onRoof:true,move:(target,speed)=>moveRoof(n,target,speed,dt,roof)};
    const ascending=world.people.some(o=>o!==n&&o.roofPursuit?.id===l.id&&o.roofPursuit.direction>0&&['climb','mantle'].includes(o.roofPursuit.phase));
    if(ascending){moveRoof(n,{x:l.exit.x-l.nx*2.2,z:l.exit.z-l.nz*2.2},2,dt,roof);return {handled:true};}
    moveRoof(n,l.exit,3,dt,roof);
    const descending=world.people.some(o=>o!==n&&o.roofPursuit?.id===l.id&&o.roofPursuit.direction<0&&Math.abs(o.mesh.position.y-l.top)<2.6);
    if(distance(p,l.exit)<.15&&!descending){route.direction=-1;route.phase='mantle';route.elapsed=0;route.from={x:p.x,y:p.y,z:p.z};route.to={...base,y:l.top-.1};}
    return {handled:true};
   }
   return {};
  },
 };
}
