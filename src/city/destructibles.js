import * as T from 'three';
import {boxesIntersect} from '../spatial.js';

export const BREAKABLE_IDS=new Set(['bench-wood','bench-metal','game-table','ball','trash-bin','recycling-bin','plastic-crate','wood-pallet']);
export function createDestructibles(scene,world){
  const records=[],active=[],state=world.state??{},hidden=new T.Matrix4().makeScale(0,0,0);
  const saved=new Set(Array.isArray(state.brokenProps)?state.brokenProps:[]);
  const cube=new T.BoxGeometry(.35,.12,.18),sphere=new T.IcosahedronGeometry(.28,1);
  const wood=new T.MeshStandardMaterial({color:'#96704e'}),rubber=new T.MeshStandardMaterial({color:'#e8bd58'});
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
    if(prop.broken)return false;
    prop.hp-=power;
    if(prop.hp>0)return true;
    hide(prop);saved.add(prop.key);state.brokenProps=[...saved];fragments(prop,direction,power);return true;
  }
  return {
    register(record){const prop={...record,hp:record.id==='ball'?1:2,broken:false};records.push(prop);if(saved.has(prop.key))hide(prop);return prop;},
    hit(position,reach,power,direction){
      const nearby=records.filter(p=>!p.broken&&Math.hypot(p.x-position.x,p.z-position.z)<reach+Math.min(p.footprint.w,p.footprint.d))
        .filter(p=>Math.abs((position.y??0)-(world.groundHeight?.(p.x,p.z)??0))<2.5)
        .filter(p=>{const dx=p.x-position.x,dz=p.z-position.z;return dx*direction.x+dz*direction.z>-.1;})
        .sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
      return nearby.length?strike(nearby[0],power,direction):false;
    },
    vehicle(box,speed,direction){if(Math.abs(speed)<2)return;for(const p of records)if(!p.broken&&boxesIntersect(box,p.footprint))strike(p,2,direction);},
    update(dt){for(let i=active.length-1;i>=0;i--){const p=active[i];p.life-=dt;if(p.life<=0){clearPiece(p);active.splice(i,1);continue;}if(p.body){p.mesh.position.copy(p.body.translation());p.mesh.quaternion.copy(p.body.rotation());}}},
    get diagnostics(){return {count:records.length,broken:records.filter(p=>p.broken).length,activeBodies:active.length,props:records.map(p=>({key:p.key,id:p.id,x:p.x,z:p.z,hp:p.hp,broken:p.broken}))};},
    dispose(){for(const p of active)clearPiece(p);active.length=0;cube.dispose();sphere.dispose();wood.dispose();rubber.dispose();},
  };
}
