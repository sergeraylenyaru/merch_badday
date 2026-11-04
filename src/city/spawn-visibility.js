/** Place arrivals outside the view or fully behind real building walls. */
export function createSpawnVisibility(world){
 const walls=(world.blockers??[]).filter(b=>b.h>3.3&&b.w>.8&&b.d>.8);
 function intersects(a,b,box){let lo=.015,hi=.985;for(const [p,q,min,max]of [[a.x,b.x,box.x-box.w,box.x+box.w],[a.y,b.y,(box.y??box.h/2)-box.h/2,(box.y??box.h/2)+box.h/2],[a.z,b.z,box.z-box.d,box.z+box.d]]){const d=q-p;if(Math.abs(d)<1e-8){if(p<min||p>max)return false;}else{const u=(min-p)/d,v=(max-p)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;}}return true;}
 return (player,p,yaw=0,{height=2.2,radius=.6,eye=null}={})=>{
  const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);if(d<12)return null;
  if((-Math.sin(yaw)*dx-Math.cos(yaw)*dz)/d<.35)return 'outside-view';
  const ground=world.groundHeight?.(p.x,p.z)??0,from=eye&&Math.hypot(eye.x-player.x,eye.z-player.z)<16?eye:{x:player.x+Math.sin(yaw)*8,y:(player.y??0)+3,z:player.z+Math.cos(yaw)*8};
  const nx=-dz/d,nz=dx/d;
  for(const side of [-1,0,1]){const to={x:p.x+nx*radius*side,y:ground+height,z:p.z+nz*radius*side};if(!walls.some(b=>b.enabled!==false&&intersects(from,to,b)))return null;}
  return 'behind-building';
 };
}
