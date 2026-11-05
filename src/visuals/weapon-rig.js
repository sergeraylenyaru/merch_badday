import * as T from 'three';

export const MELEE_TIMING={shovel:{quick:{duration:.76,impact:.38},strong:{duration:1.04,impact:.55}},stone:{quick:{duration:.6,impact:.22},strong:{duration:.6,impact:.22}},bat:{quick:{duration:.68,impact:.34},strong:{duration:1,impact:.53}},stick:{quick:{duration:.58,impact:.29},strong:{duration:.88,impact:.46}},baton:{quick:{duration:.64,impact:.32},strong:{duration:.64,impact:.32}}};
const smooth=t=>T.MathUtils.smoothstep(t,0,1);
const poses={
 carry:{p:[.36,1.35,.3],r:[.15,0,-2.7]},
 batCarry:{p:[.36,1.35,.3],r:[.15,0,Math.PI-2.7]},
 first:{p:[.28,1.51,.45],r:[.65,0,-.35]},
 ready:{p:[.25,1.47,.22],r:[-.7,0,-.9]},
 windup:{p:[.28,1.52,.13],r:[-1.05,0,-.95]},
 follow:{p:[-.08,1.4,.38],r:[.3,0,2.05]},
};
export function meleePose(id,remaining=0,strong=false,firstPerson=false){
 if(id==='slingshot')return {position:new T.Vector3(.18,1.4,.43),quaternion:new T.Quaternion(),phase:remaining>.25?'draw':'aim',progress:remaining>0?1-remaining/.5:0,twist:0,twoHanded:true};
 if(id==='water'||id==='pistol')return {position:new T.Vector3(.3,id==='pistol'?1.6:1.3,.4),quaternion:new T.Quaternion(),phase:'aim',progress:0,twist:0,twoHanded:false};
 const timing=MELEE_TIMING[id]?.[strong?'strong':'quick'];
 const rest=firstPerson?poses.first:['bat','shovel'].includes(id)?poses.batCarry:poses.carry;
 if(!timing||remaining<=0)return {position:new T.Vector3(...rest.p),quaternion:new T.Quaternion().setFromEuler(new T.Euler(...rest.r)),phase:'carry',progress:0,twist:0,twoHanded:false};
 const t=T.MathUtils.clamp(1-remaining/timing.duration,0,1);
 const keys=[{t:0,pose:rest,twist:0},{t:.18,pose:poses.ready,twist:.18},{t:.37,pose:poses.windup,twist:.42},{t:.65,pose:poses.follow,twist:-.48},{t:1,pose:rest,twist:0}];
 const next=keys.findIndex(k=>k.t>=t),a=keys[Math.max(0,next-1)],b=keys[Math.max(1,next)],mix=smooth((t-a.t)/(b.t-a.t));
 return {position:new T.Vector3(...a.pose.p).lerp(new T.Vector3(...b.pose.p),mix),quaternion:new T.Quaternion().setFromEuler(new T.Euler(...a.pose.r)).slerp(new T.Quaternion().setFromEuler(new T.Euler(...b.pose.r)),mix),phase:t<.37?'windup':t<.65?'strike':'recover',progress:t,twist:T.MathUtils.lerp(a.twist,b.twist,mix),twoHanded:['bat','shovel'].includes(id)&&t>=.18&&t<.75};
}

// The handle origin is the right palm. The left palm has its own grip below
// it; the animated hands reach those contacts instead of welding a bat to a wrist.
export function createWeaponRig(scene,owner,id,makeModel){
 const root=new T.Group();root.name='weapon-rig:'+id;scene.add(root);makeModel(root,id);
 const right=new T.Object3D();right.name='WeaponGripRight';root.add(right);
 const left=new T.Object3D();left.name='WeaponGripLeft';left.position.y=-.11;root.add(left);
 if(id==='slingshot')left.position.set(0,.25,-.1);
 const rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1),position=new T.Vector3();
 const viewTilt=new T.Quaternion(),pivot=new T.Vector3(0,1.5,0);
 const shoulder=owner.getObjectByName('RightArm'),side=shoulder?Math.sign(owner.worldToLocal(shoulder.getWorldPosition(new T.Vector3())).x)||1:1;
 const worldMatrix=new T.Matrix4();root.matrixAutoUpdate=false;
 const rig={root,id,right,left,twoHanded:false,phase:'carry',progress:0,twist:0,
  update({remaining=0,strong=false,firstPerson=false,pitch=0,visible=true,gait=0,speed=0,aimAt=null}={}){
   const pose=meleePose(id,remaining,strong,firstPerson);if(remaining<=0&&!firstPerson){pose.position.z+=Math.sin(gait)*Math.min(1,speed/6.8)*.045;pose.position.y+=Math.sin(gait*2)*Math.min(1,speed/6.8)*.018;}if(side<0){pose.position.x*=-1;pose.quaternion.y*=-1;pose.quaternion.z*=-1;pose.twist*=-1;}Object.assign(rig,{twoHanded:pose.twoHanded,phase:pose.phase,progress:pose.progress,twist:pose.twist});
   if(firstPerson||id==='slingshot'||id==='water'){viewTilt.setFromAxisAngle(new T.Vector3(1,0,0),T.MathUtils.clamp(pitch,-1.3,1.3));pose.position.sub(pivot).applyQuaternion(viewTilt).add(pivot);pose.quaternion.premultiply(viewTilt);}
   owner.updateWorldMatrix(true,false);owner.getWorldQuaternion(rotation);position.copy(pose.position).applyQuaternion(rotation).add(owner.getWorldPosition(new T.Vector3()));
   rotation.multiply(pose.quaternion);if(aimAt)rotation.setFromRotationMatrix(new T.Matrix4().lookAt(aimAt,position,new T.Vector3(0,1,0)));
   worldMatrix.compose(position,rotation,scale);scene.updateWorldMatrix(true,false);root.matrix.copy(scene.matrixWorld).invert().multiply(worldMatrix);root.matrix.decompose(root.position,root.quaternion,root.scale);root.visible=visible;root.updateMatrixWorld(true);
  },
  get diagnostics(){return {id,phase:rig.phase,progress:rig.progress,twoHanded:rig.twoHanded,visible:root.visible,position:root.position.toArray(),quaternion:root.quaternion.toArray(),scale:root.scale.toArray(),muzzle:root.getObjectByName('Muzzle')?.getWorldPosition(new T.Vector3()).toArray()??null};},
  dispose(){root.removeFromParent();},
 };
 return rig;
}
