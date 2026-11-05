import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sceneBuilder} from './scene-builder.js';
import {COAST_HOMES,MANSION,QUAY_RANGE,coastPixelAt,planCoastDecks,coastFloorAt,inMansionGrounds} from './coast-layout.js';
import {point,MAP,isReferenceWater,pixel} from './reference-layout.js';
import {guardGun,GUARD_PISTOL} from '../npc/guard-gun.js';
import {equipmentRay} from '../adventure/aim.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export async function createCoast(scene,world,state,{human}){
 const b=sceneBuilder(scene,world,'three-coastal-neighborhoods'),floors=planCoastDecks(),benches=[],guards=[],landmarks=[],graniteParts=[];
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');let seed=73;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let x=0;x<4;x++)for(let y=0;y<4;y++){const shade=165+Math.floor(random()*22);ctx.fillStyle=`rgb(${shade},${shade+5},${shade+8})`;ctx.fillRect(x*32,y*32,32,32);}for(let i=0;i<1800;i++){const shade=random()>.5?225:95;ctx.fillStyle=`rgba(${shade},${shade},${shade},.2)`;ctx.fillRect(Math.floor(random()*128),Math.floor(random()*128),1,1);}ctx.strokeStyle='#747c7c';ctx.lineWidth=1;for(let i=0;i<=128;i+=32){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,128);ctx.moveTo(0,i);ctx.lineTo(128,i);ctx.stroke();}const graniteTexture=new T.CanvasTexture(canvas);graniteTexture.wrapS=graniteTexture.wrapT=T.RepeatWrapping;graniteTexture.colorSpace=T.SRGBColorSpace;b.textures.push(graniteTexture);
 const box=b.box;
 function cyl(x,y,z,r,h,color){b.geometry(new T.CylinderGeometry(r,r,h,10),color,new T.Vector3(x,y,z));}
 function sphere(x,y,z,sx,sy,sz,color){const g=sx<.1?new T.OctahedronGeometry(1,0):new T.SphereGeometry(1,10,6);g.scale(sx,sy,sz);b.geometry(g,color,new T.Vector3(x,y,z));}
 function fence(a,c,height=1.05,color='#314b48',gap=null){const dx=c.x-a.x,dz=c.z-a.z,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz),steps=Math.max(1,Math.ceil(length/1.6));for(let i=0;i<steps;i++){const lo=i/steps,hi=(i+1)/steps,m=(lo+hi)/2,x=a.x+dx*m,z=a.z+dz*m;if(gap&&gap(x,z))continue;const len=length/steps;
   for(const h of [.18,height-.08])b.geometry(new T.BoxGeometry(.08,.07,len+.03),color,new T.Vector3(x,.08+h,z),new T.Euler(0,angle,0));
   for(let j=0;j<5;j++){const t=(i+j/5)/steps,px=a.x+dx*t,pz=a.z+dz*t;box(px,.08+height/2,pz,.035,height,.035,color);sphere(px,.08+height+.03,pz,.05,.07,.05,'#59625a');}
   const proxy=world.box(x,.08+height/2,z,Math.abs(dx)/steps+.13,height,Math.abs(dz)/steps+.13,color,true);proxy.visible=false;
  }}
 function lamp(x,z,height=4.7){cyl(x,height/2,z,.055,height,'#344d49');cyl(x,.16,z,.20,.32,'#5b6860');for(const side of [-1,1]){box(x+side*.38,height-.2,z,.78,.065,.07,'#344d49');box(x+side*.72,height-.05,z,.37,.55,.37,'#ecd9a2');const cap=new T.ConeGeometry(.3,.19,4);b.geometry(cap,'#35504a',new T.Vector3(x+side*.72,height+.31,z),new T.Euler(0,Math.PI/4,0));}}
 function bench(x,z,heading,id){const parts=[];const add=(px,py,pz,w,h,d,color)=>{const g=new T.BoxGeometry(w,h,d);g.translate(px,py,pz);g.rotateY(heading);g.translate(x,0,z);const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));parts.push(g);};for(const dx of [-.85,.85]){add(dx,.25,0,.1,.5,.65,'#314a45');add(dx,.75,-.28,.1,.9,.1,'#314a45');}add(0,.52,0,2.2,.13,.64,'#927350');add(0,.9,-.28,2.2,.6,.1,'#ac8b63');const geometry=mergeGeometries(parts),material=new T.MeshStandardMaterial({vertexColors:true,roughness:.9}),mesh=new T.InstancedMesh(geometry,material,1);parts.forEach(g=>g.dispose());mesh.setMatrixAt(0,new T.Matrix4());mesh.castShadow=mesh.receiveShadow=true;b.root.add(mesh);b.owned.push(geometry);b.materials.push(material);benches.push({id,x,z,heading});const w=Math.abs(Math.cos(heading))*2.2+Math.abs(Math.sin(heading))*.7,d=Math.abs(Math.sin(heading))*2.2+Math.abs(Math.cos(heading))*.7,proxy=world.box(x,.62,z,w,1.24,d,'#9a7957',true);proxy.visible=false;world.props.register({key:id,id:'bench-wood',x,z,heading,seatHeight:.585-Math.max(0,coastFloorAt(floors,x,z)),seatBaseY:Math.max(0,coastFloorAt(floors,x,z)),footprint:{x,z,w:w/2,d:d/2},proxy,instances:[{mesh,index:0}]});}
 for(const floor of floors){
  const colour=floor.kind==='granite-quay'?'#afa99e':floor.kind==='water-stair'?'#908f85':floor.kind==='residential-path'?'#b7ac95':'#b5a47d';
  let g;
  if(floor.polygon){const positions=[];for(const i of [0,2,1,0,3,2]){const p=floor.polygon[i];positions.push(p.x,floor.y,p.z);}g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex([0,1,2,3,4,5]);g.computeVertexNormals();world.terrainCollider(g);b.owned.push(g);if(floor.kind==='granite-quay'){const uv=[];for(let i=0;i<g.attributes.position.count;i++)uv.push(g.attributes.position.getX(i)/2,g.attributes.position.getZ(i)/2);g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));graniteParts.push(g.clone());}else b.geometry(g,colour);}
  else{g=new T.PlaneGeometry(floor.w*2,floor.d*2).rotateX(-Math.PI/2).rotateY(floor.heading).translate(floor.x,floor.y,floor.z);world.terrainCollider(g);b.owned.push(g);if(floor.kind!=='public-pier')b.geometry(new T.BoxGeometry(floor.w*2,.12,floor.d*2),colour,new T.Vector3(floor.x,floor.y-.06,floor.z),new T.Euler(0,floor.heading,0));}
  if(floor.kind==='granite-quay'){
   const nx=Math.cos(floor.heading),nz=-Math.sin(floor.heading),x=floor.x-nx*floor.w,z=floor.z-nz*floor.w;
   b.geometry(new T.BoxGeometry(.45,1.8,floor.d*2+.08),'#8e918a',new T.Vector3(x,-.85,z),new T.Euler(0,floor.heading,0));
  }
 }
 if(graniteParts.length){const geometry=mergeGeometries(graniteParts),material=new T.MeshStandardMaterial({map:graniteTexture,color:'#a7b2b4',roughness:1}),mesh=new T.Mesh(geometry,material);mesh.receiveShadow=true;b.root.add(mesh);b.owned.push(geometry);b.materials.push(material);graniteParts.forEach(g=>g.dispose());}
 // The waterside rail follows the actual shore and leaves both stair openings.
 for(let u=650;u<1110;u+=12){const end=Math.min(u+12,1110),a=point(u,coastPixelAt(u)+3.4),c=point(end,coastPixelAt(end)+3.4);fence(a,c,1.05,'#304b46',(x,z)=>[735,1010].some(s=>Math.abs(x-point(s,0).x)<1.55)||Math.abs(x-point(865,0).x)<4.8);}
 for(let u=675;u<1110;u+=50){const p=point(u,coastPixelAt(u)-17);lamp(p.x,p.z);if(u%100===75){const q=point(u+10,coastPixelAt(u+10)-21);bench(q.x,q.z,0,'quay-bench:'+u);}}
 for(const u of [735,1010]){const p=point(u,coastPixelAt(u)+4);for(const side of [-1,1])for(let i=0;i<12;i++){const z=p.z+(i+.5)*.45,y=.08-i*.1;box(p.x+side*1.5,y+.43,z,.07,.86,.47,'#445b53');}}
 // Decorative mooring bollards give the central pier a purpose without lights per prop.
 for(const u of [854,876])for(const v of [851,872]){const p=point(u,v);cyl(p.x,.28,p.z,.14,.4,'#4c5b54');box(p.x,.43,p.z,.6,.12,.16,'#4c5b54');}
 for(const f of floors.filter(f=>f.kind==='residential-path')){const p=pixel(f.x,f.z);if(isReferenceWater(p.x,p.y)){const a=f.polygon[0],c=f.polygon[1],d=f.polygon[2],e=f.polygon[3];fence(a,c,.9,'#6d7761');fence(e,d,.9,'#6d7761');for(const x of [a.x,c.x])box(x,-.8,f.z,.18,1.8,.18,'#6a7562');}}
 const quay=point(850,coastPixelAt(850)-18);landmarks.push({...quay,id:'park-quay',name:'Гранитная набережная',detail:'Фонари, лавки, спуски к воде и общественный причал'});
 for(const [index,home]of COAST_HOMES.entries()){
  const {x,z,w,d,color}=home;box(x,1.7,z,w*2,3.4,d*2,color,true);box(x,3.55,z,w*2+.5,.3,d*2+.5,'#e0d5b6');
  const roof=new T.ConeGeometry(Math.hypot(w+.5,d+.5),1.8,4);roof.scale(1,1,(d+.5)/(w+.5));b.geometry(roof,index%2?'#667b70':'#885b48',new T.Vector3(x,4.4,z),new T.Euler(0,Math.PI/4,0));box(x+w*.6,4.7,z-.8,.45,1.9,.45,'#857264');
  box(x,1.1,z+d+.03,1,2.2,.08,'#6a6752');for(const dx of [-2.25,2.25]){box(x+dx,1.85,z+d+.05,1.35,1.3,.08,'#7b9a9a');for(const side of [-1,1])box(x+dx+side*.78,1.85,z+d+.1,.23,1.5,.13,index%2?'#e2dac4':'#7b5b49');box(x+dx,1.85,z+d+.12,.06,1.3,.08,'#d4cead');box(x+dx,1.85,z+d+.12,1.35,.06,.08,'#d4cead');}
  b.sign(b.root,home.name,2.5,.35,x,2.85,z+d+.15,{background:color,color:'#f4e5c8'});
  const yard={minX:x-6.2,maxX:x+6.2,minZ:z-5.2,maxZ:z+7.1};fence({x:yard.minX,z:yard.minZ},{x:yard.minX,z:yard.maxZ},.9,'#8a8570');fence({x:yard.maxX,z:yard.minZ},{x:yard.maxX,z:yard.maxZ},.9,'#8a8570');fence({x:yard.minX,z:yard.maxZ},{x:yard.maxX,z:yard.maxZ},.9,'#8a8570',(px)=>Math.abs(px-x)<1.3);
  box(x,.05,z+d+1.2,2,.1,2.5,'#aaa28b');if(index%2===0)bench(x+4,z+4.8,0,'village-bench:'+index);
 }
 const village=point(270,coastPixelAt(270)-18);landmarks.push({...village,id:'seaside-homes',name:'Причальная улица',detail:'Небольшие дома, садики и деревянный причал'});
 const s=MANSION;
 box(s.x,.012,s.z,s.w*2,.024,s.d*2,'#72836c');box(s.x,3.8,s.z,s.buildingW*2,7.6,s.buildingD*2,'#d1c5aa',true);box(s.x,7.85,s.z,s.buildingW*2+1,.5,s.buildingD*2+1,'#d8d0b7');box(s.x,8.16,s.z,s.buildingW*2,.12,s.buildingD*2,'#63786d');
 for(const side of [-1,1])for(const y of [2.1,5.8])for(const dx of [-8,-4,0,4,8]){box(s.x+dx,y,s.z+side*(s.buildingD+.04),1.6,2.1,.08,'#718886');box(s.x+dx,y+1.17,s.z+side*(s.buildingD+.1),1.95,.19,.32,'#e8ddc0');box(s.x+dx,y-1.17,s.z+side*(s.buildingD+.1),1.95,.16,.3,'#e8ddc0');}
 // Pale dressed stone, pilasters, cornices and a usable entrance balcony.
 for(const y of [.28,4.2,7.65])box(s.x,y,s.z,s.buildingW*2+.42,.22,s.buildingD*2+.4,'#e6dcc4');
 for(const dx of [-10.8,-6,6,10.8])for(const side of [-1,1]){box(s.x+dx,3.9,s.z+side*(s.buildingD+.14),.42,7.4,.22,'#ded1b3');box(s.x+dx,7.45,s.z+side*(s.buildingD+.22),.66,.28,.4,'#e8ddc4');}
 const balcony={x:s.x,z:s.z-s.buildingD-1.35,w:6.1,d:1.4,y:4.35};
 box(balcony.x,4.2,balcony.z,12.2,.3,2.8,'#d6c9a9',true);world.parkourSurfaces.push(balcony);
 for(const dx of [-5.6,5.6]){cyl(s.x+dx,2.0,balcony.z-.7,.21,4,'#e4d7ba');cyl(s.x+dx,.16,balcony.z-.7,.36,.3,'#c4b696');}
 for(const dx of [-5.8,5.8])box(s.x+dx,4.85,balcony.z,.12,1,2.6,'#39564f');
 for(let dx=-5.8;dx<=5.8;dx+=.38){box(s.x+dx,4.85,balcony.z-1.3,.045,.94,.045,'#39564f');sphere(s.x+dx,5.34,balcony.z-1.3,.055,.055,.055,'#9e946e');}
 box(s.x,5.34,balcony.z-1.3,12,.08,.09,'#39564f');
 const pediment=new T.Shape();pediment.moveTo(-6,0);pediment.lineTo(0,2.1);pediment.lineTo(6,0);pediment.closePath();const pedimentGeometry=new T.ExtrudeGeometry(pediment,{depth:.45,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:1,steps:1});b.geometry(pedimentGeometry,'#d6c9aa',new T.Vector3(s.x,7.9,s.z-s.buildingD-.25));
 b.sign(b.root,'СЕМЕЙНАЯ РЕЗИДЕНЦИЯ',5.4,.36,s.x,7.12,s.z-s.buildingD-.19,{heading:Math.PI,color:'#e6d7ad',background:'#354c43'});
 world.roofs.push({...balcony,id:'coast-mansion-balcony',kind:'balcony',ladder:{x:s.x-6.2,z:balcony.z,nx:-1,nz:0,exit:{x:s.x-5.4,z:balcony.z,y:balcony.y}}});
 for(const dx of [-6,-2,2,6]){cyl(s.x+dx,3.25,s.z+s.buildingD+1.9,.22,6.5,'#dfd4b9');cyl(s.x+dx,.2,s.z+s.buildingD+1.9,.42,.4,'#d8ceb1');}box(s.x,6.75,s.z+s.buildingD+1.8,15,.35,4.4,'#d5c9ab');
 b.sign(b.root,'ЧАСТНАЯ ТЕРРИТОРИЯ',8,.65,s.x,2.1,s.z-s.buildingD-.08,{background:'#3d554b',color:'#e3d2aa',heading:Math.PI});
 const nw={x:s.x-s.w,z:s.z-s.d},ne={x:s.x+s.w,z:s.z-s.d},sw={x:s.x-s.w,z:s.z+s.d},se={x:s.x+s.w,z:s.z+s.d};fence(nw,ne,2.1,'#334a42',x=>Math.abs(x-s.x)<4.3);fence(ne,se,2.1,'#334a42');fence(se,sw,2.1,'#334a42');fence(sw,nw,2.1,'#334a42');
 for(const x of [s.x-4.6,s.x+4.6]){box(x,1.35,s.z-s.d,.65,2.7,.65,'#bcb69f',true);sphere(x,2.9,s.z-s.d,.4,.28,.4,'#d5ceb5');}
 box(s.x-15,1.4,s.z-13,3,2.8,3,'#b6b49c',true);box(s.x-15,2,s.z-14.55,2.5,.8,.08,'#5c7e80');box(s.x-15,2.95,s.z-13,3.5,.3,3.5,'#52665b');
 // Driveway and an open eight-metre gate connect the grounds to the road.
 box(s.x,.018,s.z-s.d-.5,8,.036,1.3,'#b0aa97');box(s.x,.025,s.z-14.6,4,.05,5,'#a9a28e');box(s.x+8,.025,s.z-12.6,20,.05,4,'#a9a28e');box(s.x+16,.025,s.z+1,4,.05,30,'#a9a28e');box(s.x+7,.025,s.z+12,22,.05,4,'#bdb49e');
 for(const dx of [-16,16])for(const dz of [11,-10]){sphere(s.x+dx,.8,s.z+dz,1.3,.8,1.2,'#5d775a');lamp(s.x+dx,s.z+dz,3.8);}
 const pool={x:s.x+4.2,z:s.z+11.8,w:5.4,d:2.1,waterY:.48};
 box(pool.x,.08,pool.z,13,.16,6.5,'#cbbd9d');world.addSurface(pool.x,pool.z,13,6.5,.16);box(pool.x,.12,pool.z,10.8,.08,4.2,'#6aa6ab');
 for(const side of [-1,1]){box(pool.x+side*5.55,.35,pool.z,.3,.7,4.8,'#ece0c6',true);box(pool.x,.35,pool.z+side*2.25,11.4,.7,.3,'#ece0c6',true);}
 const poolMaterial=new T.MeshStandardMaterial({color:'#4ab8cc',transparent:true,opacity:.84,metalness:.25,roughness:.22}),poolGeometry=new T.PlaneGeometry(10.8,4.2).rotateX(-Math.PI/2),poolMesh=new T.Mesh(poolGeometry,poolMaterial);poolMesh.position.set(pool.x,pool.waterY,pool.z);poolMesh.name='mansion-swimming-pool';b.root.add(poolMesh);b.materials.push(poolMaterial);b.owned.push(poolGeometry);
 for(let i=0;i<3;i++)box(pool.x-3,.1+i*.12,pool.z+3.2-i*.25,1.5,.2+i*.24,.4,'#c7bba0',true);
 for(const dx of [-2.8,0]){box(s.x+dx, .45,s.z+15,1.4,.1,1.1,'#e0d4b6');const lounge=new T.BoxGeometry(1.4,.08,.85);b.geometry(lounge,'#d8c9a8',new T.Vector3(s.x+dx,.70,s.z+15.7),new T.Euler(-.65,0,0));}
 const statue=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/estate/emperor.glb`);statue.scene.position.set(s.x-15.8,.02,s.z+6.3);statue.scene.rotation.y=0;statue.scene.traverse(n=>{if(n.isMesh){n.castShadow=n.receiveShadow=true;b.owned.push(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])b.materials.push(m);}});b.root.add(statue.scene);
 box(s.x-15.8,.65,s.z+6.3,2.2,1.3,2.2,'#c6b99b',true);b.sign(b.root,'ИМПЕРАТОР',1.2,.25,s.x-15.8,.73,s.z+5.18,{heading:Math.PI,background:'#536b5a',color:'#ded1a3'});
 world.roofs.push({id:'coast-mansion-roof',x:s.x,z:s.z,w:s.buildingW,d:s.buildingD,y:8.22,kind:'mansion',ladder:{x:s.x-s.buildingW-.12,z:s.z-2,nx:-1,nz:0,exit:{x:s.x-s.buildingW+1.5,z:s.z-2,y:8.22}}});
 const posts=[[-4,-15.3],[4,-15.3],[-16,2],[16,1],[-14,13],[13,13]];
 for(const [i,[dx,dz]]of posts.entries()){const n=human(s.x+dx,s.z+dz,'#293f3b','guard');n.role=['Старший охраны','Охрана ворот','Охрана сада','Патруль особняка','Охрана террасы','Охрана берега'][i];n.mansionGuard=true;n.weapon='pistol';n.guardIndexLocal=i;n.shopName='Особняк на берегу';n.entrance={x:s.x+dx,z:s.z+dz};n.shopPosition={x:s.x,z:s.z};n.guardRoute=[{x:s.x+dx,z:s.z+dz},{x:s.x+dx*.8,z:s.z+dz*.8}];n.guardRouteIndex=0;world.people.push(n);guards.push(n);}
 landmarks.push({x:s.x,z:s.z-s.d-1,id:s.id,name:s.name,detail:'Частная территория: ворота, сад и шесть охранников'});
 b.finish();
 const floorAt=(x,z)=>coastFloorAt(floors,x,z);let callbacks={},wasInside=false;
 return {setCallbacks(c){callbacks=c;},update(){const inside=inMansionGrounds(world.player.mesh.position);if(inside&&!wasInside)callbacks.notify?.('Частная территория. Охрана требует выйти; через 3 секунды откроет огонь.');wasInside=inside;},addresses:COAST_HOMES.map(h=>({x:h.x,z:h.z+5,label:h.name+' · у калитки',coastal:true})),walkwayNodes:floors.filter(f=>f.kind!=='water-stair').map(f=>({x:f.x,z:f.z,kind:'walk',lookAt:{x:f.x,z:f.z+3}})).concat(COAST_HOMES.map(h=>({...point(h.u,coastPixelAt(h.u)-17),kind:'walk',lookAt:{x:h.x,z:h.z}}))),floorAt,walkable:(x,z)=>floorAt(x,z)>-Infinity,landmarks,guardIntent(n,player,dt,inVehicle=false){
  n.anger=Math.max(0,(n.anger??0)-dt);const privateArea=inMansionGrounds(player),p=n.mesh.position,d=p.distanceTo(player);
  if(privateArea||n.anger>0){
   n.guardAlert=(n.guardAlert??0)+dt;n.lookAt=player;
   if(n.guardAlert<3&&!n.anger)return {target:null,speed:0,damage:0};
   const to=player.clone().add(new T.Vector3(0,1,0));
   n.weaponRig?.update({aimAt:to,visible:n.mesh.visible&&n.stun<=0});
   const from=n.weaponRig?.root.getObjectByName('Muzzle')?.getWorldPosition(new T.Vector3())??p.clone().add(new T.Vector3(0,1.4,0)),direction=to.clone().sub(from),range=direction.length();
   const clear=equipmentRay(world,from,direction.normalize(),range,{people:false}).distance>=range-.05;
   const result=guardGun(n,{hostile:true,distance:d,clear},dt);n.attack=0;
   return {target:d>GUARD_PISTOL.range-4||!clear?player:null,speed:4.2,damage:result.damage,shot:result.shot};
  }
  n.guardAlert=0;n.attack=0;n.lookAt=null;guardGun(n,{hostile:false},dt);
  const route=n.guardRoute,target=route[n.guardRouteIndex];if(Math.hypot(p.x-target.x,p.z-target.z)<.3)n.guardRouteIndex=(n.guardRouteIndex+1)%route.length;
  return {target,speed:.9,damage:0};
 },get diagnostics(){return {quay:QUAY_RANGE,homes:COAST_HOMES,mansion:{...MANSION,balcony,pool,statue:{x:s.x-15.8,z:s.z+6.3,model:'models/estate/emperor.glb'}},benches,landmarks,stairs:24,floors: floors.map(f=>({...f})),guards:guards.length};},dispose:b.dispose};
}
