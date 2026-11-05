import {coastPixelAt} from './coast-layout.js';
import {reservedNewPlot} from './new-places.js';
import {PARK_RIDES} from './park-details.js';
import {gridTerrain,ROAD_PROFILES,WALK_PROFILES,WATER_LEVEL,roadHeight} from './terrain.js';
import {clipSurface,appendSurface,roadPolygon,rectanglePolygon,SurfaceIndex} from './planar-surfaces.js';
import {createCityMaterialPool} from './shared-materials.js';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {prepareCityAsset} from './city-assets.js';
import {MAP_BUILDINGS} from './map-buildings.js';
import { MAP, point, GARAGE_PLOTS, WORK_STOPS, ROADS,ROAD_JOINS,WALK_JOINS, nearRoad, nearFootpath, pixel, meetsStreet, rawWater, isReferenceWater, PIER, ROUNDABOUT, COAST, PARK_PATHS,PARK_SQUARE,HOSPITAL,PARK_BRIDGES,parkBridgeHeight } from './reference-layout.js';
export {isReferenceWater} from './reference-layout.js';
import { BOROUGHS, LOCAL_SHOPS } from './layout.js';
import { createUrbanDetails } from './urban-details.js';
import {createDestructibles} from './destructibles.js';
import {createHousingFacades,HOUSING_STYLES,housingStyleAt} from './housing-facades.js';
import {createGarageStyles,GARAGE_STYLES,garageStyleAt} from './garage-styles.js';

