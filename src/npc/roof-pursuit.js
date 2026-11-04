const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createRoofPursuit(world){
 const ladders=world.parkour.diagnostics.ladders.map(l=>({...l,nx:(l.x-l.exit.x)/1.55,nz:(l.z-l.exit.z)/1.55})),roofs=world.roofs;
 const ladderFor=id=>ladders.find(l=>l.id===id);
 const facing=l=>Math.atan2(-l.nx,-l.nz);
 function moveRoof(n,target,speed,dt,roof){
  const p=n.mesh.position,d=distance(p,target);if(d<.05)return;
  const step=Math.min(d,speed*dt),x=p.x+(target.x-p.x)*step/d,z=p.z+(target.z-p.z)*step/d;
  const inside=(x,z)=>Math.abs(x-roof.x)<roof.w-.45&&Math.abs(z-roof.z)<roof.d-.45&&!world.blockedAt(x,z,.27,null,roof.y);
  if(inside(x,z)){p.x=x;p.z=z;}else{if(inside(x,p.z))p.x=x;if(inside(p.x,z))p.z=z;}
  n.mesh.rotation.y=Math.atan2(target.x-p.x,target.z-p.z);p.y=roof.y;
 }
 return {
  update(n,player,dt,hostile){
   n.climb=null;let route=n.roofPursuit,p=n.mesh.position;
   const climbing=world.parkour.motion?.ladder;
   const targetRoof=hostile?roofs.find(r=>r.id===climbing&&player.y>world.groundHeight(player.x,player.z)+2.5||player.y>=r.y-.5&&Math.abs(player.x-r.x)<r.w+.8&&Math.abs(player.z-r.z)<r.d+.8):null;
   if(!route&&targetRoof){const l=ladderFor(targetRoof.id);if(l)route=n.roofPursuit={id:l.id,phase:'approach',travel:0};}
   if(!route)return {};
   const l=ladderFor(route.id),roof=roofs.find(r=>r.id===route.id);if(!l||!roof){n.roofPursuit=null;return {};}
   const base={x:l.x+l.nx*.35,z:l.z+l.nz*.35};
   if(route.phase==='approach'){
    if(!targetRoof||targetRoof.id!==route.id){n.roofPursuit=null;return {};}
    if(distance(p,base)>.85)return {approach:base};
    if(world.people.some(o=>o!==n&&o.roofPursuit?.id===l.id&&o.roofPursuit.phase!=='approach'&&Math.abs(o.mesh.position.y-l.y0)<2.6))return {handled:true};
    route.phase='climb';route.direction=1;p.x=base.x;p.z=base.z;p.y=l.y0+.12;
   }
   if(route.phase==='climb'){
    n.mesh.rotation.y=facing(l);const direction=route.direction;
    const occupied=world.people.some(o=>o!==n&&o.roofPursuit?.id===l.id&&distance(p,o.mesh.position)<.9&&(o.mesh.position.y-p.y)*direction>0&&Math.abs(o.mesh.position.y-p.y)<2.45);
    const step=occupied?0:direction*2.15*dt;p.y=Math.max(l.y0+.1,Math.min(l.top,p.y+step));route.travel+=Math.abs(step);
    n.climb={phase:route.travel*5.5,moving:!occupied,ladder:l.id};
    if(direction>0&&p.y>=l.top-.2){route.phase='mantle';route.elapsed=0;route.from={x:p.x,y:p.y,z:p.z};route.to=l.exit;}
    if(direction<0&&p.y<=l.y0+.11){p.y=world.groundHeight(p.x,p.z);n.roofPursuit=null;n.climb=null;}
    return {handled:true};
   }
   if(route.phase==='mantle'){
    route.elapsed+=dt;const t=Math.min(1,route.elapsed/.55),u=t*t*(3-2*t);
    p.set(route.from.x+(route.to.x-route.from.x)*u,route.from.y+(route.to.y-route.from.y)*u,route.from.z+(route.to.z-route.from.z)*u);
    n.mesh.rotation.y=facing(l);n.climb={phase:route.travel*5.5,moving:true,ladder:l.id};
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
