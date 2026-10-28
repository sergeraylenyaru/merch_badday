import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import * as T from 'three';
import {BOROUGHS, LOCAL_SHOPS} from './layout.js';
/** Original modular architecture. Shared materials and geometry; no external requests. */
export function createBoroughs(scene,world,{human,car,label}) {
 const root=new T.Group();root.name='three-boroughs';scene.add(root);
 const mats=new Map(),geos=new Map(),moving=[];
 function mat(color){if(!mats.has(color))mats.set(color,new T.MeshStandardMaterial({color,roughness:.72,metalness:color==='#709daa'?.5:0}));return mats.get(color);}
 function box(x,y,z,w,h,d,color,parent=root){const key=[w,h,d].join();if(!geos.has(key))geos.set(key,new T.BoxGeometry(w,h,d));const o=new T.Mesh(geos.get(key),mat(color));o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;}
 function solid(x,y,z,w,h,d,c){box(x,y,z,w,h,d,c);const p=world.box(x,y,z,w,h,d,c,true);p.visible=false;}
 function cyl(x,y,z,r,h,c,parent=root){const key=`c${r}/${h}`;if(!geos.has(key))geos.set(key,new T.CylinderGeometry(r,r,h,20));const o=new T.Mesh(geos.get(key),mat(c));o.position.set(x,y,z);parent.add(o);return o;}
 function bench(x,z){solid(x,.46,z,2,.18,.65,'#947556');for(const dx of [-.8,.8])box(x+dx,.23,z,.12,.46,.5,'#35434a');box(x,.9,z-.32,2,.7,.1,'#947556');}
 function tree(x,z){cyl(x,1.3,z,.19,2.6,'#79634b');for(let i=0;i<3;i++)cyl(x,3+i*.55,z,1.5-i*.35,.8,'#59805b');}
 function resident(x,z,role){const n=human(x,z,role==='elder'?'#8e7797':'#817461','resident');n.seated=true;n.role=role;n.activity={id:1,clip:'Drive',duration:100000,remaining:100000};n.home.y=.05;world.people.push(n);label(role==='elder'?'Соседки у подъезда':role==='unhoused'?'Местный житель':'Отдых после смены',x,2.7,z,'#dbd0ad',.45);}
 function apartment(x,z,color){solid(x,7.5,z,22,15,8,color);box(x,15.2,z,22.8,.4,8.7,'#52636a');
  for(let floor=0;floor<5;floor++)for(let col=0;col<8;col++){let wx=x-9.2+col*2.6,wy=1.8+floor*2.85;box(wx,wy,z+4.06,1.5,1.7,.12,(floor+col)%4?'#72949b':'#e2c88d');box(wx,wy,z+4.15,.06,1.7,.06,'#e1ddd0');if(col%3===0){box(wx,wy-.85,z+4.6,1.9,.14,1.1,'#ccc6b9');box(wx,wy-.45,z+5.1,1.9,.75,.12,'#809493');}}
  for(const dx of [-6,6]){box(x+dx,1.1,z+4.1,1.5,2.2,.15,'#3d5858');box(x+dx,2.45,z+4.6,2.6,.16,1.3,'#799183');bench(x+dx+2.4,z+6.8);resident(x+dx+2.4,z+6.8,'elder');} }
 // Five-storey regional apartment courtyards, with parked cars and play equipment.
 apartment(-63,-108,'#c4b7a0');apartment(-98,35,'#bcb8a3');
 for(let i=0;i<8;i++){const v=car(-73+i*4.1,-91,i%3,world.vehicles.length);world.vehicles.push(v);}
 for(const x of [-83,-78]){solid(x,1.6,-105,.15,3.2,.15,'#b9bd9c');}box(-80.5,3.2,-105,5.3,.15,.15,'#b9bd9c');
 for(const x of [-82,-79]){box(x,2.15,-105,.05,1.8,.05,'#6c7770');box(x,1.18,-105,.9,.12,.45,'#c28c46');}
 solid(-86,.25,-97,4,.5,4,'#c9ae79');box(-86,.55,-97,4.3,.15,.2,'#ae6049');
 solid(-95,.55,44,1.8,1.1,1.3,'#536b5b');box(-95,1.14,44,1.95,.12,1.4,'#384b43');bench(-101,43);resident(-101,43,'unhoused');bench(-93,47);resident(-93,47,'rest');
 // Leisure quarter: landscaped park, illuminated wheel and roundabout.
 world.addSurface(20,-105,32,32,.08);world.addSurface(20,-105,3,32,.115);world.addSurface(20,-105,32,3,.12);
 box(20,.04,-105,32,.08,32,'#6c9166');box(20,.095,-105,3,.04,32,'#c0b493');box(20,.1,-105,32,.04,3,'#c0b493');
 for(const x of [7,33])for(const z of [-117,-109,-97])tree(x,z);
 for(const x of [12,28]){bench(x,-101);bench(x,-111);}
 const wheel=new T.Group();wheel.position.set(20,8,-111);root.add(wheel);moving.push(wheel);
 const ring=new T.Mesh(new T.TorusGeometry(6,.13,8,48),mat('#d1ba76'));wheel.add(ring);
 for(let i=0;i<10;i++){let a=i*Math.PI/5;const spoke=box(0,0,0,.08,12,.08,'#a0bab4',wheel);spoke.rotation.z=a;const cabin=box(Math.sin(a)*6,Math.cos(a)*6,0,1.2,1.1,.9,i%2?'#b85c4a':'#579995',wheel);cabin.userData.counterRotate=true;}
 for(const x of [17,23])solid(x,3.5,-111,.3,7,.4,'#647e78');
 cyl(29,.45,-95,3.2,.7,'#b19b6f');cyl(29,2,-95,.18,3,'#9b6f59');cyl(29,3.5,-95,3.5,.25,'#a15c56');
 for(const [x,name] of [[8,'КАФЕ ПАРК'],[29,'БАР ВЕЧЕР']]){solid(x,1.7,-78,9,3.4,6,'#b99370');box(x,3.6,-78,10,.25,7,'#446d65');box(x,1.8,-74.9,6,2,.12,'#709daa');label(name,x,3,-74.7,'#ffe4b0',.8);for(let i=0;i<3;i++){cyl(x-3+i*3,.7,-72,.65,.15,'#93775b');cyl(x-3+i*3,.35,-72,.09,.7,'#354950');}}
 // Business skyline, civic buildings, square and fountain.
 for(const [x,z,h] of [[82,-110,29],[104,-110,39],[126,-109,47]]){solid(x,h/2,z,16,h,16,'#3e5a68');for(let y=2;y<h;y+=2.7)for(let k=-6;k<=6;k+=2){box(x+k,y,z+8.03,1.6,2,.08,'#709daa');box(x+8.03,y,z+k,.08,2,1.6,'#709daa');}box(x,h+.3,z,17,.6,17,'#b1c5c3');}
 for(const [x,name] of [[85,'БАНК'],[119,'РАТУША']]){solid(x,4,-78,17,8,10,'#d4c9b0');box(x,8.3,-78,19,.6,12,'#a8b1a6');for(let dx=-6;dx<=6;dx+=3)cyl(x+dx,3.7,-84.2,.35,7,'#e5dfc9');box(x,3,-83.1,3,5,.15,'#557d83');label(name,x,7,-84.5,'#3d525b',1.2);}
 box(102,.002,-93,30,.004,14,'#b4b4a7');cyl(102,.42,-93,4.3,.65,'#8a9d9c');cyl(102,.79,-93,3.8,.12,'#72b9bf');cyl(102,1.45,-93,.7,1.4,'#b7c6bb');
 const basin=world.box(102,.4,-93,8.6,.8,8.6,'#8a9d9c',true);basin.visible=false;
 const water=cyl(102,2.8,-93,.09,3.8,'#b4e0df');moving.push(water);
 for(const x of [90,114]){bench(x,-92);tree(x,-88);}
 // Six unmarked neighborhood businesses; together with nine route stores: 15.
 for(const s of LOCAL_SHOPS){solid(s.x,1.8,s.z,9,3.6,6,BOROUGHS[s.district].color);box(s.x,3.75,s.z,9.6,.3,6.6,'#46575a');box(s.x,1.7,s.z+3.04,7,2.4,.1,'#709daa');box(s.x,1.2,s.z+3.12,1.2,2.4,.1,'#304c53');label(s.name,s.x,3.1,s.z+3.2,'#ffe4af',.8);}
 for(const b of BOROUGHS)label(b.name.toUpperCase(),b.x,5,126,'#f2d49a',1.3);
 // Batch static architecture by material; animated rides stay independent.
 root.updateMatrixWorld(true);const batches=new Map(),mergedOwned=[];
 for(const child of [...root.children]){if(!child.isMesh||moving.includes(child))continue;const list=batches.get(child.material)||[];list.push(child.geometry.clone().applyMatrix4(child.matrixWorld));batches.set(child.material,list);root.remove(child);}
 for(const [material,list] of batches){const geometry=mergeGeometries(list);for(const g of list)g.dispose();if(!geometry)throw Error('City geometry batch failed');mergedOwned.push(geometry);const mesh=new T.Mesh(geometry,material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 return {update(dt){for(const o of moving){if(o===water)o.scale.y=1+Math.sin(performance.now()*.003)*.08;else{o.rotation.z+=dt*.06;for(const c of o.children)if(c.userData.counterRotate)c.rotation.z=-o.rotation.z;}}},diagnostics:{districts:BOROUGHS,localShops:LOCAL_SHOPS},dispose(){root.removeFromParent();for(const g of [...geos.values(),...mergedOwned])g.dispose();for(const m of mats.values())m.dispose();}};
}
