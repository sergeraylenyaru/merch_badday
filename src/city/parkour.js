import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {PLAYER_SHAPE,circleIntersectsBox,vehicleBox} from '../spatial.js';
import {clearSegment} from '../npc/navigation.js';
import {jumpImpulse,verticalStep,DOUBLE_JUMP_HEIGHT} from './parkour-physics.js';
import {createTraversal} from './traversal.js';

export function createParkour(scene,world,state){
 const root=new T.Group();root.name='roof-ladders';scene.add(root);
 const roofs=[...world.roofs].sort((a,b)=>a.id.localeCompare(b.id)),ladders=[],chunks=new Map(),owned=[];
 const metal=new T.MeshStandardMaterial({color:'#8a8372',roughness:.72,metalness:.35});
 function box(x,y,z,w,h,d,angle,key){const g=new T.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(g);}
 for(const roof of roofs){
  const wall=roof.wallBounds??roof;
  const options=[];
  for(const side of [-1,1])for(const along of [0,-.45,.45]){
   options.push({x:wall.x+along*wall.w,z:wall.z+side*(wall.d+.08),nx:0,nz:side});
   options.push({x:wall.x+side*(wall.w+.08),z:wall.z+along*wall.d,nx:side,nz:0});
  }
  // Vehicles can move between saves; ladder anchors belong to the building.
  const baseFree=(x,z)=>!world.blockers.some(b=>b.h>.04&&circleIntersectsBox(x,z,.36,b));
  const base=roof.ladder??options.find(p=>baseFree(p.x+p.nx*.5,p.z+p.nz*.5)&&baseFree(p.x+p.nx*1.4,p.z+p.nz*1.4));
  if(!base)continue;const y0=world.groundHeight(base.x,base.z),height=roof.y-y0;if(height<1.8)continue;
  const angle=Math.atan2(base.nx,base.nz),tx=base.nz,tz=-base.nx,key=Math.floor(base.x/48)+','+Math.floor(base.z/48);
  const ladder={id:roof.id,...base,y0,top:roof.y,angle,roof,exit:base.exit??{x:base.x-base.nx*1.55,z:base.z-base.nz*1.55,y:roof.y}};ladders.push(ladder);
  for(const side of [-1,1])box(base.x+tx*.43*side,y0+height/2+.8,base.z+tz*.43*side,.065,height+1.6,.09,angle,key);
  for(let y=.28;y<height+1.53;y+=.32)box(base.x,y0+y,base.z,.85,.055,.09,angle,key);
 }
 for(const list of chunks.values()){const geometry=mergeGeometries(list);list.forEach(g=>g.dispose());owned.push(geometry);const mesh=new T.Mesh(geometry,metal);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 const pos=world.player.mesh.position;let grounded=true,extraUsed=state.parkour?.extraUsed===true,airKick=0,climb=null,climbDistance=0;
 const traversal=createTraversal(scene,world,state);
 const stored=state.parkour?.feetY;if(Number.isFinite(stored)&&stored>=world.groundHeight(pos.x,pos.z))pos.y=stored;
 const savedLadder=ladders.find(l=>l.id===state.parkour?.ladder);if(savedLadder){climb={ladder:savedLadder,mantle:null};pos.x=savedLadder.x+savedLadder.nx*.35;pos.z=savedLadder.z+savedLadder.nz*.35;grounded=false;}
 function floorAt(x,z,ceiling=pos.y+.12){
  let floor=world.groundHeight(x,z);
  for(const b of world.blockers)if(b.enabled!==false&&b.h>2.5&&b.w>2&&b.d>2){const top=(b.y??b.h/2)+b.h/2;if(top<=ceiling+.03&&Math.abs(x-b.x)<b.w-.08&&Math.abs(z-b.z)<b.d-.08)floor=Math.max(floor,top);}
  for(const roof of roofs)if(roof.y<=ceiling+.03&&Math.abs(x-roof.x)<roof.w-.08&&Math.abs(z-roof.z)<roof.d-.08)floor=Math.max(floor,roof.y);
  for(const s of world.shopRoofs??[])if(s.y<=ceiling+.03&&Math.abs(x-s.x)<s.w&&Math.abs(z-s.z)<s.d)floor=Math.max(floor,s.y);
  for(const s of [...world.garages,...world.parkourSurfaces])if(s.y<=ceiling+.03&&Math.abs(x-s.x)<s.w-.03&&Math.abs(z-s.z)<s.d-.03)floor=Math.max(floor,s.y);
  for(const v of world.vehicles)if(v.mesh.visible&&!(v.police&&state.wanted<3)){const top=v.mesh.position.y+v.h;if(top<=ceiling+.03&&circleIntersectsBox(x,z,.01,vehicleBox(v)))floor=Math.max(floor,top);}
  return floor;
 }
 grounded=Math.abs(pos.y-floorAt(pos.x,pos.z))<.1;
 function saveHeight(){state.parkour={feetY:pos.y,ladder:climb?.ladder.id??null,traversal:traversal.saved,extraUsed};}
 function nearest(position=pos){return ladders.map(l=>({ladder:l,d:Math.hypot(position.x-l.x,position.z-l.z)})).sort((a,b)=>a.d-b.d)[0]?.ladder??null;}
 function detach(force=false){if(traversal.active){const released=traversal.detach(force);if(released){grounded=false;saveHeight();}return released;}if(!climb)return false;const l=climb.ladder;pos.x+=l.nx*.35;pos.z+=l.nz*.35;climb=null;grounded=false;saveHeight();return true;}
 return {
  get grounded(){return grounded;},get climbing(){return !!climb||traversal.active;},get airKick(){return airKick;},get extraUsed(){return extraUsed;},
  get heightAboveGround(){return pos.y-world.groundHeight(pos.x,pos.z);},
  nearest, floorAt,
  requestJump(){const jump=jumpImpulse({grounded,heightAboveGround:pos.y-world.groundHeight(pos.x,pos.z),used:extraUsed});if(!jump)return null;if(jump.double){extraUsed=true;airKick=.4;}grounded=false;saveHeight();return jump;},
  tryGrab(){
   if(traversal.grab()){grounded=false;airKick=0;saveHeight();return true;}
   const l=nearest();if(!l||Math.hypot(pos.x-l.x,pos.z-l.z)>1.9||pos.y<l.y0-.1||pos.y>l.top+.9)return false;
   if(!clearSegment(pos,l,(x,z,r)=>world.blockedAt(x,z,r,null,pos.y),.05))return false;
   climb={ladder:l,mantle:null};grounded=false;airKick=0;pos.x=l.x+l.nx*.35;pos.z=l.z+l.nz*.35;pos.y=Math.min(l.top-.25,Math.max(l.y0+.15,pos.y));world.player.mesh.rotation.y=Math.atan2(-l.nx,-l.nz);saveHeight();return true;
  },
  detach,
  advanceClimb(dt,keys){
   if(traversal.active){const result=traversal.advance(dt);grounded=result?.grounded===true;if(grounded)extraUsed=false;saveHeight();return true;}
   if(!climb)return false;const l=climb.ladder;
   if(climb.mantle){const m=climb.mantle;m.t=Math.min(1,m.t+dt/.45);const t=T.MathUtils.smoothstep(m.t,0,1);pos.lerpVectors(m.from,m.to,t);if(m.t===1){climb=null;grounded=true;extraUsed=false;}saveHeight();return true;}
   const move=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),step=move*1.85*dt;climbDistance+=Math.abs(step);pos.y=T.MathUtils.clamp(pos.y+step,l.y0+.1,l.top+.05);world.player.mesh.rotation.y=Math.atan2(-l.nx,-l.nz);
   if(pos.y>=l.top-.2&&move>0)climb.mantle={t:0,from:pos.clone(),to:new T.Vector3(l.exit.x,l.top,l.exit.z)};
   if(pos.y<=l.y0+.11&&move<0){climb=null;grounded=true;pos.y=world.groundHeight(pos.x,pos.z);extraUsed=false;}
   saveHeight();return true;
  },
  advance(dt,velocity){airKick=Math.max(0,airKick-dt);const floor=floorAt(pos.x,pos.z),next=verticalStep(pos.y,velocity,floor,dt);pos.y=next.y;grounded=next.grounded;if(grounded)extraUsed=false;saveHeight();return next;},
  reset(feetY=world.groundHeight(pos.x,pos.z)){traversal.detach(true);climb=null;grounded=Math.abs(feetY-floorAt(pos.x,pos.z,feetY+.12))<.1;extraUsed=false;airKick=0;pos.y=feetY;saveHeight();},
  context(){const special=traversal.context();if(special)return special;const l=nearest();if(climb)return 'W / S · Лезть вверх / вниз · E — отпустить';return l&&Math.hypot(pos.x-l.x,pos.z-l.z)<2.6&&pos.y<=l.top+.9?'Space + E · Зацепиться за лестницу':'';},
  get motion(){return traversal.motion??(climb?{phase:climbDistance*5.5,moving:!climb.mantle,ladder:climb.ladder.id}:null);},
  get diagnostics(){return {grounded,extraUsed,doubleJumpHeight:DOUBLE_JUMP_HEIGHT,heightAboveGround:pos.y-world.groundHeight(pos.x,pos.z),climbing:climb?.ladder.id??traversal.saved?.id??null,traversal:traversal.saved,airKick,ladders:ladders.map(({id,x,z,nx,nz,y0,top,exit})=>({id,x,z,nx,nz,y0,top,exit})),roofs:roofs.map(r=>({...r}))};},
  dispose(){traversal.dispose();root.removeFromParent();owned.forEach(g=>g.dispose());metal.dispose();},
 };
}