// Hand-placed against map_reference.png, rather than the approximate preview GLB.
export async function createReferenceCity(scene,world,{human,car,label}) {
 world.props=createDestructibles(scene,world);
 let placedCount=0;
 const root=new T.Group(); root.name='uploaded-reference-city';scene.add(root);
 const housing=createHousingFacades();
 const garageStyles=createGarageStyles();world.garages=[];
 const placements=new Map(), collision=[], animated=[], preparedAssets=[];
 const traced=[];world.roofs=[];world.treeSpots=[];
 const clearShop=(u,v,r=0)=>WORK_STOPS.every(s=>Math.abs(u-s.u)>52+r || Math.abs(v-s.v)>44+r);
 function add(name,u,v,scale=1,angle=0,solid=false,force=false){
   if(reservedNewPlot({...point(u,v),w:2,d:2},1))return;
   if(!force && (!clearShop(u,v,14) || nearRoad(u,v,12)||nearFootpath(u,v,12))) return;
   const list=placements.get(name)||[];list.push({u,v,scale,angle,solid});placements.set(name,list);
 }
 // Measured footprint placement replaces guessed scales and broad exclusions.
 for(const [name,u,v,width,depth,angle] of MAP_BUILDINGS){
   const list=placements.get(name)||[];list.push({u,v,width,depth,angle:angle*Math.PI/180,scale:1,solid:true,traced:true});placements.set(name,list);
 }
 for(const {u,v}of GARAGE_PLOTS){
  const list=placements.get('garage')||[];list.push({u,v,width:14,depth:26,angle:0,scale:1,solid:true,traced:true});placements.set('garage',list);
 }
 for(const [u,v] of [[330,170],[350,500],[110,460],[570,430]])add('playground',u,v,1,0,true);
 for(const [u,v] of [[150,470],[355,520]])add('sandbox',u,v,1,0,true);
 // The forty measured garages already form spaced rows; no overlapping guessed extras.
 // Park: paths, rides, a civic waterfront pavilion and fountain.
 for(const [name,u,v,scale] of [['carousel',850,95,1.4],['carousel',875,285,1.2],['circus_tent',870,210,1.3],['ride_round',953,242,1.5],['fountain_large',850,490,1],['park_stage',860,710,1.5],['kiosk',1000,588,1],['public_toilet',990,680,1]])add(name,u,v,scale,0,true);
 // The uploaded wheel is horizontal. The existing authored vertical wheel is
 // retained here as a recognisable animated Ferris wheel at the map landmark.
 const wheel=new T.Group(),hub=new T.Group();const wp=point(970,110);wheel.position.set(wp.x,0,wp.z);root.add(wheel);hub.position.y=9;wheel.add(hub);wheel.scale.setScalar(4);
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
  const p=point(u,v);if(reservedNewPlot({...p,w:2.5,d:2.5},1))continue;if(Math.abs(p.x-HOSPITAL.x)<HOSPITAL.w+4&&Math.abs(p.z-HOSPITAL.z)<HOSPITAL.d+4)continue;
  if(Math.hypot(p.x-PARK_SQUARE.x,p.z-PARK_SQUARE.z)<PARK_SQUARE.radius+5||!clearShop(u,v,8)||nearRoad(u,v,20)||nearFootpath(u,v,10)||isReferenceWater(u,v)||parkBridgeHeight(p.x,p.z)>-Infinity||PARK_RIDES.some(r=>Math.abs(u-r.u)<r.w/MAP.scale+10&&Math.abs(v-r.v)<r.d/MAP.scale+10)||PARK_PATHS.some(([x,y,w,d])=>Math.abs(u-x)<w/2+6&&Math.abs(v-y)<d/2+6))continue;
  if([...placements].some(([n,list])=>!['tree','shrub','bench','trash_bin','streetlight','bus_stop'].includes(n)&&list.some(p=>(p.width?Math.abs(u-p.u)<p.width/2+12&&Math.abs(v-p.v)<p.depth/2+12:Math.hypot(u-p.u,v-p.v)<45))))continue;
  add(i%5?'tree':'shrub',u,v,.85+random()*.45);
 }
 let roadsideShrubs=0;
 for(const [a,b,c,d,width]of ROADS){if(roadsideShrubs>=50)break;const start=point(a,b),end=point(c,d),len=Math.hypot(end.x-start.x,end.z-start.z),dx=(end.x-start.x)/len,dz=(end.z-start.z)/len;
  for(let along=8;along<len-5&&roadsideShrubs<50;along+=15)for(const side of [-1,1]){if(roadsideShrubs>=50)break;const x=start.x+dx*along+dz*(width*MAP.scale/2+3.4)*side,z=start.z+dz*along-dx*(width*MAP.scale/2+3.4)*side;
   const gap=Math.min(...MAP_BUILDINGS.map(([,u,v,w,d])=>{const p=point(u,v);if((p.x-x)*dz*side-(p.z-z)*dx*side<=0)return Infinity;return Math.hypot(Math.max(0,Math.abs(x-p.x)-w*MAP.scale/2),Math.max(0,Math.abs(z-p.z)-d*MAP.scale/2));}));
   const p=pixel(x,z);if(gap<1.2||gap>12.5||!clearShop(p.x,p.y,5)||isReferenceWater(p.x,p.y)||meetsStreet(x,z,1.8,1.8))continue;add('shrub',p.x,p.y,.6,0,false,true);roadsideShrubs++;
  }
 }
 for(const [u,v] of [[150,215],[320,210],[370,540],[720,455],[910,420],[1010,530],[1430,290],[1500,610]]){add('bench',u,v,1,0,true);add('trash_bin',u+12,v,1,0,true);}
 for(const [u,v] of [[170,110],[300,560],[550,660]])add('dumpsters',u,v,1,0,true);
 // Parking rows use the existing drivable vehicle models.
 for(const [u,v] of [[160,400],[360,680],[570,150],[1240,690]]){
  add('parking_lot',u,v,1,0,false);
  for(let i=0;i<3;i++){const p=point(u+(i-1)*14,v);if(!clearShop(u+(i-1)*14,v,12))continue;world.vehicles.push(car(p.x,p.z,i%3,world.vehicles.length));}
 }
 let parkShrubs=0;
 for(const [u,v,w,d]of PARK_PATHS){const horizontal=w>d,length=Math.max(w,d);for(let along=12;along<length-8&&parkShrubs<48;along+=24)for(const side of [-1,1]){const x=u+(horizontal?along-length/2:side*(w/2+5)),y=v+(horizontal?side*(d/2+5):along-length/2),p=point(x,y);if((x>=650&&x<=1110&&y>coastPixelAt(x)-32)||nearRoad(x,y,10)||isReferenceWater(x,y)||reservedNewPlot({...p,w:1,d:1},1)||Math.hypot(p.x-PARK_SQUARE.x,p.z-PARK_SQUARE.z)<PARK_SQUARE.radius+2||PARK_RIDES.some(r=>Math.abs(x-r.u)<r.w/MAP.scale+4&&Math.abs(y-r.v)<r.d/MAP.scale+4))continue;if([...placements].some(([name,list])=>!['tree','shrub','bench','trash_bin','streetlight'].includes(name)&&list.some(b=>Math.hypot(x-b.u,y-b.v)<25)))continue;add('shrub',x,y,.58,0,false,true);parkShrubs++;}}
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
  let roofHeight=nativeH;
  if(name.startsWith('panel')||(name.startsWith('shop_')||name==='cafe')){
    const levels=new Map();
    for(const batch of asset.batches)if(batch.material.name==='roof'){
      const pos=batch.geometry.attributes.position,normal=batch.geometry.attributes.normal,idx=batch.geometry.index;
      for(let i=0;i<(idx?.count??pos.count);i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j);if(ids.some(j=>normal.getY(j)<.9))continue;
        const a=new T.Vector3().fromBufferAttribute(pos,ids[0]),b0=new T.Vector3().fromBufferAttribute(pos,ids[1]),c0=new T.Vector3().fromBufferAttribute(pos,ids[2]);
        const level=Math.round((a.y+b0.y+c0.y)/3*100)/100,area=b0.sub(a).cross(c0.sub(a)).length()/2;levels.set(level,(levels.get(level)??0)+area);
      }
    }
    const main=[...levels].sort((a,b)=>b[1]-a[1]||b[0]-a[0])[0];if(main)roofHeight=main[0]-b.min.y+.006;
  }
  // Fruit must hang below the opaque crown, not disappear inside its mesh.
  const leafBottom=name==='tree'?Math.min(...asset.batches.filter(a=>/^leaf/i.test(a.material.name)).map(a=>{a.geometry.computeBoundingBox();return a.geometry.boundingBox.min.y;}))-b.min.y:0;
  placedCount+=list.length;
  for(const p of list){
    if(p.traced)traced.push({model:name,u:p.u,v:p.v,width:p.worldWidth/MAP.scale,depth:p.worldDepth/MAP.scale,...(name.startsWith('panel')?{housingStyle:HOUSING_STYLES[housingStyleAt(p.u,p.v)].id}:{})});
    if(name==='tree'){const pos=point(p.u,p.v);world.treeSpots.push({id:`tree:${p.u.toFixed(2)}:${p.v.toFixed(2)}`,...pos,scale:p.scale,height:nativeH*p.scale,fruitHeight:Math.max(.9,(Number.isFinite(leafBottom)?leafBottom:nativeH*.32)*p.scale-.22)});}
    if(name.startsWith('panel')){const pos=point(p.u,p.v);world.roofs.push({id:`roof:${p.u}:${p.v}`,...pos,w:p.worldWidth/2,d:p.worldDepth/2,y:roofHeight*p.scale,model:name,kind:'residential'});}
    if((name.startsWith('shop_')||name==='cafe')){world.roofs.push({id:`shop-local:${p.u}:${p.v}`,...point(p.u,p.v),w:p.worldWidth/2,d:p.worldDepth/2,y:roofHeight*p.scale,kind:'shop'});}
    if(name==='garage'){world.garages.push({id:`garage:${p.u}:${p.v}`,...point(p.u,p.v),w:p.worldWidth/2,d:p.worldDepth/2,y:nativeH*p.scale,style:GARAGE_STYLES[garageStyleAt(p.u,p.v)]});}
    if(p.solid){const pos=point(p.u,p.v),h=(name.startsWith('panel')||(name.startsWith('shop_')||name==='cafe')?roofHeight:nativeH)*p.scale;let wall={...pos,w:p.worldWidth/2,d:p.worldDepth/2};
     if(name.startsWith('panel')){const body=new T.Box3(),rotation=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),p.angle),center=b.getCenter(new T.Vector3());center.y=b.min.y;const origin=center.multiply(p.scaleVector).applyQuaternion(rotation).negate().add(new T.Vector3(pos.x,.006,pos.z)),matrix=new T.Matrix4().compose(origin,rotation,p.scaleVector);for(const batch of asset.batches)if(batch.material.name==='panel'){batch.geometry.computeBoundingBox();body.union(batch.geometry.boundingBox.clone().applyMatrix4(matrix));}if(!body.isEmpty()){const c=body.getCenter(new T.Vector3()),size=body.getSize(new T.Vector3());wall={x:c.x,z:c.z,w:size.x/2,d:size.z/2};}world.roofs.find(r=>r.id===`roof:${p.u}:${p.v}`).wallBounds=wall;}
     const proxy=world.box(wall.x,h/2,wall.z,wall.w*2,h,wall.d*2,'#70796d',true);proxy.visible=false;proxy.userData.blocker.buildingIndex=MAP_BUILDINGS.findIndex(row=>row[0]===name&&row[1]===p.u&&row[2]===p.v);collision.push(proxy);p.proxy=proxy;}
    if(name==='bench'){const pos=point(p.u,p.v);p.breakable={key:`city-bench:${p.u}:${p.v}`,id:'bench-wood',x:pos.x,z:pos.z,footprint:{...pos,w:p.worldWidth/2,d:p.worldDepth/2},heading:p.angle,seatHeight:.55*p.scale,seatBaseY:.006,proxy:p.proxy,instances:[]};}
  }
  const matrix=new T.Matrix4(),q=new T.Quaternion(),center=b.getCenter(new T.Vector3());center.y=b.min.y;
  const chunks=new Map();
  for(const p of list){const pos=point(p.u,p.v),key=Math.floor(pos.x/48)+','+Math.floor(pos.z/48);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(p);}
  for(const batch of asset.batches)if(name.startsWith('panel')&&batch.material.name==='panel')housing.prepare(batch.geometry);
  for(const [key,chunk] of chunks)for(const [index,batch]of asset.batches.entries()){
    const house=name.startsWith('panel'),facade=house&&batch.material.name==='panel',garageWall=name==='garage'&&batch.material.name==='cement';
    const instances=new T.InstancedMesh(batch.geometry,facade?housing.wall:garageWall?garageStyles.wall:batch.material,chunk.length);instances.name=`city-pack-${name}-${index}-${key}`;instances.castShadow=true;instances.receiveShadow=true;
    chunk.forEach((p,i)=>{
      const pos=point(p.u,p.v);q.setFromAxisAngle(new T.Vector3(0,1,0),p.angle);
      const origin=center.clone().multiply(p.scaleVector).applyQuaternion(q).negate().add(new T.Vector3(pos.x,.006,pos.z));
      matrix.compose(origin,q,p.scaleVector);instances.setMatrixAt(i,matrix);
      if(facade)instances.setColorAt(i,new T.Color(housingStyleAt(p.u,p.v)/7,1,1));
      else if(garageWall)instances.setColorAt(i,new T.Color(garageStyleAt(p.u,p.v)/3,1,1));
      else if(name==='garage')instances.setColorAt(i,new T.Color(['#aa7964','#b3bbab','#72978a','#c5ad74'][garageStyleAt(p.u,p.v)]));
      else if(house&&['roof','bluepaint','graypaint'].includes(batch.material.name))instances.setColorAt(i,new T.Color(['#b5c5b0','#cfb498','#a0b9c4','#d5c3b0'][housingStyleAt(p.u,p.v)%4]));
      if(p.breakable)p.breakable.instances.push({mesh:instances,index:i});
    });root.add(instances);
    instances.computeBoundingSphere();
  }
  for(const p of list)if(p.breakable)world.props.register(p.breakable);
 }));
 } finally {
  T.Cache.enabled=cacheWasEnabled;
  for(const key of Object.keys(T.Cache.files))if(!previousKeys.has(key)&&key.includes("models/city-pack/"))T.Cache.remove(key);
 }
 materialPool.finishLoading();
 const urbanDetails=createUrbanDetails(scene,world,point);
 return {diagnostics:{assetRevision:"pbr-4-streets",parkShrubs,roadsideShrubs,wheelScale:4,housingStyles:HOUSING_STYLES,garageStyles:GARAGE_STYLES,garages:world.garages,resources:materialPool.diagnostics,boroughs:BOROUGHS,localShops:LOCAL_SHOPS,source:'user-map',modelTypes:placements.size,placements:placedCount,tracedBuildings:traced,urbanDetails:urbanDetails.diagnostics},update(dt){hub.rotation.z+=dt*.09;for(const cabin of animated)cabin.rotation.z=-hub.rotation.z;world.props.update(dt);},dispose(){urbanDetails.dispose();world.props.dispose();preparedAssets.forEach(a=>a.dispose());housing.dispose();garageStyles.dispose();materialPool.dispose();root.traverse(n=>{if(n.isInstancedMesh)n.dispose();if(n.isMesh&&!n.isInstancedMesh){n.geometry?.dispose();for(const m of Array.isArray(n.material)?n.material:[n.material])m.dispose();}});root.removeFromParent();}};
}

