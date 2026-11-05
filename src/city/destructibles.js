import * as T from 'three';
import {boxesIntersect} from '../spatial.js';

export const BREAKABLE_IDS=new Set(['bench-wood','bench-metal','game-table','ball','trash-bin','recycling-bin','plastic-crate','wood-pallet']);
export function createDestructibles(scene,world){
  const records=[],active=[],rollers=[],state=world.state??{},hidden=new T.Matrix4().makeScale(0,0,0);
  const saved=new Set(Array.isArray(state.brokenProps)?state.brokenProps:[]);
  const cube=new T.BoxGeometry(.35,.12,.18),sphere=new T.IcosahedronGeometry(.28,1);
  const wood=new T.MeshStandardMaterial({color:'#96704e'}),rubber=new T.MeshStandardMaterial({color:'#e8bd58'});
  state.rollingBalls??={};const previousPlayer=new T.Vector3();let playerSeen=false;
  function ballPosition(p){return p.ball?.body?.translation()??state.rollingBalls[p.key]??p;}
  function activateBall(p){
    if(p.ball)return p.ball;
    for(const {mesh,index}of p.instances){mesh.setMatrixAt(index,hidden);mesh.instanceMatrix.needsUpdate=true;}
    if(p.proxy){p.proxy.userData.blocker.enabled=false;const c=world.physics?.getCollider(p.proxy.userData.colliderHandle),b=c?.parent();if(b)world.physics.removeRigidBody(b);}
    const start=ballPosition(p),mesh=new T.Mesh(sphere,rubber);mesh.name='rolling-ball:'+p.key;mesh.position.set(start.x,start.y??(world.groundHeight?.(start.x,start.z)??0)+.3,start.z);scene.add(mesh);
    let body=null;if(world.physics&&world.RAPIER){const R=world.RAPIER;body=world.physics.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...mesh.position.toArray()).setLinearDamping(.3).setAngularDamping(.3).setCcdEnabled(true));world.physics.createCollider(R.ColliderDesc.ball(.28).setDensity(.3).setRestitution(.6).setFriction(.6),body);}
    p.ball={mesh,body,cooldown:0,awake:true};rollers.push(p.ball);return p.ball;
  }
  function kickBall(p,direction,power){const ball=activateBall(p);ball.body?.setEnabled(true);ball.awake=true;ball.mesh.visible=true;const force=Math.min(12,3+power*1.5);ball.body?.setLinvel({x:direction.x*force,y:Math.min(3,.8+power*.4),z:direction.z*force},true);ball.body?.setAngvel({x:direction.z*force/.28,y:0,z:-direction.x*force/.28},true);ball.cooldown=.3;return true;}
  function clearPiece(piece){scene.remove(piece.mesh);if(piece.body&&world.physics?.getRigidBody(piece.body.handle))world.physics.removeRigidBody(piece.body);}
  function hide(prop){
    prop.broken=true;
    for(const person of world.people??[])if(person.seated&&Math.hypot(person.mesh.position.x-prop.x,person.mesh.position.z-prop.z)<2){person.seated=false;person.activity=null;}
    for(const {mesh,index} of prop.instances){mesh.setMatrixAt(index,hidden);mesh.instanceMatrix.needsUpdate=true;}
    if(prop.proxy){
      const blocker=prop.proxy.userData.blocker;if(blocker)blocker.enabled=false;
      const collider=world.physics?.getCollider(prop.proxy.userData.colliderHandle),body=collider?.parent();
      if(body)world.physics.removeRigidBody(body);
    }
  }
  function fragments(prop,direction,power){
    const rolling=prop.id==='ball'&&power<2,count=rolling?1:3;
    for(let i=0;i<count;i++){
      if(active.length>=12)clearPiece(active.shift());
      const mesh=new T.Mesh(rolling?sphere:cube,prop.id==='ball'?rubber:wood);
      mesh.position.set(prop.x+(i-1)*.2,(world.groundHeight?.(prop.x,prop.z)??0)+.6,prop.z);
      scene.add(mesh);let body=null;
      if(world.physics&&world.RAPIER){
        const R=world.RAPIER;
        body=world.physics.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(...mesh.position.toArray()).setLinearDamping(rolling?.4:2).setCcdEnabled(true));
        world.physics.createCollider((rolling?R.ColliderDesc.ball(.28):R.ColliderDesc.cuboid(.175,.06,.09)).setRestitution(rolling?.65:.15),body);
        body.setLinvel({x:direction.x*4+(i-1),y:rolling?2:3+i*.4,z:direction.z*4},true);
        body.setAngvel({x:i+2,y:1,z:2},true);
      }
      active.push({mesh,body,life:rolling?12:5});
    }
  }
  function strike(prop,power,direction){
    if(prop.id==='ball')return kickBall(prop,direction,power);
    if(prop.broken)return false;
    prop.hp-=power;
    if(prop.hp>0)return true;
    hide(prop);saved.add(prop.key);state.brokenProps=[...saved];fragments(prop,direction,power);return true;
  }
  return {
    register(record){const prop={...record,hp:record.id==='ball'?Infinity:2,broken:false};records.push(prop);if(prop.id.startsWith('bench-')){world.seats??=[];world.seats.push({id:prop.key,x:prop.x,z:prop.z,height:record.seatHeight??.56,baseY:record.seatBaseY??world.groundHeight?.(prop.x,prop.z)??0,heading:record.heading??0});}if(prop.id==='ball'){if(saved.delete(prop.key))state.brokenProps=[...saved];}else if(saved.has(prop.key))hide(prop);return prop;},
    hit(position,reach,power,direction){
      const nearby=records.filter(p=>{const q=p.id==='ball'?ballPosition(p):p;return !p.broken&&Math.hypot(q.x-position.x,q.z-position.z)<reach+Math.min(p.footprint.w,p.footprint.d);})
        .filter(p=>Math.abs((position.y??0)-(world.groundHeight?.(p.x,p.z)??0))<2.5)
        .filter(p=>{const q=p.id==='ball'?ballPosition(p):p,dx=q.x-position.x,dz=q.z-position.z;return dx*direction.x+dz*direction.z>-.1;})
        .sort((a,b)=>{const p=a.id==='ball'?ballPosition(a):a,q=b.id==='ball'?ballPosition(b):b;return Math.hypot(p.x-position.x,p.z-position.z)-Math.hypot(q.x-position.x,q.z-position.z);});
      return nearby.length?strike(nearby[0],power,direction):false;
    },
    vehicle(box,speed,direction){if(Math.abs(speed)<2)return;for(const p of records){const q=p.id==='ball'?ballPosition(p):p,shape=p.id==='ball'?{...q,w:.28,d:.28}:p.footprint;if(!p.broken&&boxesIntersect(box,shape))strike(p,2,direction);}},
    update(dt){
      const player=world.player?.mesh.position,speed=player&&playerSeen?player.distanceTo(previousPlayer)/Math.max(dt,.001):0;
      for(const p of records)if(p.id==='ball'){
        let q=ballPosition(p),near=!player||Math.hypot(q.x-player.x,q.z-player.z)<65;if(near&&!p.ball)activateBall(p);const b=p.ball;if(!b)continue;
        if(b.awake!==near){b.awake=near;b.body?.setEnabled(near);b.mesh.visible=near;}if(!near)continue;
        if(b.body){q=b.body.translation();b.mesh.position.copy(q);b.mesh.quaternion.copy(b.body.rotation());state.rollingBalls[p.key]={x:q.x,y:q.y,z:q.z};}
        b.cooldown=Math.max(0,b.cooldown-dt);if(player&&speed>.35&&b.cooldown===0&&Math.abs(player.y-q.y)<1&&Math.hypot(player.x-q.x,player.z-q.z)<.85){const dx=q.x-player.x,dz=q.z-player.z,d=Math.hypot(dx,dz)||1;kickBall(p,{x:dx/d,z:dz/d},1);}
      }
      if(player){previousPlayer.copy(player);playerSeen=true;}
      for(let i=active.length-1;i>=0;i--){const p=active[i];p.life-=dt;if(p.life<=0){clearPiece(p);active.splice(i,1);continue;}if(p.body){p.mesh.position.copy(p.body.translation());p.mesh.quaternion.copy(p.body.rotation());}}
    },
    get diagnostics(){return {count:records.length,broken:records.filter(p=>p.broken).length,activeBodies:active.length+rollers.filter(b=>b.awake).length,rollingBalls:rollers.filter(b=>b.awake).length,props:records.map(p=>{const q=p.id==='ball'?ballPosition(p):p;return {key:p.key,id:p.id,x:q.x,z:q.z,y:q.y??0,hp:Number.isFinite(p.hp)?p.hp:null,broken:p.broken,rolling:!!p.ball};})};},
    dispose(){for(const p of [...active,...rollers])clearPiece(p);active.length=rollers.length=0;cube.dispose();sphere.dispose();wood.dispose();rubber.dispose();},
  };
}
