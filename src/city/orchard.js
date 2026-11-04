import * as T from 'three';
import {START} from './reference-layout.js';
import {clearSegment} from '../npc/navigation.js';

export function eatApple(state,id){
 if(state.health<=0)return false;
 const orchard=state.adventure.orchard??={fallen:[],picked:[]};if(orchard.picked.includes(id))return false;
 orchard.picked.push(id);state.health=Math.min(100,state.health+30);state.stress=Math.max(0,state.stress-50);if(state.adventure.inventory.includes('slingshot'))state.adventure.apples=Math.min(30,(state.adventure.apples??0)+1);return true;
}
export function createOrchard(scene,world,state,{notify,changed}){
 const saved=state.adventure.orchard??={fallen:[],picked:[]};saved.fallen??=[];saved.picked??=[];
 const candidates=world.treeSpots.filter(t=>t.height>3).sort((a,b)=>a.id.localeCompare(b.id));
 const chosen=candidates.filter(t=>(Math.floor((t.x+334)*2)+Math.floor((t.z+188)*3))%7===0);
 const nearest=candidates.reduce((a,b)=>!a||Math.hypot(b.x-START.x,b.z-START.z)<Math.hypot(a.x-START.x,a.z-START.z)?b:a,null);if(nearest&&!chosen.includes(nearest))chosen.push(nearest);
 const fruitGeometry=new T.IcosahedronGeometry(.23,1),stemGeometry=new T.CylinderGeometry(.025,.03,.16,5),fruitMaterial=new T.MeshStandardMaterial({color:'#ce4430',roughness:.68,emissive:'#661c10',emissiveIntensity:.18}),stemMaterial=new T.MeshStandardMaterial({color:'#655638',roughness:1});
 const fruits=new T.InstancedMesh(fruitGeometry,fruitMaterial,chosen.length),stems=new T.InstancedMesh(stemGeometry,stemMaterial,chosen.length);fruits.name='apple-tree-fruits';stems.name='apple-stems';scene.add(fruits,stems);
 const apples=chosen.map((t,index)=>({...t,index,status:saved.picked.includes(t.id)?'picked':saved.fallen.includes(t.id)?'ground':'hanging',y:0,velocity:0,age:0}));
 const matrix=new T.Matrix4(),rotation=new T.Quaternion(),one=new T.Vector3(1,1,1),zero=new T.Vector3(0,0,0),position=new T.Vector3();
 function place(a){const ground=world.groundHeight(a.x,a.z);if(a.status==='hanging')a.y=ground+a.fruitHeight;else if(a.status==='ground')a.y=ground+.23;
  position.set(a.x+.65,a.y,a.z+.15);matrix.compose(position,rotation,a.status==='picked'?zero:one);fruits.setMatrixAt(a.index,matrix);position.y+=.27;matrix.compose(position,rotation,a.status==='picked'?zero:one);stems.setMatrixAt(a.index,matrix);
 }
 apples.forEach(place);fruits.instanceMatrix.needsUpdate=stems.instanceMatrix.needsUpdate=true;fruits.computeBoundingSphere();stems.computeBoundingSphere();
 return {
  hit(player,reach,direction){const a=apples.filter(a=>a.status==='hanging'&&Math.abs(player.y-world.groundHeight(a.x,a.z))<2.5).map(a=>({a,d:Math.hypot(a.x-player.x,a.z-player.z)})).filter(({a,d})=>d<reach&&d>.05&&((a.x-player.x)*direction.x+(a.z-player.z)*direction.z)/d>.2&&clearSegment(player,a,world.blocked,.05)).sort((p,q)=>p.d-q.d)[0]?.a;
   if(!a)return false;a.status='falling';a.velocity=0;a.age=0;saved.fallen.push(a.id);changed();notify('Яблоко падает! Подойдите: +30 HP и −50 стресса.');return true;
  },
  update(dt){let dirty=false;const player=world.player.mesh.position;
   for(const a of apples){if(a.status==='falling'&&dt>0){a.age+=dt;a.velocity-=14*dt;a.y+=a.velocity*dt;const ground=world.groundHeight(a.x,a.z)+.23;if(a.y<=ground){a.y=ground;a.status='ground';}dirty=true;}
    if(a.status==='ground'&&dt>0&&Math.abs(player.y-world.groundHeight(a.x,a.z))<1.5&&Math.hypot(player.x-a.x-.65,player.z-a.z-.15)<1.65){if(eatApple(state,a.id)){a.status='picked';changed();notify('Яблоко · +30 HP · стресс −50'+(state.adventure.inventory.includes('slingshot')?` · заряд ${state.adventure.apples}/30`:''));dirty=true;}}
    if(dirty)place(a);
   }
   if(dirty){fruits.instanceMatrix.needsUpdate=stems.instanceMatrix.needsUpdate=true;}
  },
  context(){return apples.some(a=>a.status==='hanging'&&Math.hypot(world.player.mesh.position.x-a.x,world.player.mesh.position.z-a.z)<3)?'F · Ударить яблоню · яблоко даёт +30 HP и −50 стресса':'';},
  get diagnostics(){return {trees:apples.length,apples:apples.map(({id,x,y,z,status})=>({id,x,y,z,status})),picked:saved.picked.length};},
  dispose(){scene.remove(fruits,stems);fruits.dispose();stems.dispose();fruitGeometry.dispose();stemGeometry.dispose();fruitMaterial.dispose();stemMaterial.dispose();},
 };
}
