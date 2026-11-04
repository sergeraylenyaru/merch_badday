import * as T from 'three';
import {point,meetsStreet,PARK_PATHS,MAP} from './reference-layout.js';
import {boxesIntersect} from '../spatial.js';
import {vehicleDoor} from '../spatial.js';
import {SUPPLIES,priceText,supplyOwned,planSupply,buySupplyAt} from './purchases.js';
export function planSupplyStalls(world){
 const wanted=[{id:'drinks',name:'Напитки у дома',...point(190,270),color:'#598572'},{id:'workwear',name:'Рабочая одежда',...point(330,435),color:'#ae8a53'},{id:'garage',name:'Автосервис',...point(520,215),color:'#4e7e97'}],out=[];
 for(const store of wanted){const width=store.id==='garage'?6:3.4,depth=store.id==='garage'?4:2.5,choices=[];
  site:for(const p of [...world.walkways.nodes].sort((a,b)=>Math.hypot(a.x-store.x,a.z-store.z)-Math.hypot(b.x-store.x,b.z-store.z)).slice(0,150))for(const [nx,nz]of [[0,1],[0,-1],[1,0],[-1,0]]){
   const offset=depth/2+2.1,x=p.x+nx*offset,z=p.z+nz*offset,w=(nx?depth:width)/2,d=(nx?width:depth)/2,shape={x,z,w:w+.3,d:d+.3};
   if(meetsStreet(x,z,shape.w*2,shape.d*2)||world.blockers.some(b=>b.enabled!==false&&boxesIntersect(shape,b))||out.some(b=>Math.hypot(b.x-x,b.z-z)<15)||world.blockedAt(p.x,p.z,.4,null,world.groundHeight(p.x,p.z)))continue;
   if([-1,0,1].some(a=>[-1,0,1].some(b=>world.water.isWater(x+a*w,z+b*d))))continue;
   if(PARK_PATHS.some(([u,v,pw,pd])=>boxesIntersect(shape,{...point(u,v),w:pw*MAP.scale/2,d:pd*MAP.scale/2})))continue;
   choices.push({...store,x,z,w,d,width,depth,nx:-nx,nz:-nz,approach:{x:p.x,z:p.z,y:world.groundHeight(p.x,p.z)},score:Math.hypot(p.x-store.x,p.z-store.z)});break site;
  }
  const chosen=choices.sort((a,b)=>a.score-b.score)[0];if(!chosen)throw Error('Нет свободного места для '+store.name);out.push(chosen);
 }return out;
}
export function dimaMeetingPoint(world,van){
 const clear=p=>!world.water.isWater(p.x,p.z)&&!world.blockedAt(p.x,p.z,.4,null,world.groundHeight(p.x,p.z));
 for(const p of [vehicleDoor(van),vehicleDoor(van,1)])if(clear(p))return p;
 let best=null,bestDistance=12;for(const p of world.walkways.nodes){const d=Math.hypot(p.x-van.mesh.position.x,p.z-van.mesh.position.z);if(d<bestDistance&&clear(p)){best=p;bestDistance=d;}}
 return best;
}
export function createSupplyStalls(scene,world,state,callbacks){
 const root=new T.Group();root.name='physical-supply-stalls';scene.add(root);const geometry=[],materials=[],textures=[],stalls=planSupplyStalls(world);
 function box(parent,x,y,z,w,h,d,color){const g=new T.BoxGeometry(w,h,d),m=new T.MeshStandardMaterial({color,roughness:.8}),mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);geometry.push(g);materials.push(m);}
 for(const s of stalls){const g=new T.Group(),floor=world.groundHeight(s.x,s.z);g.position.set(s.x,floor,s.z);g.rotation.y=Math.atan2(s.nx,s.nz);root.add(g);const h=s.id==='garage'?3.6:2.8;
  box(g,0,h/2,0,s.width,h,s.depth,s.color);box(g,0,h+.1,0,s.width+.4,.2,s.depth+.6,'#d1c4a2');box(g,0,1.6,s.depth/2+.02,s.width-.5,1.15,.07,'#243c3e');box(g,0,.95,s.depth/2+.2,s.width-.3,.15,.55,'#d5c5a3');box(g,0,h-.3,s.depth/2+.35,s.width+.3,.12,.9,s.color);
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle=s.color;ctx.fillRect(0,0,512,96);ctx.fillStyle='#fff0c5';ctx.font='bold 36px Arial';ctx.textAlign='center';ctx.fillText(s.name.toUpperCase(),256,62,488);const texture=new T.CanvasTexture(canvas),material=new T.MeshBasicMaterial({map:texture}),signGeometry=new T.PlaneGeometry(s.width-.15,.6),sign=new T.Mesh(signGeometry,material);sign.position.set(0,h-.4,s.depth/2+.46);g.add(sign);textures.push(texture);materials.push(material);geometry.push(signGeometry);
  const proxy=world.box(s.x,floor+h/2,s.z,s.w*2,h,s.d*2,s.color,true);proxy.visible=false;
 }
 function seller(id){const s=stalls.find(s=>s.id===id);if(s)return {id:s.id,name:s.name,...s.approach};if(id==='dima'){const van=world.vehicles.find(v=>v.rival&&!v.claimed&&!v.sunk);if(van){const p=dimaMeetingPoint(world,van);if(p)return {id:'dima',name:'Дима у фургона',...p,y:world.groundHeight(p.x,p.z)};}}return null;}
 function track(id){const item=SUPPLIES[id];if(!item||!seller(item.vendor)||!planSupply(state,id)){callbacks.notify('Покупка уже сделана или продавец сейчас недоступен.');return false;}callbacks.changed();callbacks.notify('Место отмечено на карте. Подойдите и нажмите E.');return true;}
 return {
  track,
  target(){const trip=state.supplyTrip,item=SUPPLIES[trip?.item],p=item?seller(item.vendor):null;return p?{...p,label:`${p.name} · ${item.name} · E — купить`}:null;},
  nearest(p){const ids=[...stalls.map(s=>s.id),'dima'];return ids.map(seller).filter(Boolean).filter(s=>Math.abs((p.y??0)-s.y)<1.5&&Math.hypot(p.x-s.x,p.z-s.z)<2.6).sort((a,b)=>Math.hypot(p.x-a.x,p.z-a.z)-Math.hypot(p.x-b.x,p.z-b.z))[0]??null;},
  interact(s){const stock=Object.entries(SUPPLIES).filter(([,item])=>item.vendor===s.id);callbacks.dialog(s.name,`Деньги: ${Math.round(state.money)} ₽ · Премия: ${Math.round(state.bonus)} ₽\n\n`+stock.map(([,item])=>`${item.name}: ${item.effect}`).join('\n\n'),[...stock.map(([id,item])=>({id:'supply-'+id,label:`${supplyOwned(state,id)?'✓ Уже получено':`Купить · ${item.name} · ${priceText(item)}`}`,disabled:supplyOwned(state,id)||state[item.currency]<item.cost,run(){const current=seller(s.id);if(buySupplyAt(state,id,world.player.mesh.position,current)){callbacks.garageChanged();callbacks.changed();callbacks.notify(['energy','boots','gloves'].includes(id)?item.name+' в портфеле · M → Снаряжение, чтобы использовать':item.name+' · '+item.effect);callbacks.resume();}else callbacks.notify('Подойдите к продавцу или проверьте баланс.');}})),{id:'leave',label:'Уйти',run:callbacks.resume}]);},
  markers(){return [...stalls.map(s=>seller(s.id)),seller('dima')].filter(Boolean);},
  get diagnostics(){return {stalls:stalls.map(s=>({...s,approach:{...s.approach}})),sellers:[...stalls.map(s=>seller(s.id)),seller('dima')].filter(Boolean),target:this.target()};},
  dispose(){root.removeFromParent();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
 };
}
