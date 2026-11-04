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

const mass=v=>v.visualModel==='bus'?5500:v.visualModel==='truck'?4500:v.type===1?1900:v.visualModel==='suv'?1500:1100;
/** Arcade impulse: the faster driver keeps forward motion instead of rebounding. */
export function resolveVehicleImpact(driver,other,world){
 if(driver.impactCooldown>0)return null;const ax=Math.sin(driver.heading)*driver.speed,az=Math.cos(driver.heading)*driver.speed,bx=Math.sin(other.heading)*(other.speed??0),bz=Math.cos(other.heading)*(other.speed??0),dx=other.mesh.position.x-driver.mesh.position.x,dz=other.mesh.position.z-driver.mesh.position.z,d=Math.hypot(dx,dz)||1,nx=dx/d,nz=dz/d,closing=(ax-bx)*nx+(az-bz)*nz;if(closing<.2)return null;
 const before=driver.speed,ma=mass(driver),mb=mass(other),impulse=1.3*closing/(1/ma+1/mb),vx=ax-impulse/ma*nx,vz=az-impulse/ma*nz,projected=vx*Math.sin(driver.heading)+vz*Math.cos(driver.heading),faster=Math.abs(before)>Math.abs(other.speed??0)+.1;
 driver.speed=Math.sign(before||1)*Math.max(faster?Math.abs(before)*.45:0,Math.sign(before||1)*projected);driver.impactCooldown=1;other.impactCooldown=1;
 const motion={x:bx+impulse/mb*nx,z:bz+impulse/mb*nz,time:1.1,age:0};const speed=Math.hypot(motion.x,motion.z);if(speed>20){motion.x*=20/speed;motion.z*=20/speed;}other.impactMotion=motion;other.speed=motion.x*Math.sin(other.heading)+motion.z*Math.cos(other.heading);if(other.traffic&&!other.rival){other.crashed=true;other.trafficRoute=null;}
 const px=other.mesh.position.x+nx*.28,pz=other.mesh.position.z+nz*.28;if(!world.vehicleBlocked(other,px,pz,other.heading)){other.mesh.position.set(px,world.groundHeight(px,pz),pz);}
 const result={driver:driver.id,other:other.id,closing,faster,driverBefore:before,driverAfter:driver.speed,otherVelocity:{x:motion.x,z:motion.z}};world.lastVehicleImpact=result;return result;
}
export function stepVehicleImpacts(world,dt,controlled=null){
 for(const car of world.vehicles){const m=car.impactMotion;if(!m)continue;if(car===controlled){car.impactMotion=null;continue;}m.age+=dt;m.time-=dt;const p=car.mesh.position,nx=p.x+m.x*dt,nz=p.z+m.z*dt;
  if(!world.vehicleBlocked(car,nx,nz,car.heading)){p.set(nx,world.groundHeight(nx,nz),nz);world.props?.vehicle({x:nx,z:nz,w:car.w,d:car.l,heading:car.heading},Math.hypot(m.x,m.z),{x:m.x/Math.max(.01,Math.hypot(m.x,m.z)),z:m.z/Math.max(.01,Math.hypot(m.x,m.z))});}else{m.x*=.2;m.z*=.2;}
  const damping=Math.exp(-dt*1.8);m.x*=damping;m.z*=damping;car.speed=m.x*Math.sin(car.heading)+m.z*Math.cos(car.heading);car.mesh.rotation.z=Math.sin(Math.min(1,m.age/1.1)*Math.PI)*Math.min(.12,Math.hypot(m.x,m.z)*.009);
  if(m.time<=0||Math.hypot(m.x,m.z)<.25){car.impactMotion=null;car.speed=0;car.mesh.rotation.z=0;}
 }
}