export function buildReferenceTerrain(world,scene){
 const data=gridTerrain(),geometry=new T.BufferGeometry();
 geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geometry.setIndex(data.indices);geometry.computeVertexNormals();
 const ground=new T.Mesh(geometry,world.terrainMaterials.byColor.get('#708666'));ground.receiveShadow=true;ground.name='continuous-terrain';scene.add(ground);world.terrainCollider(geometry);
 const water=new T.Mesh(new T.PlaneGeometry(MAP.width*MAP.scale,MAP.height*MAP.scale),world.terrainMaterials.water);
 water.rotation.x=-Math.PI/2;water.position.set(MAP.x+MAP.width*MAP.scale/2,WATER_LEVEL,MAP.z+MAP.height*MAP.scale/2);water.name='continuous-water';scene.add(water);
 const roadCuts=[],paving=[],pavingIndex=new SurfaceIndex();
 for(const road of [...ROAD_PROFILES,...WALK_PROFILES]){
  const pedestrian=WALK_PROFILES.includes(road);
  const vertices=[],uv=[],indices=[];
  const out={positions:vertices,uv};
  for(let i=0;i<road.steps;i++){const a=road.length*i/road.steps,b=road.length*(i+1)/road.steps,quad=[];for(const [d,side]of [[a,-1],[a,1],[b,1],[b,-1]])quad.push({x:road.start.x+road.dx*d+road.dz*road.width/2*side,z:road.start.z+road.dz*d-road.dx*road.width/2*side});for(const p of clipSurface(quad,roadCuts))appendSurface(out,p,roadHeight);}
  for(let i=0;i<vertices.length/3;i++)indices.push(i);
  roadCuts.push(roadPolygon(road));
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  const mesh=new T.Mesh(g,world.terrainMaterials.byColor.get(pedestrian?'#bcad8e':'#414f59'));mesh.receiveShadow=true;mesh.name=pedestrian?'pedestrian-park-bridge':road.crossings.length?'bridge-road':'city-road';scene.add(mesh);world.terrainCollider(g);
  const angle=Math.atan2(road.dx,road.dz);
  for(let d=3;!pedestrian&&road.width>=5.2&&d<road.length-2;d+=7){const x=road.start.x+road.dx*d,z=road.start.z+road.dz*d;if(ROAD_PROFILES.some(other=>other!==road&&(x-other.start.x)*other.dx+(z-other.start.z)*other.dz>=-1.3&&(x-other.start.x)*other.dx+(z-other.start.z)*other.dz<=other.length+1.3&&Math.abs((x-other.start.x)*other.dz-(z-other.start.z)*other.dx)<other.width/2+1.3))continue;const paint=world.box(x,roadHeight(x,z)+.012,z,.15,.012,2.4,'#dfdfbf');paint.rotation.y=angle;}
  // Rails and posts mark the raised span; gentle ramps stay open at both ends.
  for(let d=1;d<road.length-1;d+=2){if(road.heightAt(d)<.5)continue;
    for(const side of [-1,1]){const x=road.start.x+road.dx*d+road.dz*(road.width/2+.12)*side,z=road.start.z+road.dz*d-road.dx*(road.width/2+.12)*side,y=road.heightAt(d);
      world.box(x,y+.43,z,.10,.86,.10,'#7b888c');const rail=world.box(x,y+.86,z,.1,.1,2.12,'#b3bdbe');rail.rotation.y=angle;}
  }
 }
 // Rounded joins fill the outer wedges between adjoining road rectangles.
 const joins={positions:[],uv:[]};
 for(const j of ROAD_JOINS){const polygon=Array.from({length:32},(_,i)=>({x:j.x+Math.cos(i*Math.PI/16)*j.radius,z:j.z+Math.sin(i*Math.PI/16)*j.radius}));for(const part of clipSurface(polygon,roadCuts))appendSurface(joins,part,roadHeight);roadCuts.push(polygon);}
 const joinGeometry=new T.BufferGeometry();joinGeometry.setAttribute('position',new T.Float32BufferAttribute(joins.positions,3));joinGeometry.setAttribute('uv',new T.Float32BufferAttribute(joins.uv,2));joinGeometry.setIndex(Array.from({length:joins.positions.length/3},(_,i)=>i));joinGeometry.computeVertexNormals();const joinMesh=new T.Mesh(joinGeometry,world.terrainMaterials.byColor.get('#414f59'));joinMesh.name='rounded-road-junctions';joinMesh.receiveShadow=true;scene.add(joinMesh);world.terrainCollider(joinGeometry);
 // Fill the outside of pedestrian bends once, clipping the same footprints
 // out of subsequent park and business-side paving.
 const walkJoins={positions:[],uv:[]};
 for(const j of WALK_JOINS){const poly=Array.from({length:24},(_,i)=>({x:j.x+Math.cos(i*Math.PI/12)*j.radius,z:j.z+Math.sin(i*Math.PI/12)*j.radius}));for(const part of clipSurface(poly,roadCuts))appendSurface(walkJoins,part,roadHeight);roadCuts.push(poly);}
 const walkGeometry=new T.BufferGeometry();walkGeometry.setAttribute('position',new T.Float32BufferAttribute(walkJoins.positions,3));walkGeometry.setAttribute('uv',new T.Float32BufferAttribute(walkJoins.uv,2));walkGeometry.setIndex(Array.from({length:walkJoins.positions.length/3},(_,i)=>i));walkGeometry.computeVertexNormals();const walkMesh=new T.Mesh(walkGeometry,world.terrainMaterials.byColor.get('#bcad8e'));walkMesh.name='joined-pedestrian-bends';walkMesh.receiveShadow=true;scene.add(walkMesh);world.terrainCollider(walkGeometry);
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
 for(const b of PARK_BRIDGES)roadCuts.push([[-1,-1],[1,-1],[1,1],[-1,1]].map(([along,side])=>({x:b.x+Math.cos(b.angle)*along*(b.length/2+4)-Math.sin(b.angle)*side*(b.width/2+.5),z:b.z+Math.sin(b.angle)*along*(b.length/2+4)+Math.cos(b.angle)*side*(b.width/2+.5)})));
 // Footpaths connect the park entrances to the fountain and promenade.
 const pathData={positions:[],uv:[]};
 for(const [u,v,w,d] of PARK_PATHS){const p=point(u,v),poly=rectanglePolygon(p.x,p.z,w*MAP.scale,d*MAP.scale);for(const part of clipSurface(poly,[...roadCuts,...pavingIndex.at(poly)])){appendSurface(pathData,part,()=>.035);paving.push(part);}pavingIndex.add(poly);}
 const paths=new T.BufferGeometry();paths.setAttribute('position',new T.Float32BufferAttribute(pathData.positions,3));paths.setAttribute('uv',new T.Float32BufferAttribute(pathData.uv,2));paths.computeVertexNormals();const pathMesh=new T.Mesh(paths,world.terrainMaterials.byColor.get('#bcad8e'));pathMesh.receiveShadow=true;pathMesh.name='joined-park-paving';scene.add(pathMesh);
 return {paving,roadCuts};
}
