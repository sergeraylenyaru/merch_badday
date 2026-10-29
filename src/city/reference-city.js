import {gridTerrain,ROAD_PROFILES,WATER_LEVEL} from './terrain.js';
import {createCityMaterialPool} from './shared-materials.js';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {prepareCityAsset} from './city-assets.js';
import {MAP_BUILDINGS} from './map-buildings.js';
import { MAP, point, WORK_STOPS, ROADS, nearRoad, pixel, meetsStreet, rawWater, isReferenceWater, PIER, ROUNDABOUT, COAST } from './reference-layout.js';
export {isReferenceWater} from './reference-layout.js';
import { BOROUGHS, LOCAL_SHOPS } from './layout.js';
import { createUrbanDetails } from './urban-details.js';

// Hand-placed against map_reference.png, rather than the approximate preview GLB.
export async function createReferenceCity(scene,world,{human,car,label}) {
 let placedCount=0;
 const root=new T.Group(); root.name='uploaded-reference-city';scene.add(root);
 const placements=new Map(), collision=[], animated=[], preparedAssets=[];
 const traced=[];
 const clearShop=(u,v,r=0)=>WORK_STOPS.every(s=>Math.abs(u-s.u)>52+r || Math.abs(v-s.v)>44+r);
 function add(name,u,v,scale=1,angle=0,solid=false,force=false){
   if(!force && (!clearShop(u,v,14) || nearRoad(u,v,12))) return;
   const list=placements.get(name)||[];list.push({u,v,scale,angle,solid});placements.set(name,list);
 }
 // Measured footprint placement replaces guessed scales and broad exclusions.
 for(const [name,u,v,width,depth,angle] of MAP_BUILDINGS){
   const list=placements.get(name)||[];list.push({u,v,width,depth,angle:angle*Math.PI/180,scale:1,solid:true,traced:true});placements.set(name,list);
 }
 for(const v of [48,90,710,744])for(let i=0;i<10;i++){
  const u=56+i*16,list=placements.get('garage')||[];list.push({u,v,width:14,depth:26,angle:0,scale:1,solid:true,traced:true});placements.set('garage',list);
 }
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
 add('fountain_large',1483,253,1,0,true,true);
 LOCAL_SHOPS.forEach((s,i)=>{const p=pixel(s.x,s.z);add(i<2?'shop_small':i<4?'cafe':'shop_supermarket',p.x,p.y,1,0,true,true);label(s.name,s.x,6,s.z+4,'#ffe5ab',1.4);});
 // Deterministic vegetation fills parkland and courtyards, avoiding stores,
 // streets, waterways and landmark footprints.
 let seed=1971;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<1400;i++){
  const u=35+random()*1600,v=30+random()*740;
  if(!clearShop(u,v,8)||nearRoad(u,v,20)||isReferenceWater(u,v))continue;
  if([...placements].some(([n,list])=>!['tree','shrub','bench','trash_bin','streetlight','bus_stop'].includes(n)&&list.some(p=>(p.width?Math.abs(u-p.u)<p.width/2+12&&Math.abs(v-p.v)<p.depth/2+12:Math.hypot(u-p.u,v-p.v)<45))))continue;
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
 const loader=new GLTFLoader(),materialPool=createCityMaterialPool();
 const cacheWasEnabled=T.Cache.enabled,previousKeys=new Set(Object.keys(T.Cache.files));T.Cache.enabled=true;
 try {
 await Promise.all([...placements].map(async([name,list])=>{
  const gltf=await loader.loadAsync(`${import.meta.env.BASE_URL}models/city-pack/${name}.glb?pbr=1`);
  const asset=prepareCityAsset(gltf.scene,materialPool);preparedAssets.push(asset);const b=asset.bounds;
  const nativeW=b.max.x-b.min.x,nativeD=b.max.z-b.min.z,nativeH=b.max.y-b.min.y;
  list=list.map(p=>{
    const c=Math.abs(Math.cos(p.angle)),s=Math.abs(Math.sin(p.angle));
    const sx=p.width?(p.width*MAP.scale)/(c*nativeW+s*nativeD):p.scale;
    const sz=p.depth?(p.depth*MAP.scale)/(s*nativeW+c*nativeD):p.scale;
    const scale=new T.Vector3(sx,p.scale,sz);
    // swap dimensions for a 90-degree building rotation
    if(p.width&&s>.5){scale.x=sz;scale.z=sx;}
    const width=c*nativeW*scale.x+s*nativeD*scale.z,depth=s*nativeW*scale.x+c*nativeD*scale.z;
    return {...p,scaleVector:scale,worldWidth:width,worldDepth:depth};
  }).filter(p=>!p.solid||!meetsStreet(point(p.u,p.v).x,point(p.u,p.v).z,p.worldWidth,p.worldDepth));
  placedCount+=list.length;
  for(const p of list){
    if(p.traced)traced.push({model:name,u:p.u,v:p.v,width:p.worldWidth/MAP.scale,depth:p.worldDepth/MAP.scale});
    if(p.solid){const pos=point(p.u,p.v),h=nativeH*p.scale;const proxy=world.box(pos.x,h/2,pos.z,p.worldWidth,h,p.worldDepth,'#70796d',true);proxy.visible=false;collision.push(proxy);}
  }
  const matrix=new T.Matrix4(),q=new T.Quaternion(),center=b.getCenter(new T.Vector3());center.y=b.min.y;
  for(const [index,batch]of asset.batches.entries()){
    const instances=new T.InstancedMesh(batch.geometry,batch.material,list.length);instances.name=`city-pack-${name}-${index}`;instances.castShadow=true;instances.receiveShadow=true;
    list.forEach((p,i)=>{
      const pos=point(p.u,p.v);q.setFromAxisAngle(new T.Vector3(0,1,0),p.angle);
      const origin=center.clone().multiply(p.scaleVector).applyQuaternion(q).negate().add(new T.Vector3(pos.x,.006,pos.z));
      matrix.compose(origin,q,p.scaleVector);instances.setMatrixAt(i,matrix);
    });root.add(instances);
  }
 }));
 } finally {
  T.Cache.enabled=cacheWasEnabled;
  for(const key of Object.keys(T.Cache.files))if(!previousKeys.has(key)&&key.includes("models/city-pack/"))T.Cache.remove(key);
 }
 materialPool.finishLoading();
 const urbanDetails=createUrbanDetails(scene,world,point);
 return {diagnostics:{assetRevision:"pbr-1",resources:materialPool.diagnostics,boroughs:BOROUGHS,localShops:LOCAL_SHOPS,source:'user-map',modelTypes:placements.size,placements:placedCount,tracedBuildings:traced,urbanDetails:urbanDetails.diagnostics},update(dt){hub.rotation.z+=dt*.09;for(const cabin of animated)cabin.rotation.z=-hub.rotation.z;},dispose(){urbanDetails.dispose();preparedAssets.forEach(a=>a.dispose());materialPool.dispose();root.traverse(n=>{if(n.isMesh&&!n.isInstancedMesh){n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});root.removeFromParent();}};
}

export function buildReferenceTerrain(world,scene){
 const data=gridTerrain(),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geometry.setIndex(data.indices);geometry.computeVertexNormals();
 const ground=new T.Mesh(geometry,world.terrainMaterials.byColor.get('#708666'));ground.receiveShadow=true;ground.name='continuous-terrain';scene.add(ground);world.terrainCollider(geometry);
 const water=new T.Mesh(new T.PlaneGeometry(MAP.width*MAP.scale,MAP.height*MAP.scale),world.terrainMaterials.water);
 water.rotation.x=-Math.PI/2;water.position.set(MAP.x+MAP.width*MAP.scale/2,WATER_LEVEL,MAP.z+MAP.height*MAP.scale/2);water.name='continuous-water';scene.add(water);
 for(const road of ROAD_PROFILES){
  const vertices=[],uv=[],indices=[];
  for(let i=0;i<=road.steps;i++){const d=road.length*i/road.steps,y=road.heightAt(d);for(const side of [-1,1]){vertices.push(road.start.x+road.dx*d+road.dz*road.width/2*side,y,road.start.z+road.dz*d-road.dx*road.width/2*side);uv.push((side+1)*road.width/8,d/4);}}
  for(let i=0;i<road.steps;i++){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new T.Mesh(g,world.terrainMaterials.byColor.get('#414f59'));mesh.receiveShadow=true;mesh.name=road.crossings.length?'bridge-road':'city-road';scene.add(mesh);world.terrainCollider(g);
  const angle=Math.atan2(road.dx,road.dz);
  for(let d=3;d<road.length-2;d+=7){const paint=world.box(road.start.x+road.dx*d,road.heightAt(d)+.012,road.start.z+road.dz*d,.15,.012,2.4,'#dfdfbf');paint.rotation.y=angle;}
  // Rails and posts mark the raised span; gentle ramps stay open at both ends.
  for(let d=1;d<road.length-1;d+=2){if(road.heightAt(d)<.5)continue;
    for(const side of [-1,1]){const x=road.start.x+road.dx*d+road.dz*(road.width/2+.12)*side,z=road.start.z+road.dz*d-road.dx*(road.width/2+.12)*side,y=road.heightAt(d);
      world.box(x,y+.43,z,.10,.86,.10,'#7b888c');const rail=world.box(x,y+.86,z,.1,.1,2.12,'#b3bdbe');rail.rotation.y=angle;}
  }
 }
 // A flat pedestrian pier and the roundabout match the original map.
 const pier=point(PIER[0],(PIER[1]+PIER[3])/2);world.box(pier.x,.06,pier.z,PIER[4]*MAP.scale,.12,(PIER[3]-PIER[1])*MAP.scale,'#c4b395');
 const dock=point(865,876);world.box(dock.x,.06,dock.z,55*MAP.scale,.12,12*MAP.scale,'#c4b395');
 const round=point(ROUNDABOUT.u,ROUNDABOUT.v),island=new T.Mesh(new T.CylinderGeometry(23*MAP.scale,23*MAP.scale,.01,48),new T.MeshStandardMaterial({color:'#688754'}));island.position.set(round.x,-.002,round.z);scene.add(island);
 // Beach and promenade under the park, as shown on the supplied map.
 const coastAt=u=>{for(let i=1;i<COAST.length;i++){const a=COAST[i-1],b=COAST[i];if(u<=b[0])return a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]);}return COAST.at(-1)[1];};
 for(const [inner,outer,color] of [[22,6,'#d7bf88'],[30,22,'#bdb7a4']]){
  const positions=[],uv=[],indices=[];
  for(let u=650;u<=1100;u+=5){for(const offset of [inner,outer]){const p=point(u,coastAt(u)-offset);positions.push(p.x,.012,p.z);uv.push(u*.1,offset*.1);}}
  for(let i=0;i<90;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new T.Mesh(g,world.terrainMaterials.byColor.get(color));mesh.receiveShadow=true;scene.add(mesh);
 }
 // Footpaths connect the park entrances to the fountain and promenade.
 for(const [u,v,w,d] of [[850,560,14,360],[850,400,340,14],[850,748,420,14],[775,110,14,80]]){const p=point(u,v);world.box(p.x,.002,p.z,w*MAP.scale,.002,d*MAP.scale,'#bcad8e');}
}
