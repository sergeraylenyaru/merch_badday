export const EJECTION_CHANCE=.04;
/** Closest car body contact, rather than the inaccessible centre of the car. */
export function policeVehicleContact(position,vehicle){
 const p=vehicle.mesh.position,c=Math.cos(vehicle.heading),s=Math.sin(vehicle.heading),dx=position.x-p.x,dz=position.z-p.z;
 const x=dx*c-dz*s,z=dx*s+dz*c,bx=Math.max(-vehicle.w,Math.min(vehicle.w,x)),bz=Math.max(-vehicle.l,Math.min(vehicle.l,z));
 const ex=x-bx,ez=z-bz,d=Math.hypot(ex,ez),nx=d>.001?ex/d:(x<0?-1:1),nz=d>.001?ez/d:0,tx=bx+nx*.6,tz=bz+nz*.6;
 return {x:p.x+tx*c+tz*s,z:p.z-tx*s+tz*c,distance:d};
}
