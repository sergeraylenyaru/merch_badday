import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP, point, WORK_STOPS, ROADS, nearRoad, pixel, meetsStreet } from './reference-layout.js';
import { BOROUGHS, LOCAL_SHOPS } from './layout.js';

// Hand-placed against map_reference.png, rather than the approximate preview GLB.
export async function createReferenceCity(scene,world,{human,car,label}) {
 let placedCount=0;
 const root=new T.Group(); root.name='uploaded-reference-city';scene.add(root);
 const placements=new Map(), collision=[], animated=[];
 const clearShop=(u,v,r=0)=>WORK_STOPS.every(s=>Math.abs(u-s.u)>92+r || Math.abs(v-s.v)>74+r);
 function add(name,u,v,scale=1,angle=0,solid=false,force=false){
   if(!force && (!clearShop(u,v,14) || nearRoad(u,v,12))) return;
   const list=placements.get(name)||[];list.push({u,v,scale,angle,solid});placements.set(name,list);
 }
 // Courtyard blocks, with gaps for entrances and paths.
 for(const [u,v,rot,long] of [[110,60,0,1],[280,110,1,0],[190,190,1,1],[70,190,1,1],[350,75,0,0],[440,130,1,1],[570,110,0,0],[570,300,1,1],[330,255,0,0],[430,260,0,0],[70,425,0,0],[190,455,1,1],[290,455,1,1],[425,445,1,1],[340,550,0,0],[170,650,0,0],[570,600,1,1],[420,740,1,0],[110,650,0,0]])
  add(long?'panel_5_story_long':'panel_5_story',u,v,1,rot*Math.PI/2,true);
 for(const [u,v] of [[330,170],[350,500],[110,460],[570,430]])add('playground',u,v,1,0,true);
 for(const [u,v] of [[150,470],[355,520]])add('sandbox',u,v,1,0,true);
 for(const [u,v] of [[90,735],[180,735],[70,85],[175,85]])add('garage',u,v,1,0,true);
 // Park: paths, rides, a civic waterfront pavilion and fountain.
 for(const [name,u,v,scale] of [['carousel',850,175,1.4],['carousel',875,285,1.2],['circus_tent',870,210,1.3],['ride_round',953,242,1.5],['ride_round',720,260,1.2],['fountain_large',850,490,1],['park_stage',860,710,1.5],['kiosk',1000,588,1],['public_toilet',990,680,1]])add(name,u,v,scale,0,true);
 // The uploaded wheel is horizontal. The existing authored vertical wheel is
 // retained here as a recognisable animated Ferris wheel at the map landmark.
 const wheel=new T.Group(),hub=new T.Group();const wp=point(970,110);wheel.position.set(wp.x,0,wp.z);root.add(wheel);hub.position.y=9;wheel.add(hub);
 const metal=new T.MeshStandardMaterial({color:'#f4dfbb',metalness:.5,roughness:.35});
 const rim=new T.Mesh(new T.TorusGeometry(8,.13,6,48),metal);hub.add(rim);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const spoke=new T.Mesh(new T.CylinderGeometry(.05,.05,8,5),metal);spoke.position.set(Math.cos(a)*4,Math.sin(a)*4,0);spoke.rotation.z=a-Math.PI/2;hub.add(spoke);const c=new T.Mesh(new T.BoxGeometry(1.25,1.2,1),new T.MeshStandardMaterial({color:['#cf6250','#e5be5e','#699bb9'][i%3]}));c.position.set(Math.cos(a)*8,Math.sin(a)*8,0);hub.add(c);animated.push(c);}
 for(const x of [-3,3]){const leg=new T.Mesh(new T.CylinderGeometry(.2,.3,10,8),metal);leg.position.set(x,4.5,0);leg.rotation.z=x<0?-.3:.3;wheel.add(leg);}
 // Street furniture follows the main boulevard and residential streets.
 for(let u=80;u<1660;u+=120){add('streetlight',u,310,1,0,false,true);add('streetlight',u+45,370,1,0,false,true);}
 for(const u of [215,520,1130,1410])add('bus_stop',u,305,1,0,true,true);
 // Downtown landmark footprints follow the map; work stores retain interiors.
 for(const [name,u,v,scale] of [['office_tower',1230,90,1],['office_midrise',1320,105,1],['city_hall',1490,160,1.5],['office_round_tower',1600,170,1.25],['office_midrise',1230,460,1.15],['office_tower',1510,450,1.1],['office_tower',1610,400,1.1],['bank',1460,100,1],['fountain_large',1480,265,.85],['warehouse',1480,710,1]])add(name,u,v,scale,0,true);
 LOCAL_SHOPS.forEach((s,i)=>{const p=pixel(s.x,s.z);add(i<2?'shop_small':i<4?'cafe':'shop_supermarket',p.x,p.y,1,0,true,true);label(s.name,s.x,6,s.z+4,'#ffe5ab',1.4);});
 // Deterministic vegetation fills parkland and courtyards, avoiding stores,
 // streets, waterways and landmark footprints.
 let seed=1971;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1400;i++){
  const u=35+random()*1600,v=30+random()*740;
  if(!clearShop(u,v,8)||nearRoad(u,v,20)||isReferenceWater(u,v))continue;
  if([...placements].some(([n,list])=>!['tree','shrub','bench','trash_bin','streetlight','bus_stop'].includes(n)&&list.some(p=>Math.hypot(u-p.u,v-p.v)<45)))continue;
  add(i%5?'tree':'shrub',u,v,.85+random()*.45);
 }
 for(const [u,v] of [[150,215],[320,210],[370,540],[720,455],[910,420],[1010,530],[1430,290],[1500,610]]){add('bench',u,v,1,0,true);add('trash_bin',u+12,v,1,0,true);}
 for(const [u,v] of [[170,110],[300,560],[550,660]])add('dumpsters',u,v,1,0,true);
 // Parking rows use the existing drivable vehicle models.
 for(const [u,v] of [[160,400],[360,680],[570,150],[1240,690]]){
  add('parking_lot',u,v,1,0,false);
  for(let i=0;i<3;i++){const p=point(u+(i-1)*14,v);if(!clearShop(u+(i-1)*14,v,12))continue;world.vehicles.push(car(p.x,p.z,i%3,world.vehicles.length));}
 }
 for(let i=0;i<6;i++){const [u,v]=[[160,215],[320,210],[370,540],[720,455],[910,420],[1430,290]][i];if(!clearShop(u,v))continue;const p=point(u,v);const person=human(p.x,.5+p.z,'#82806e','resident');person.role=i<3?'Жительница у подъезда':'Отдыхает в парке';person.seated=true;person.activity={id:'bench-'+i,clip:'Drive',duration:1,remaining:1};world.people.push(person);}
 const loader=new GLTFLoader();
 const material=new T.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.8});
 await Promise.all([...placements].map(async([name,list])=>{
  const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/city-pack/${name}.glb`);
  const geometries=[];gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(n=>{if(!n.isMesh)return;let g=n.geometry.clone().applyMatrix4(n.matrixWorld);g.rotateX(-Math.PI/2);if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}if(!g.attributes.normal)g.computeVertexNormals();for(const attr of Object.keys(g.attributes))if(!['position','normal','color'].includes(attr))g.deleteAttribute(attr);if(!g.attributes.color)g.setAttribute('color',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*3).fill(1),3));geometries.push(g);});
  const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());geometry.computeBoundingBox();const b=geometry.boundingBox;
  list=list.filter(p=>{if(!p.solid)return true;const pos=point(p.u,p.v);return !meetsStreet(pos.x,pos.z,(b.max.x-b.min.x)*p.scale,(b.max.z-b.min.z)*p.scale,p.angle);});
  placedCount+=list.length;
  const instances=new T.InstancedMesh(geometry,material,list.length);instances.name='city-pack-'+name;instances.castShadow=true;instances.receiveShadow=true;
  const matrix=new T.Matrix4(),q=new T.Quaternion();
  list.forEach((p,i)=>{const pos=point(p.u,p.v);q.setFromAxisAngle(new T.Vector3(0,1,0),p.angle);matrix.compose(new T.Vector3(pos.x,.006-b.min.y*p.scale,pos.z),q,new T.Vector3().setScalar(p.scale));instances.setMatrixAt(i,matrix);
   if(p.solid){const w=(b.max.x-b.min.x)*p.scale,d=(b.max.z-b.min.z)*p.scale,h=(b.max.y-b.min.y)*p.scale;const proxy=world.box(pos.x,h/2,pos.z,Math.abs(Math.cos(p.angle))*w+Math.abs(Math.sin(p.angle))*d,h,Math.abs(Math.sin(p.angle))*w+Math.abs(Math.cos(p.angle))*d,'#70796d',true);proxy.visible=false;collision.push(proxy);}
  });root.add(instances);gltf.scene.traverse(n=>{if(n.isMesh){n.geometry.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});
 }));
 return {diagnostics:{boroughs:BOROUGHS,localShops:LOCAL_SHOPS,source:'user-map',modelTypes:placements.size,placements:placedCount},update(dt){hub.rotation.z+=dt*.09;for(const cabin of animated)cabin.rotation.z=-hub.rotation.z;},dispose(){root.traverse(n=>{n.geometry?.dispose();});material.dispose();root.removeFromParent();}};
}

// Water is impassable, except at mapped road/foot bridges. Use the same
// definition for rendering, walking and vehicles, so banks cannot swallow feet.
export function isReferenceWater(u,v){
 if(v>815 && !(u>1370&&u<1410))return true;
 const left=625+(v>650?-(v-650)*.18:v<150?(150-v)*.4:0);
 const right=1120+(v>650?(v-650)*.2:v<200?-(200-v)*.2:0);
 const river=Math.abs(u-left)<12 || (v<740&&Math.abs(u-right)<11);
 const bridge=(v>320&&v<365)||(v>60&&v<95)||(v>680&&v<725)||(v>460&&v<500);
 return river&&!bridge;
}
export function buildReferenceTerrain(world,scene){
 for(const [a,b,c,d,width] of ROADS){
  const start=point(a,b),end=point(c,d),length=Math.hypot(end.x-start.x,end.z-start.z),angle=Math.atan2(end.x-start.x,end.z-start.z);
  const road=world.box((start.x+end.x)/2,.009,(start.z+end.z)/2,width*MAP.scale,.012,length,'#414f59');road.rotation.y=angle;
  for(let t=3;t<length;t+=7){const paint=world.box(start.x+Math.sin(angle)*t,.018,start.z+Math.cos(angle)*t,.15,.002,2.4,'#dfdfbf');paint.rotation.y=angle;}
 }
 // Narrow surface tiles follow the rivers rather than the preview's grid.
 const water=[];
 for(let v=0;v<941;v+=8)for(let u=0;u<1672;u+=8)if(isReferenceWater(u+4,v+4))water.push(point(u+4,v+4));
 const tiles=new T.InstancedMesh(new T.BoxGeometry(2.4,.008,2.4),new T.MeshStandardMaterial({color:'#287f9d',roughness:.25,metalness:.2}),water.length),matrix=new T.Matrix4();
 water.forEach((p,i)=>tiles.setMatrixAt(i,matrix.makeTranslation(p.x,.005,p.z)));scene.add(tiles);
 // Beach and promenade under the park, as shown on the supplied map.
 for(const [u,v,w,d,color] of [[875,800,450,26,'#d7bf88'],[875,778,450,12,'#bdb7a4']]){const p=point(u,v);world.box(p.x,.012,p.z,w*.3,.008,d*.3,color);}
 // Footpaths connect the park entrances to the fountain and promenade.
 for(const [u,v,w,d] of [[850,515,14,440],[855,400,410,14],[850,745,475,15],[775,110,16,90]]){const p=point(u,v);world.box(p.x,.012,p.z,w*.3,.008,d*.3,'#bcad8e');}
}
