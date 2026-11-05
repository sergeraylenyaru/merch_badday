import * as T from 'three';

/** A bounded pool of moving droplets; there is no beam or long cylinder. */
export function createWaterSpray(parent){
 const count=384,positions=new Float32Array(count*3),particles=Array.from({length:count},()=>({life:0,p:new T.Vector3(),v:new T.Vector3()}));
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));
 const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(16,16,1,16,16,15);gradient.addColorStop(0,'#ffffffff');gradient.addColorStop(.65,'#b5eaffdd');gradient.addColorStop(1,'#b5eaff00');ctx.fillStyle=gradient;ctx.fillRect(0,0,32,32);
 const texture=new T.CanvasTexture(canvas),material=new T.PointsMaterial({color:'#ceefff',size:.09,map:texture,transparent:true,opacity:.9,depthWrite:false,sizeAttenuation:true,toneMapped:false});
 const mesh=new T.Points(geometry,material);mesh.name='water-spray-droplets';mesh.frustumCulled=false;mesh.visible=false;parent.add(mesh);let cursor=0,shots=0;
 function update(dt){let active=0;for(let i=0;i<count;i++){const a=particles[i];a.life=Math.max(0,a.life-dt);if(a.life>0){a.v.y-=9*dt;a.p.addScaledVector(a.v,dt);positions.set(a.p.toArray(),i*3);active++;}else positions.set([0,-10000,0],i*3);}mesh.visible=active>0;geometry.attributes.position.needsUpdate=true;return active;}
 update(0);
 return {emit(from,to){const direction=to.clone().sub(from).normalize(),right=new T.Vector3().crossVectors(direction,new T.Vector3(0,1,0)).normalize(),up=new T.Vector3().crossVectors(right,direction);for(let i=0;i<64;i++){const a=particles[cursor++%count],spread=.16+Math.random()*.6;a.p.copy(from).addScaledVector(direction,Math.random()*.09);a.v.copy(direction).multiplyScalar(27+Math.random()*9).addScaledVector(right,(Math.random()-.5)*spread).addScaledVector(up,(Math.random()-.5)*spread+.6);a.life=Math.min(.48,from.distanceTo(to)/a.v.length()+.06)*(1-.15*Math.random());}shots++;update(0);},update,get diagnostics(){return {particles:particles.filter(p=>p.life>0).length,capacity:count,shots,beam:false};},dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();texture.dispose();}};
}
