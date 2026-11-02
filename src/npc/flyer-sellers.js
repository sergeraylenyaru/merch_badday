import * as T from 'three';
import {clearSegment} from './navigation.js';

export function createFlyerSellers(scene,world){
 const root=new T.Group();root.name='advertising-flyers';scene.add(root);
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=192;
 const c=canvas.getContext('2d');c.fillStyle='#ffd45e';c.fillRect(0,0,128,192);c.fillStyle='#b84032';c.fillRect(0,0,128,45);c.fillStyle='#fff6d1';c.font='bold 23px Arial';c.fillText('АКЦИЯ!',12,31);c.fillStyle='#244252';c.font='bold 38px Arial';c.fillText('−30%',8,102);c.font='bold 17px Arial';c.fillText('ЗАХОДИТЕ',10,144);c.fillText('К НАМ!',28,169);
 const texture=new T.CanvasTexture(canvas),geometry=new T.PlaneGeometry(.3,.44),material=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});
 const flights=[],bundles=[],pool=[];let thrown=0,landed=0;
 const promoters=world.people.filter(n=>n.promoter);
 for(const seller of promoters){const fan=new T.Group();for(let i=0;i<3;i++){const sheet=new T.Mesh(geometry,material);sheet.rotation.z=(i-1)*.18;sheet.position.x=i*.035;fan.add(sheet);}root.add(fan);bundles.push({seller,fan});}
 function throwFlyer(seller,target){
  const hand=seller.mesh.getObjectByName('RightHand'),start=hand?hand.getWorldPosition(new T.Vector3()):seller.mesh.position.clone().add(new T.Vector3(0,1.3,0));
  const end=new T.Vector3(target.x,world.groundHeight(target.x,target.z)+1.15,target.z);
  if(flights.length>=12){const old=flights.shift();old.mesh.visible=false;pool.push(old.mesh);}
  const mesh=pool.pop()??new T.Mesh(geometry,material);root.add(mesh);mesh.visible=true;
  flights.push({mesh,start,end,age:0,hit:false});thrown++;
 }
 return {
  intent(seller,player,dt,inVehicle){
   const promo=seller.promotion??={cooldown:1.2,gesture:0,throws:0};promo.cooldown=Math.max(0,promo.cooldown-dt);promo.gesture=Math.max(0,promo.gesture-dt);
   const position=seller.mesh.position,home=seller.home;
   const candidates=world.people.filter(n=>n.kind==='civilian'&&n.activePedestrian&&n.stun<=0).map(n=>n.mesh.position);
   if(!inVehicle)candidates.push(player);
   const target=candidates.filter(p=>Math.hypot(p.x-home.x,p.z-home.z)<23&&Math.hypot(p.x-position.x,p.z-position.z)<20).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0];
   if(!target)return {target:home,speed:1.5,social:false,activity:null};
   const distance=Math.hypot(target.x-position.x,target.z-position.z),clear=distance<4&&clearSegment(position,target,world.blocked,.08);
   if(clear&&promo.cooldown===0){throwFlyer(seller,target);promo.cooldown=5;promo.gesture=.8;promo.throws++;}
   return {target:clear?null:target,lookAt:target,speed:1.9,social:clear,activity:promo.gesture>0?{id:'flyer-'+promo.throws,clip:'Interact',duration:.8,remaining:promo.gesture}:null};
  },
  update(dt,time){
   for(const {seller,fan}of bundles){fan.visible=seller.mesh.visible&&seller.stun<=0;if(!fan.visible)continue;const hand=seller.mesh.getObjectByName('LeftHand');if(hand){hand.getWorldPosition(fan.position);hand.getWorldQuaternion(fan.quaternion);fan.rotateX(-.5);}}
   for(let i=flights.length-1;i>=0;i--){const f=flights[i];f.age+=dt;const t=Math.min(1,f.age/.65);f.mesh.position.lerpVectors(f.start,f.end,t);f.mesh.position.y+=Math.sin(t*Math.PI)*.65;
    f.mesh.rotation.set(.5+f.age*4,f.age*7,Math.sin(time*6)*.25);if(t===1){if(!f.hit){f.hit=true;landed++;}f.mesh.position.y=Math.max(.08,f.end.y-(f.age-.65)*1.4);f.mesh.rotation.x=-Math.PI/2;}
    if(f.age>2.8){f.mesh.visible=false;pool.push(f.mesh);flights.splice(i,1);}
   }
  },
  get diagnostics(){return {sellers:promoters.length,thrown,landed,active:flights.length,limit:12,people:promoters.map(n=>({x:n.mesh.position.x,z:n.mesh.position.z,throws:n.promotion?.throws??0}))};},
  dispose(){root.removeFromParent();geometry.dispose();material.dispose();texture.dispose();},
 };
}
