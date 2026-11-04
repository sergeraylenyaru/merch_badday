import {circleIntersectsBox,vehicleBox} from '../spatial.js';
export const PERSON_RADIUS=.27;
/** Contact follows the actual oriented car body, with a small human capsule. */
export function vehicleHitsPerson(vehicle,position){
 const p=vehicle.mesh.position;
 return position.y<p.y+(vehicle.h??2)+.15&&position.y+1.9>p.y&&circleIntersectsBox(position.x,position.z,PERSON_RADIUS,vehicleBox(vehicle));
}
export function separatePeople(people,blocked,player=null){
 const active=people.filter(n=>n.mesh.visible&&!n.seated&&n.stun<=0&&!n.climb);
 const climbing=people.filter(n=>n.mesh.visible&&n.climb);
 const move=(n,dx,dz)=>{const p=n.mesh.position;if(!blocked(p.x+dx,p.z+dz,PERSON_RADIUS,p.y)){p.x+=dx;p.z+=dz;return true;}return false;};
 for(let pass=0;pass<4;pass++)for(let i=0;i<active.length;i++){
  const a=active[i],p=a.mesh.position;
  for(const n of climbing){const q=n.mesh.position,dx=p.x-q.x,dz=p.z-q.z,d=Math.hypot(dx,dz);if(Math.abs(p.y-q.y)<1.9&&d<.58){const f=(.58-d)/Math.max(.001,d);move(a,d>.001?dx*f:.58,d>.001?dz*f:0);}}
  if(player&&Math.abs(p.y-player.y)<1.8){const dx=p.x-player.x,dz=p.z-player.z,d=Math.hypot(dx,dz);if(d<.58){const f=(.58-d)/Math.max(d,.001);move(a,d>.001?dx*f:.58,d>.001?dz*f:0);}}
  for(let j=i+1;j<active.length;j++){
   const b=active[j],q=b.mesh.position;if(Math.abs(p.y-q.y)>=1.9)continue;
   const dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz),limit=PERSON_RADIUS*2+.035;if(d>=limit)continue;
   const angle=(i+j)*2.39996,nx=d>.001?dx/d:Math.cos(angle),nz=d>.001?dz/d:Math.sin(angle),overlap=limit-d;
   const first=move(a,-nx*overlap/2,-nz*overlap/2),second=move(b,nx*overlap/2,nz*overlap/2);
   if(!first&&second)move(b,nx*overlap/2,nz*overlap/2);if(first&&!second)move(a,-nx*overlap/2,-nz*overlap/2);
  }
 }
}
