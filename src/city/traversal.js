import * as T from 'three';
import {cablePoint} from './cables.js';
export function createTraversal(scene,world,state,onComplete=()=>{}){
 const pos=world.player.mesh.position,grip=new T.Mesh(new T.BoxGeometry(.5,.06,.16),new T.MeshStandardMaterial({color:'#b7afa0',metalness:.5,roughness:.5}));grip.name='zipline-hand-carriage';grip.visible=false;scene.add(grip);
 let active=state.parkour?.traversal?structuredClone(state.parkour.traversal):null;
 if(active?.kind==='zipline'&&!world.cables.wires.some(w=>w.id===active.id))active=null;
 function candidates(){const out=[];
  for(const wire of world.cables.wires)for(const [side,p]of [wire.a,wire.b].entries()){const d=Math.hypot(pos.x-p.x,pos.z-p.z),base=p.roofY??p.y-5.8;if(d<1.9&&pos.y>=base-.12&&pos.y<base+2.2)out.push({kind:'zipline',id:wire.id,side,d});}
  for(const f of world.yards.fences){const nx=f.nx??0,nz=f.nz??1,along=(pos.x-f.x)*nz-(pos.z-f.z)*nx,d=Math.abs((pos.x-f.x)*nx+(pos.z-f.z)*nz),near=f.props.some(p=>Math.hypot(pos.x-p.x,pos.z-p.z)<1.9);if(d<3.2&&Math.abs(along)<(f.span??f.w)-.3&&near&&pos.y<f.y0+f.height+1)out.push({kind:'vault',id:f.id,d});}
  return out.sort((a,b)=>a.d-b.d);
 }
 function detach(force=false){if(!active)return false;if(active.kind==='vault'&&!force)return false;active=null;grip.visible=false;return true;}
 return {
  get active(){return !!active;},get saved(){return active?structuredClone(active):null;},
  grab(){const c=candidates()[0];if(!c)return false;
   if(c.kind==='zipline'){const w=world.cables.wires.find(w=>w.id===c.id);active={...c,phase:'reach',elapsed:0,progress:c.side?1-.6/w.length:.6/w.length,from:pos.toArray()};world.player.mesh.rotation.y=Math.atan2((w.b.x-w.a.x)*(c.side?-1:1),(w.b.z-w.a.z)*(c.side?-1:1));}
   else {const f=world.yards.fences.find(f=>f.id===c.id),nx=f.nx??0,nz=f.nz??1,span=f.span??f.w,side=Math.sign((pos.x-f.x)*nx+(pos.z-f.z)*nz)||1,along=T.MathUtils.clamp((pos.x-f.x)*nz-(pos.z-f.z)*nx,-span+.7,span-.7),to={x:f.x+nz*along-nx*side*3,z:f.z-nx*along-nz*side*3};if(world.blockedAt(to.x,to.z,.35,null,world.groundHeight(to.x,to.z)))return false;active={...c,phase:'vault',elapsed:0,from:pos.toArray(),to:[to.x,world.groundHeight(to.x,to.z),to.z],top:f.y0+f.height+.35};}
   return true;
  },detach,
  advance(dt){if(!active)return null;const a=active;a.elapsed+=dt;
   if(a.kind==='vault'){const t=Math.min(1,a.elapsed/.95),from=new T.Vector3().fromArray(a.from),to=new T.Vector3().fromArray(a.to),mix=T.MathUtils.smoothstep(t,0,1);pos.lerpVectors(from,to,mix);pos.y+=(a.top-(from.y+to.y)/2)*Math.sin(Math.PI*t);world.player.mesh.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);if(t===1){pos.copy(to);active=null;onComplete('vault');return {grounded:true};}return {grounded:false};}
   const w=world.cables.wires.find(w=>w.id===a.id),start=cablePoint(w,a.progress);
   if(a.phase==='reach'){const t=Math.min(1,a.elapsed/1.15),from=new T.Vector3().fromArray(a.from),to=new T.Vector3(start.x,start.y-2.12,start.z);pos.lerpVectors(from,to,T.MathUtils.smoothstep(t,0,1));if(t===1){a.phase='ride';a.elapsed=0;}}
   else{a.progress=T.MathUtils.clamp(a.progress+(a.side?-1:1)*dt*6.5/w.length,.6/w.length,1-.6/w.length);const p=cablePoint(w,a.progress);pos.set(p.x,p.y-2.12,p.z);grip.visible=true;grip.position.set(p.x,p.y-.02,p.z);if((a.side&&a.progress<=.6/w.length)||(!a.side&&a.progress>=1-.6/w.length)){active=null;grip.visible=false;onComplete('zipline');}}
   world.player.mesh.rotation.y=Math.atan2((w.b.x-w.a.x)*(a.side?-1:1),(w.b.z-w.a.z)*(a.side?-1:1));grip.rotation.y=world.player.mesh.rotation.y;return {grounded:false};
  },
  context(){if(active)return active.kind==='zipline'?'По проводу · E — отпустить':'Перелезаем через забор';const c=candidates()[0];return c?c.kind==='zipline'?'Space + E · Зацепиться за провод':'Space + E · Перелезть через забор с ящика или бака':'';},
  get motion(){return active?{kind:active.kind==='zipline'?(active.phase==='reach'?'pole':'zipline'):'vault',phase:active.elapsed*7,progress:active.kind==='vault'?Math.min(1,active.elapsed/.95):active.progress}:null;},
  dispose(){grip.removeFromParent();grip.geometry.dispose();grip.material.dispose();},
 };
}
