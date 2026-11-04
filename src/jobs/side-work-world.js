import * as T from 'three';
import {SHOPS} from '../state.js';
import {SIDE_JOBS,ensureSideWork,acceptSideWork,advanceSideCargo,interactSideCargo} from './side-work.js';
import {clearSegment} from '../npc/navigation.js';

export function createSideWork(scene,world,state,callbacks){
 const work=ensureSideWork(state),root=new T.Group();root.name='shop-side-work';scene.add(root);const boards=[],owned=[],materials=[],textures=[];
 const make=(parent,x,y,z,w,h,d,color)=>{const g=new T.BoxGeometry(w,h,d),m=new T.MeshStandardMaterial({color,roughness:.9}),mesh=new T.Mesh(g,m);owned.push(g);materials.push(m);mesh.position.set(x,y,z);parent.add(mesh);return mesh;};
 function sign(parent,text,x,y,z,width=2.4){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#173c39';ctx.fillRect(0,0,512,128);ctx.fillStyle='#ffdf87';ctx.textAlign='center';ctx.font='bold 34px Arial';ctx.fillText(text,256,78,490);const t=new T.CanvasTexture(c),g=new T.PlaneGeometry(width,.6),m=new T.MeshBasicMaterial({map:t});textures.push(t);owned.push(g);materials.push(m);const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);}
 for(const shop of SHOPS){
  const x=shop.x-12,z=shop.z-6.7,group=new T.Group();group.position.set(x,0,z);root.add(group);
  // The back-left alcove stays outside the shelves and the main job aisles.
  for(const [px,pz,w,d]of [[shop.x-10.5,shop.z-6, .12,2.8],[shop.x-13.15,shop.z-4.65,.7,.12],[shop.x-10.85,shop.z-4.65,.7,.12]]){const p=world.box(px,1.55,pz,w,3.1,d,'#c6c7ad',true);p.name='stockroom-partition';}
  make(group,0,1.65,0,2.05,1.25,.10,'#98754c');for(let i=0;i<3;i++)make(group,-.64+i*.64,1.66,.065,.5,.74,.025,['#f3e4b4','#b8dbcf','#edc69e'][i]);
  make(group,0,.45,.25,1.8,.9,.7,'#8b9d89');sign(group,'ПОДРАБОТКА · E',0,2.65,.08);sign(root,'ПОДСОБКА',shop.x-12,3.35,shop.z-4.55,2.25);
  boards.push({shop:shop.id,x,z:z+1.25,label:'E · Подсобка · подработка'});
 }
 const entries=world.boroughs.diagnostics.urbanDetails.placements.filter(e=>e.approach).map((e,i)=>({...e.approach,label:`Дом ${i+1} · подъезд 1`})).filter(p=>!world.blocked(p.x,p.z,.45)).map(p=>({...p,access:world.walkways.nodes.filter(n=>n.kind==='walk'&&Math.hypot(n.x-p.x,n.z-p.z)<35).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z)).find(n=>clearSegment(p,n,world.blocked,.4))})).filter(p=>p.access);
 const addressFor=(shop,type)=>{const candidates=entries.filter(p=>Math.hypot(p.x-SHOPS[shop].x,p.z-SHOPS[shop].z)>65).sort((a,b)=>Math.hypot(a.x-SHOPS[shop].x,a.z-SHOPS[shop].z)-Math.hypot(b.x-SHOPS[shop].x,b.z-SHOPS[shop].z));return candidates[Object.keys(SIDE_JOBS).indexOf(type)*2]??candidates[0];};
 const cargo=new T.Group();make(cargo,0,0,0,.7,.48,.5,'#be985e');make(cargo,0,.25,0,.1,.025,.51,'#e8d9b6');root.add(cargo);
 const waiting=new T.Group();make(waiting,0,.3,0,.9,.6,.65,'#648c79');make(waiting,0,.56,0,.92,.08,.67,'#ced6b9');root.add(waiting);
 function boardDialog(board){
  const a=work.active;if(a){callbacks.dialog('Подработка',`${SIDE_JOBS[a.type].title} · ${a.address.label}. ${a.phase==='collect'?'Заберите тару у подъезда.':a.phase==='return'?'Привезите тару обратно в подсобку.':'Отвезите заказ и передайте его у подъезда.'}`,[{id:'cancel-side',label:'Отменить подработку',run(){work.active=null;callbacks.changed();callbacks.resume();}},{id:'leave-side',label:'Продолжить',run:callbacks.resume}]);return;}
  callbacks.dialog('Подсобка · '+SHOPS[board.shop].name,'Выберите подработку. Груз можно перевозить в своей машине. Одна оплата за каждый заказ в этой смене.',[...Object.entries(SIDE_JOBS).map(([type,j])=>({id:'side-'+type,label:`${j.title} · ${j.pay} ₽${type==='express'?' + 100 ₽ за скорость':''}`,disabled:work.completed.includes(board.shop+':'+type)||!addressFor(board.shop,type),run(){if(acceptSideWork(state,board.shop,type,addressFor(board.shop,type))){state.adventure.tracked=null;callbacks.notify(j.description);callbacks.changed();}callbacks.resume();}})),{id:'leave-side',label:'Уйти',run:callbacks.resume}]);
 }
 function target(){const a=work.active;if(!a){const b=boards.find(b=>b.shop===work.board);return b?{...b,label:'Подработка · подсобка «'+SHOPS[b.shop].name+'»'}:null;}if(a.phase==='return'){const b=boards.find(b=>b.shop===a.shop);return {...b,label:'Вернуть тару · подсобка «'+SHOPS[a.shop].name+'»'};}return {...a.address,label:(a.phase==='collect'?'Забрать тару · ':'Доставить заказ · ')+a.address.label};}
 function nearest(position){const t=work.active?target():null;if(t&&Math.hypot(t.x-position.x,t.z-position.z)<2.2&&Math.abs(position.y-world.groundHeight(t.x,t.z))<1.8)return {...t,kind:'cargo',label:'E · '+t.label};return boards.filter(b=>Math.hypot(b.x-position.x,b.z-position.z)<1.9&&Math.abs(position.y-world.groundHeight(b.x,b.z))<1.8).sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z))[0]??null;}
 return {
  target,nearest,track(shop){work.board=shop;state.adventure.tracked=null;},cancel(){work.active=null;work.board=null;},
  interact(item){if(item.kind!=='cargo'){boardDialog(item);return;}const p=world.player.mesh.position;if(!clearSegment(p,item,(x,z,r)=>world.blockedAt(x,z,r,null,p.y),.06))return;const result=interactSideCargo(state,work.active?.phase==='return'?'store':'address');if(result.needsCar)callbacks.notify('Груз нужно отвезти на машине. Затем выйдите и передайте его.');if(result.ok){callbacks.notify(result.collected?'Тара у вас. Верните её в подсобку.':`Подработка выполнена · +${result.amount} ₽`);callbacks.changed();}},
  update(dt,inVehicle){if(dt>0)advanceSideCargo(state,world.player.mesh.position,inVehicle);const a=work.active,p=world.player.mesh.position;cargo.visible=!!a?.carrying&&!inVehicle;waiting.visible=!!a&&a.phase==='collect';if(cargo.visible){cargo.position.set(p.x+Math.sin(world.player.mesh.rotation.y)*.65,p.y+1.05,p.z+Math.cos(world.player.mesh.rotation.y)*.65);cargo.rotation.y=world.player.mesh.rotation.y;}if(waiting.visible)waiting.position.set(a.address.x,world.groundHeight(a.address.x,a.address.z),a.address.z);},
  get carrying(){return !!work.active?.carrying;},get handObject(){return work.active?.carrying?cargo:null;},
  get diagnostics(){return {boards,addresses:entries,active:work.active,completed:work.completed,earned:work.earned};},
  dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());},
 };
}
