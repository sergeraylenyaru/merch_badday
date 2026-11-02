/** Collision injuries are nonlethal. A car crash must not teleport its driver. */
export function collisionInjury(state,speed,pedestrian=false){
  const damage=Math.min(pedestrian?30:18,Math.max(1,Math.round(Math.abs(speed)*(pedestrian?2:.7))));
  const lost=Math.min(Math.max(0,state.health-1),damage);state.health-=lost;
  state.stress=Math.min(100,state.stress+Math.min(12,Math.abs(speed)));
  return lost;
}

export function pedestrianContact(position,box,radius=.3){
  const c=Math.cos(box.heading??0),s=Math.sin(box.heading??0),dx=position.x-box.x,dz=position.z-box.z;
  let x=c*dx-s*dz,z=s*dx+c*dz;
  const px=box.w+radius+.08-Math.abs(x),pz=box.d+radius+.08-Math.abs(z);
  if(px<pz)x=Math.sign(x||1)*(box.w+radius+.08);else z=Math.sign(z||1)*(box.d+radius+.08);
  return {x:box.x+c*x+s*z,z:box.z-s*x+c*z};
}
