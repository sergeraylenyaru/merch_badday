import {rollPoliceLoot} from './police-loot.js';
import * as T from 'three';
import {createWeaponRig} from '../visuals/weapon-rig.js';
import {point,HOME_CAR} from '../city/reference-layout.js';
import {clearSegment} from '../npc/navigation.js';
import {WEAPONS,PACKS,EVENT_INFO,ensureAdventure,collectPack,pickupWeapon,bribeGuard,bribePrice,startEvent,finishEvent,buyGarage,crashCargo,tableCard} from './state.js';

export function createAdventure(scene,world,state,callbacks){
 const a=ensureAdventure(state),root=new T.Group();root.name='city-adventures';scene.add(root);
 const geometries=new Map(),materials=new Map(),textures=[],items=[],used=[],effects=[];
 const geo=(key,make)=>{if(!geometries.has(key))geometries.set(key,make());return geometries.get(key);};
 const mat=(color,glow=false)=>{const key=color+glow;if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.7,emissive:glow?color:'#000000',emissiveIntensity:glow?.55:0}));return materials.get(key);};
 function box(parent,w,h,d,x,y,z,color){const mesh=new T.Mesh(geo(`b:${w}:${h}:${d}`,()=>new T.BoxGeometry(w,h,d)),mat(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 function cylinder(parent,r1,r2,h,x,y,z,color){const mesh=new T.Mesh(geo(`c:${r1}:${r2}:${h}`,()=>new T.CylinderGeometry(r1,r2,h,10)),mat(color));mesh.position.set(x,y,z);parent.add(mesh);return mesh;}
 function label(parent,text,color='#fff1ac'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');
  c.fillStyle='#142735ee';c.fillRect(0,0,512,96);c.fillStyle=color;c.font='bold 30px Arial';c.textAlign='center';c.fillText(text,256,59,490);
  const texture=new T.CanvasTexture(canvas);textures.push(texture);const material=new T.SpriteMaterial({map:texture,depthTest:true});materials.set('label:'+materials.size,material);
  const mesh=new T.Sprite(material);mesh.position.y=2.1;mesh.scale.set(3.8,.72,1);parent.add(mesh);return mesh;
 }
 function safe(desired,gap=3){
  const candidates=[desired,...world.walkways.nodes.filter(n=>Math.hypot(n.x-desired.x,n.z-desired.z)<55).sort((p,q)=>Math.hypot(p.x-desired.x,p.z-desired.z)-Math.hypot(q.x-desired.x,q.z-desired.z))];
  const p=candidates.find(p=>!world.blocked(p.x,p.z,.6)&&used.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>gap))??candidates.find(p=>!world.blocked(p.x,p.z,.4))??desired;
  used.push(p);return {x:p.x,z:p.z};
 }
 function pickup(kind,id,p,color,text,enabled,interaction){
  const group=new T.Group();group.position.set(p.x,p.y??world.groundHeight(p.x,p.z),p.z);root.add(group);
  const ring=new T.Mesh(geo('pickup-ring',()=>new T.RingGeometry(.55,.73,24)),new T.MeshBasicMaterial({color,transparent:true,opacity:.7,side:T.DoubleSide,depthWrite:false}));materials.set('ring:'+materials.size,ring.material);ring.rotation.x=-Math.PI/2;ring.position.y=.05;group.add(ring);
  const beam=cylinder(group,.035,.035,1.65,0,.85,0,color);beam.material=mat(color,true);
  label(group,text,color);const object=new T.Group();object.position.y=.8;group.add(object);
  const item={kind,id,group,object,x:p.x,z:p.z,y:p.y??world.groundHeight(p.x,p.z),enabled,interaction,label:text};items.push(item);return item;
 }
 function weaponModel(parent,id){
  if(id==='slingshot'){
   cylinder(parent,.035,.045,.25,0,0,0,'#a57840');for(const side of [-1,1]){const fork=cylinder(parent,.025,.035,.24,side*.07,.2,0,'#c39552');fork.rotation.z=-side*.6;const band=cylinder(parent,.008,.008,.18,side*.05,.31,-.04,'#ce9b51');band.rotation.z=side*.9;}box(parent,.07,.04,.025,0,.25,-.1,'#4b3d31');
  }else if(id==='stone'){if(!materials.has('held-stone-material'))materials.set('held-stone-material',new T.MeshStandardMaterial({vertexColors:true,roughness:1}));const rock=new T.Mesh(geo('held-stone',()=>world.stones.heldGeometry()),materials.get('held-stone-material'));rock.name='held-stone';parent.add(rock);
  }else if(id==='water'){
   box(parent,.17,.28,.46,0,.2,.08,'#29c7e9');box(parent,.10,.25,.12,0,0,-.02,'#f6ba45');cylinder(parent,.08,.08,.34,0,.33,.08,'#ff6159').rotation.x=Math.PI/2;
   box(parent,.14,.13,.18,0,.25,.37,'#ffe469');
  }else if(id==='baton'){
   cylinder(parent,.028,.026,.65,0,.25,0,'#242c32');cylinder(parent,.033,.033,.18,0,0,0,'#141b20');cylinder(parent,.047,.047,.035,0,.11,0,'#38444c');
  }else{
   cylinder(parent,id==='bat'?.067:.035,id==='bat'?.031:.045,.9,0,.5,0,id==='bat'?'#c9a174':'#906b43');
   cylinder(parent,.029,.029,.23,0,.005,0,'#39404a');cylinder(parent,.043,.043,.035,0,-.13,0,'#a78155');
   if(id==='stick'){const branch=cylinder(parent,.022,.03,.25,.08,.72,0,'#906b43');branch.rotation.z=-.6;}
  }
 }
 const positions={bat:[195,185],stick:[770,440],water:[1450,610],slingshot:[995,135]};
 for(const [id,uv] of Object.entries(positions)){
  const def=WEAPONS[id],p=safe(point(...uv));const item=pickup('weapon',id,p,def.color,'E · '+def.name,()=>!a.pickedWeapons.includes(id),()=>{pickupWeapon(state,id);callbacks.notify(def.name+' подобрано · 1 — кулаки, 2 — бита, 3 — палка, 4 — пистолет, 6 — рогатка');changed();});weaponModel(item.object,id);item.object.scale.setScalar(1.15);
 }
 function addWeaponDrop(drop){const item=pickup('weapon-drop',drop.id,drop,WEAPONS[drop.weapon].color,'E · '+WEAPONS[drop.weapon].name,()=>!drop.taken,()=>{drop.taken=true;pickupWeapon(state,drop.weapon);callbacks.notify('Дубинка подобрана · 7 — выбрать');changed();});weaponModel(item.object,drop.weapon);}
 for(const drop of a.weaponDrops)addWeaponDrop(drop);
 const packSites=[[105,200],[300,130],[370,500],[550,650],[740,230],[935,430],[960,690],[1230,140],[1500,460],[1470,730]];
 const packRoofs=[...world.roofs].filter(r=>r.kind==='residential'&&world.parkour.diagnostics.ladders.some(l=>l.id===r.id||l.id===r.scaffoldAccess)).sort((a,b)=>a.id.localeCompare(b.id));
 for(const pack of PACKS){
  const roof=pack.id>=10?packRoofs[Math.floor((pack.id-10)*packRoofs.length/10)]:null;
  const p=roof?{x:roof.x+Math.min(1,roof.w/3),z:roof.z,y:roof.y}:safe(point(...packSites[pack.id]));const item=pickup('pack',pack.id,p,pack.color,`E · ${pack.name} пачка`,()=>!a.cigarettes.includes(pack.id),()=>{collectPack(state,pack.id);callbacks.notify(`Коллекция: ${pack.name} · ${a.cigarettes.length}/${PACKS.length}`);changed();});
  box(item.object,.46,.65,.22,0,.1,0,pack.color);box(item.object,.47,.17,.23,0,-.12,0,'#ecede4');box(item.object,.25,.04,.235,0,.28,0,'#243946');
 }
 const source=safe(point(180,260)),recipient=safe(point(145,545)),vendor=safe(point(550,235)),wallet=safe(point(805,455));
 const eventPositions={spill:safe(point(205,220)),delivery:source,favor:vendor};
 function offer(id){const info=EVENT_INFO[id];callbacks.dialog(info.title,info.text,[{label:'Помочь',id:'accept',run(){startEvent(state,id);changed();callbacks.resume();}},{label:'Отказаться',id:'decline',run(){a.events[id].status='declined';if(a.tracked===id)a.tracked=null;changed();callbacks.resume();}}]);}
 for(const id of Object.keys(EVENT_INFO)){
  const p=eventPositions[id];const item=pickup('event',id,p,'#f1c569','E · '+EVENT_INFO[id].title,()=>a.events[id].status==='offered'||id==='favor'&&a.events.favor.status==='active'&&a.events.favor.found,()=>{
   if(a.events[id].status==='offered')offer(id);else{const reward=finishEvent(state,id);callbacks.notify(`Спасибо за помощь! +${reward} ₽ · кофе у «У дома» теперь 20 ₽`);changed();}
  });box(item.object,.6,.7,.5,0,0,0,'#547d98');
 }
 for(let i=0;i<3;i++){
  const p={x:eventPositions.spill.x+(i-1)*1.8,z:eventPositions.spill.z-2};const item=pickup('spill',i,p,'#e8b05c','E · Поднять коробку',()=>['offered','active'].includes(a.events.spill.status)&&!a.events.spill.boxes.includes(i),()=>{
   if(a.events.spill.status==='offered'){offer('spill');return;}a.events.spill.boxes.push(i);const amount=finishEvent(state,'spill');callbacks.notify(amount?`Груз собран · +${amount} ₽`:`Коробки: ${a.events.spill.boxes.length}/3`);changed();
  });box(item.object,.65,.65,.65,0,0,0,'#b8905d');item.object.rotation.z=(i-1)*.2;
 }
 const parcel=pickup('parcel',0,source,'#66d5e5','E · Забрать посылку',()=>a.events.delivery.status==='active'&&!a.events.delivery.carrying,()=>{a.events.delivery.carrying=true;a.events.delivery.drop=null;a.tracked='delivery';callbacks.notify('Посылка у вас. Езжайте аккуратно: награда зависит от сохранности.');changed();});
 box(parcel.object,.6,.5,.45,0,0,0,'#c19a60');box(parcel.object,.08,.51,.46,0,0,0,'#e9d1a4');
 const deliveryTarget=pickup('recipient',0,recipient,'#61d48b','E · Передать посылку',()=>a.events.delivery.status==='active'&&a.events.delivery.carrying,()=>{const reward=finishEvent(state,'delivery');callbacks.notify(`Доставка принята · +${reward} ₽`);changed();});box(deliveryTarget.object,.65,.8,.4,0,0,0,'#609889');
 const walletItem=pickup('wallet',0,wallet,'#f2a8dd','E · Кошелёк продавца',()=>a.events.favor.status==='active'&&!a.events.favor.found,()=>{a.events.favor.found=true;a.tracked='favor';callbacks.notify('Кошелёк найден. Верните продавцу или выберите «Оставить деньги» в планшете.');changed();});box(walletItem.object,.5,.18,.35,0,0,0,'#795346');
 const guards=world.people.filter(n=>n.kind==='guard');
 const guardLabels=[];
 guards.forEach((guard,i)=>{const footprint=guard.localShop&&world.blockers.find(b=>b.h>2&&Math.hypot(b.x-guard.shopPosition.x,b.z-guard.shopPosition.z)<.05);
  const p=safe(footprint?{x:footprint.x+Math.min(4,footprint.w*.5),z:footprint.z+footprint.d+2}:guard.entrance);guard.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);guard.home.copy(guard.mesh.position);guard.guardIndex=i;
  const holder=new T.Group();label(holder,'ОХРАНА · E · '+guard.role,'#ffe877').scale.set(3.8,.65,1);
  const ring=new T.Mesh(geo('guard-ring',()=>new T.RingGeometry(.75,.86,24)),mat('#ead856',true));ring.rotation.x=-Math.PI/2;ring.position.y=-.46;holder.add(ring);
  root.add(holder);const vest=new T.Group();box(vest,.63,.5,.42,0,1.4,0,'#cfcc54');box(vest,.65,.07,.44,0,1.42,0,'#e9e5bc');guard.mesh.add(vest);guardLabels.push({guard,holder,vest});});
 function guardDialog(guard){const price=bribePrice(state);callbacks.dialog('Охранник · '+guard.role,`Убрать одну звезду: ${price} ₽. Каждая следующая сделка дороже на 50 ₽. Через 30 секунд после последней оплаты цена снова 50 ₽.`,[{label:`Дать ${price} ₽ · −1 звезда`,id:'bribe',disabled:state.wanted<=0||state.money<price,run(){if(bribeGuard(state)){callbacks.notify(`Охранник договорился: −1 звезда, −${price} ₽`);if(a.tracked?.startsWith('guard:'))a.tracked=null;}changed();callbacks.resume();}},{label:'Уйти',id:'leave',run:callbacks.resume}]);}
 const carriedParcel=new T.Group();box(carriedParcel,.55,.4,.4,0,0,0,'#c19a60');world.player.mesh.add(carriedParcel);carriedParcel.position.set(0,1,.7);
 let heldRig=null,heldId=null;
 function setHeld(id){if(id===heldId)return;heldRig?.dispose();heldId=id;heldRig=id?createWeaponRig(scene,world.player.mesh,id,weaponModel):null;}
 const policeRigs=world.people.filter(n=>n.kind==='police'&&n.weapon==='baton').map(person=>{const rig=createWeaponRig(scene,person.mesh,'baton',weaponModel);person.weaponRig=rig;return {person,rig};});
 const gunMaterial=new T.MeshBasicMaterial({color:'#42d7ff',transparent:true,opacity:.65});materials.set('water-jet',gunMaterial);
 function shootWater(origin,direction){
  const target=world.people.filter(n=>n.mesh.visible&&!n.dead&&n.stun<=0).map(n=>({n,dx:n.mesh.position.x-origin.x,dz:n.mesh.position.z-origin.z})).filter(v=>{const d=Math.hypot(v.dx,v.dz);return d<10&&d>.1&&(v.dx*direction.x+v.dz*direction.z)/d>.94&&clearSegment(origin,v.n.mesh.position,world.blocked,.05);}).sort((p,q)=>Math.hypot(p.dx,p.dz)-Math.hypot(q.dx,q.dz))[0]?.n;
  if(target){target.stun=.3;target.anger=2;if(target.kind==='police')callbacks.crime(1);callbacks.notify('Прямое попадание водой!');}
  const length=target?Math.hypot(target.mesh.position.x-origin.x,target.mesh.position.z-origin.z):9;
  const jet=new T.Mesh(geo('jet',()=>new T.CylinderGeometry(.035,.06,1,6)),gunMaterial);jet.position.set(origin.x+direction.x*length/2,origin.y+1.3,origin.z+direction.z*length/2);jet.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(direction.x,0,direction.z));jet.scale.y=length;root.add(jet);effects.push({mesh:jet,life:.16});if(effects.length>5)root.remove(effects.shift().mesh);
 }
 function addDrop(drop){const p={x:drop.x,z:drop.z};const item=pickup('money',drop.id,p,'#87f09b',`${drop.amount} ₽ · Пройдите рядом`,()=>!drop.taken,()=>{if(drop.taken)return;drop.taken=true;state.money+=drop.amount;callbacks.notify(`Подобрано ${drop.amount} ₽`);changed();});for(let i=0;i<3;i++)box(item.object,.5,.035,.24,i*.035,i*.05,0,'#8ab976');}
 for(const drop of a.drops)addDrop(drop);
 const tables=world.props.diagnostics.props.filter(p=>p.id==='game-table');
 const court=safe(point(900,650)),goal={x:court.x-Math.sin(.25)*3.5,z:court.z-Math.cos(.25)*3.5};
 const goalRoot=new T.Group();goalRoot.position.set(goal.x,world.groundHeight(goal.x,goal.z),goal.z);goalRoot.rotation.y=.25;root.add(goalRoot);
 for(const x of [-1.3,1.3])cylinder(goalRoot,.055,.055,1.7,x,.85,0,'#f4edce');const cross=cylinder(goalRoot,.055,.055,2.7,0,1.7,0,'#f4edce');cross.rotation.z=Math.PI/2;
 const ball=new T.Mesh(geo('football',()=>new T.IcosahedronGeometry(.28,1)),mat('#f0ece0'));root.add(ball);
 const R=world.RAPIER,ballBody=world.physics.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(court.x,world.groundHeight(court.x,court.z)+.3,court.z).setLinearDamping(.15).setCcdEnabled(true));world.physics.createCollider(R.ColliderDesc.ball(.28).setRestitution(.35).setFriction(.3),ballBody);ballBody.setEnabled(false);
 let flight=false,ballAge=0,ballEnabled=false;
 const football=pickup('football',0,court,'#a2ed7b','E · Ударить по мячу',()=>true,dir=>{ballBody.setTranslation({x:court.x,y:world.groundHeight(court.x,court.z)+.35,z:court.z},true);ballBody.setLinvel({x:dir.x*9,y:3,z:dir.z*9},true);flight=true;ballAge=0;a.tracked='football';callbacks.notify(`Попадите в ворота · ${Math.min(3,a.fun.goals)}/3`);});football.object.visible=false;
 function changed(){callbacks.changed?.();}
 function ensureVan(){
  if(!state.career.garage.van)return;
  let van=world.vehicles.find(v=>v.id===a.garage.vanId);
  if(!van){van=world.vehicles.find(v=>v.type===1&&!v.traffic&&!v.delivery&&!v.jobLocked);if(!van)return;a.garage.vanId=van.id;}
  if(!state.vehicles[van.id]?.claimed){const p=[[0,9],[-9,0],[0,-9],[9,0]].map(([x,z])=>({x:HOME_CAR.x+x,z:HOME_CAR.z+z})).find(p=>!world.vehicleBlocked(van,p.x,p.z,0));if(p){van.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);van.heading=0;van.mesh.rotation.y=0;}}
  van.claimed=true;van.displayName='Ваш фургон';
 }
 ensureVan();
 function target(){
  const id=a.tracked;if(!id)return null;
  const e=a.events[id];let p=null,label='';
  if(id==='spill'&&e.status==='active'){p=items.find(i=>i.kind==='spill'&&i.enabled());label='Собрать упавшие коробки';}
  if(id==='delivery'&&e.status==='active'){p=e.carrying?recipient:e.drop??source;label=e.carrying?`Доставка · груз ${e.integrity}%`:'Забрать посылку';}
  if(id==='favor'&&e.status==='active'){p=e.found?vendor:wallet;label=e.found?'Вернуть кошелёк продавцу':'Найти потерянный кошелёк';}
  if(id==='football'){p=goal;label=`Ворота · ${Math.min(3,a.fun.goals)}/3`;}
  if(id==='weapon:slingshot'){p=items.find(i=>i.kind==='weapon'&&i.id==='slingshot');label='Рогатка у колеса обозрения · E';}
  if(id==='hospital'){p=world.hospital.spawn;label='Городская больница №1';}
  if(id==='ladder'){p=world.parkour.nearest();label='Лестница на крышу · Space + E';}
  if(id==='scaffold'){p=world.parkour.diagnostics.ladders.filter(l=>l.id.startsWith('scaffold:')).sort((p,q)=>Math.hypot(p.x-world.player.mesh.position.x,p.z-world.player.mesh.position.z)-Math.hypot(q.x-world.player.mesh.position.x,q.z-world.player.mesh.position.z))[0];label='Строительные леса · Space + E';}
  if(id==='billboard'){p=world.parkour.diagnostics.ladders.filter(l=>l.id.startsWith('billboard:')).sort((p,q)=>Math.hypot(p.x-world.player.mesh.position.x,p.z-world.player.mesh.position.z)-Math.hypot(q.x-world.player.mesh.position.x,q.z-world.player.mesh.position.z))[0];label='Рекламный щит · лестница на столбе · Space + E';}
  if(id==='wire'){p=world.cables.wires.flatMap(w=>[w.a,w.b]).sort((p,q)=>Math.hypot(p.x-world.player.mesh.position.x,p.z-world.player.mesh.position.z)-Math.hypot(q.x-world.player.mesh.position.x,q.z-world.player.mesh.position.z))[0];label='Провод на крыше · Space + E';if(p&&world.player.mesh.position.y<p.roofY-1){p=world.parkour.diagnostics.ladders.find(l=>l.id===p.roofId||l.id===world.roofs.find(r=>r.id===p.roofId)?.scaffoldAccess)??p;label='Поднимитесь по лестнице к проводу';}else if(p)p={...p,y:p.roofY};}
  if(id==='garage-yard'){p=world.yards.yards.flatMap(y=>y.props).sort((p,q)=>Math.hypot(p.x-world.player.mesh.position.x,p.z-world.player.mesh.position.z)-Math.hypot(q.x-world.player.mesh.position.x,q.z-world.player.mesh.position.z))[0];label='Ящики, баки и забор у гаражей';}
  if(id==='van'){p=world.vehicles.find(v=>v.id===a.garage.vanId)?.mesh.position;label='Ваш фургон';}
  if(id.startsWith('guard:')){p=guards[Number(id.split(':')[1])]?.mesh.position;label='Охранник · договориться';}
  return p?{x:p.x,z:p.z,...(Number.isFinite(p.y)?{y:p.y}:{}),label}:null;
 }
 return {
  target,
  kickBall(origin,reach,direction,power=1){const p=ballBody.translation(),dx=p.x-origin.x,dz=p.z-origin.z,d=Math.hypot(dx,dz);if(!ballEnabled||d>reach||Math.abs(origin.y-p.y)>1.7||(d>.05&&(dx*direction.x+dz*direction.z)/d<.1))return false;ballBody.setLinvel({x:direction.x*(5+power),y:1.8,z:direction.z*(5+power)},true);ballBody.setAngvel({x:direction.z*12,y:0,z:-direction.x*12},true);flight=true;ballAge=0;return true;},
  nearest(position){
   const candidates=items.filter(i=>i.kind!=='money'&&i.enabled()&&Math.abs(position.y-i.y)<2&&Math.hypot(i.x-position.x,i.z-position.z)<2.5).map(i=>({...i,d:Math.hypot(i.x-position.x,i.z-position.z)}));
   for(const guard of guards)if(guard.stun<=0&&Math.abs(position.y-guard.mesh.position.y)<2&&Math.hypot(guard.mesh.position.x-position.x,guard.mesh.position.z-position.z)<2.8)candidates.push({kind:'guard',guard,d:Math.hypot(guard.mesh.position.x-position.x,guard.mesh.position.z-position.z),label:'E · Охранник · договориться'});
   for(const table of tables)if(Math.abs(position.y-world.groundHeight(table.x,table.z))<2&&Math.hypot(table.x-position.x,table.z-position.z)<2.2&&!world.props.diagnostics.props.find(p=>p.key===table.key)?.broken)candidates.push({kind:'table',d:Math.hypot(table.x-position.x,table.z-position.z),label:'E · Игра за столиком · найти пары'});
   return candidates.sort((p,q)=>p.d-q.d)[0]??null;
  },
  interact(item,direction){if(item.kind==='guard')guardDialog(item.guard);else if(item.kind==='table')callbacks.table();else item.interaction(direction);},
  action(name,value){
   if(name==='start')startEvent(state,value);
   if(name==='decline'&&a.events[value]?.status==='offered')a.events[value].status='declined';
   if(name==='track')a.tracked=value;
   if(name==='keep'){const reward=finishEvent(state,'favor',true);if(reward)callbacks.notify(`Оставили деньги · +${reward} ₽, репутация −5`);}
   if(name==='equip'&&(value===null||a.inventory.includes(value)))a.equipped=value;
   if(name==='garage'){if(buyGarage(state,value)){ensureVan();if(value==='van')a.tracked='van';callbacks.notify('Покупка оплачена');}else callbacks.notify('Покупка недоступна или не хватает денег');}
   if(name==='table')tableCard(state,value);
   if(name==='guard'){const guard=guards.map((g,i)=>({g,i,d:g.mesh.position.distanceTo(world.player.mesh.position)})).sort((p,q)=>p.d-q.d)[0];if(guard)a.tracked='guard:'+guard.i;}
   changed();
  },
  dropMoney(person){const id='npc:'+world.people.indexOf(person);if(a.knocked.includes(id))return;a.knocked.push(id);const drop={id,x:person.mesh.position.x,z:person.mesh.position.z,amount:20+(world.people.indexOf(person)%5)*10,taken:false};a.drops.push(drop);addDrop(drop);changed();},
  shootWater,
  onCrash(speed,vehicle){const own=vehicle?.homeVehicle||vehicle?.id===a.garage.vanId,condition=a.garage.condition,wasCarrying=a.events.delivery.carrying,p=world.player.mesh.position;
   const drop={x:p.x+3,z:p.z+2};crashCargo(state,speed,world.blocked(drop.x,drop.z,.4)?p:drop);if(!own)a.garage.condition=condition;if(wasCarrying&&!a.events.delivery.carrying){a.tracked='delivery';callbacks.notify('Посылка выпала! Подберите её в подсвеченной зоне.');}changed();},
  speedMultiplier(vehicle){return vehicle.homeVehicle||vehicle.id===a.garage.vanId?(state.career.garage.engine?1.15:1)*(.55+.45*a.garage.condition/100):1;},
  prepareWeapons({inVehicle=false,carrying=false,firstPerson=false,pitch=0,attack=0,attackKind='quick'}={}){
   setHeld(a.equipped);const visible=!!heldRig&&!inVehicle&&!carrying&&!a.events.delivery.carrying;
   if(heldRig)heldRig.update({remaining:attack,strong:attackKind==='strong',firstPerson,pitch,visible,gait:(world.player.motion?.diagnostics.stride??0)*Math.PI*2,speed:world.player.motion?.diagnostics.speed??0});world.player.weaponRig=visible?heldRig:null;if(heldRig&&a.equipped==='stone')heldRig.root.traverse(n=>{if(n.name==='held-stone')n.visible=a.stones>0||attack>.38;});
   for(const {person,rig}of policeRigs)rig.update({remaining:person.attack??0,visible:person.mesh.visible&&!person.dead&&person.stun<=0&&!person.climb});
  },
  update(dt,time,{inVehicle=false,carrying=false,firstPerson=false,camera=null,attack=0}={}){
   for(const [index,person]of world.people.entries())if(person.dead){const drop=rollPoliceLoot(state,person,index);if(drop){drop.y=world.parkour.floorAt(drop.x,drop.z,drop.y+.2);addWeaponDrop(drop);changed();}}
   const position=world.player.mesh.position,e=a.events.delivery,pp=e.drop??source;parcel.x=pp.x;parcel.z=pp.z;parcel.group.position.set(pp.x,world.groundHeight(pp.x,pp.z),pp.z);
   for(const item of items){const distance=Math.hypot(item.x-position.x,item.z-position.z);
    if(dt>0&&!inVehicle&&Math.abs(position.y-world.groundHeight(item.x,item.z))<1.8&&item.kind==='money'&&item.enabled()&&distance<1.55&&clearSegment(position,{x:item.x,z:item.z},world.blocked,.05))item.interaction();
    item.group.visible=item.enabled()&&distance<65;if(item.group.visible){const floating=['weapon','pack','money','wallet'].includes(item.kind);if(floating)item.object.rotation.y=time*.8;item.object.position.y=floating?.8+Math.sin(time*2+item.x)*.1:.35;}}
   for(let i=effects.length-1;i>=0;i--){effects[i].life-=dt;if(effects[i].life<=0){root.remove(effects[i].mesh);effects.splice(i,1);}}
   carriedParcel.visible=e.carrying&&!inVehicle;
   for(const {guard,holder} of guardLabels){holder.position.copy(guard.mesh.position);holder.position.y+=.5;holder.visible=guard.mesh.visible;}
   const near=Math.hypot(position.x-court.x,position.z-court.z)<55;if(near!==ballEnabled){ballBody.setEnabled(near);ballEnabled=near;}ball.visible=near;goalRoot.visible=near;
   if(near){ball.position.copy(ballBody.translation());ball.quaternion.copy(ballBody.rotation());if(flight){ballAge+=dt;const p=ballBody.translation();if(Math.hypot(p.x-goal.x,p.z-goal.z)<1.15&&p.y<world.groundHeight(goal.x,goal.z)+1.65){a.fun.goals++;flight=false;if(a.fun.goals>=3&&!a.fun.footballWon){a.fun.footballWon=true;state.money+=30;state.stress=Math.max(0,state.stress-12);callbacks.notify('Три гола! +30 ₽ · стресс −12');}else callbacks.notify(`Гол! ${Math.min(3,a.fun.goals)}/3`);changed();}else if(ballAge>5)flight=false;}}
  },
  get diagnostics(){return {items:items.map(i=>({kind:i.kind,id:i.id,x:i.x,z:i.z,y:i.y,available:i.enabled(),visible:i.group.visible})),guards:guards.map(g=>({x:g.mesh.position.x,z:g.mesh.position.z,name:g.role,shopName:g.shopName})),goal:{...goal},court:{...court},equipped:a.equipped,heldVisible:!!heldRig?.root.visible,heldY:heldRig?.root.position.y??0,heldScale:heldRig?.root.scale.toArray()??[1,1,1],heldBounds:heldRig?new T.Box3().setFromObject(heldRig.root).getSize(new T.Vector3()).toArray():[0,0,0],weaponRig:heldRig?.diagnostics??null,policeWeapons:policeRigs.map(({person,rig})=>({officer:person.policeIndex,...rig.diagnostics})),activeEffects:effects.length};},
  dispose(){heldRig?.dispose();for(const {rig}of policeRigs)rig.dispose();root.removeFromParent();for(const {vest}of guardLabels)vest.removeFromParent();carriedParcel.removeFromParent();world.physics.removeRigidBody(ballBody);for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();for(const t of textures)t.dispose();},
 };
}
