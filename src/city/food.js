import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {FOOD_SITES} from './new-places.js';
import {sceneBuilder} from './scene-builder.js';
export {FOOD_SITES};
export function mealCounter(site){const d=site.style==='shawarma'?site.depth/2+1.35:-.55;return {x:site.x+Math.sin(site.heading)*d,z:site.z+Math.cos(site.heading)*d,y:0};}
export function buyMeal(state,site,position){
 const target=mealCounter(site);if(!FOOD_SITES.some(s=>s.id===site.id)||!position||Math.hypot(position.x-target.x,position.z-target.z)>2.6||Math.abs(position.y??0)>1.5||state.money<site.price)return false;
 const before={health:state.health,wanted:state.wanted,stress:state.stress};state.money-=site.price;state.health=Math.min(100,state.health+site.health);state.stress=Math.max(0,state.stress-site.stress);state.wanted=Math.max(0,state.wanted-1);state.wantedElapsed=0;state.wantedParkourCredit=0;state.foodMeals=(state.foodMeals??0)+1;
 return {health:state.health-before.health,stress:before.stress-state.stress,stars:before.wanted-state.wanted};
}
export async function createFoodPlaces(scene,world,state){
 const build=sceneBuilder(scene,world,'city-fast-food'),loader=new GLTFLoader(),assets=await Promise.all(['food_burger','kitchencounter_straight_A','menu','food_ingredient_potato_chopped'].map(id=>loader.loadAsync(`${import.meta.env.BASE_URL}models/food/${id}.glb`))),logos=[];let callbacks={};
 function model(index,parent,width,x,y,z){const n=assets[index].scene.clone(true),b=new T.Box3().setFromObject(n),size=b.getSize(new T.Vector3()),center=b.getCenter(new T.Vector3()),scale=width/size.x;n.scale.multiplyScalar(scale);n.position.set(x-center.x*scale,y-b.min.y*scale,z-center.z*scale);n.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true;});parent.add(n);return n;}
 for(const site of FOOD_SITES){
  const g=new T.Group();g.position.set(site.x,0,site.z);g.rotation.y=site.heading;build.root.add(g);const w=site.width,d=site.depth,kiosk=site.style==='shawarma';
  const local=(x,y,z)=>new T.Vector3(x,y,z).applyEuler(new T.Euler(0,site.heading,0)).add(g.position);
  function box(x,y,z,bw,bh,bd,color,solid=false){const p=local(x,y,z),c=Math.abs(Math.cos(site.heading)),s=Math.abs(Math.sin(site.heading));build.box(p.x,p.y,p.z,c*bw+s*bd,bh,s*bw+c*bd,color,solid);}
  function sphere(parent,x,y,z,sx,sy,sz,color){const geometry=new T.SphereGeometry(1,12,8),material=new T.MeshStandardMaterial({color,roughness:.75}),mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);parent.add(mesh);build.owned.push(geometry);build.materials.push(material);return mesh;}
  function cylinder(parent,r1,r2,h,x,y,z,color,rotation=0){const geometry=new T.CylinderGeometry(r1,r2,h,16),material=new T.MeshStandardMaterial({color,roughness:.8}),mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.rotation.x=rotation;parent.add(mesh);build.owned.push(geometry);build.materials.push(material);return mesh;}
  box(0,.035,d*.1,w+1.6,.05,d+2.8,'#b9b4a0');
  if(kiosk){
   box(0,1.4,-d/2+.1,w,2.8,.2,site.color,true);for(const side of [-1,1])box(side*(w/2-.1),1.4,0,.2,2.8,d,site.color,true);
   box(0,.55,d/2,w,1.1,.18,site.color,true);box(0,2.6,d/2,w,.55,.2,site.color,true);box(0,1.13,d/2+.12,w-.3,.12,.55,'#cbc3a8',true);box(0,2.95,.35,w+.45,.22,d+1.1,site.accent);
   for(let i=0;i<9;i++)box(-w/2+i*w/9,2.78,d/2+.6,w/9,.18,.8,i%2?site.color:site.accent);
   const spit=new T.Group();g.add(spit);cylinder(spit,.36,.45,1.05,.8,1.75,.4,'#b77c43');for(let y=1.3;y<2.25;y+=.13)cylinder(spit,.37,.40,.045,.8,y,.4,'#8c582f');cylinder(spit,.025,.025,1.5,.8,1.75,.4,'#8f9690');box(1.48,1.75,.1,.2,1.25,.9,'#bd5c38');
   build.sign(g,site.name,w-.3,.54,0,3.35,d/2+.65,{background:site.color,color:site.accent});build.sign(g,'ШАУРМА · 90 ₽',w-.8,.36,0,.67,d/2+.12,{background:site.color});
   for(const side of [-1,1])box(side*w*.34,3.1,d/2+.6,.06,.75,.06,site.accent);model(2,g,.28,-1.0,1.2,d/2+.12);
  }else{
   const h=4.5;box(0,h/2,-d/2,w,h,.24,site.color,true);for(const side of [-1,1])box(side*(w/2-.12),h/2,0,.24,h,d,site.color,true);
   box(0,.025,0,w-.3,.03,d-.3,'#d6cab1');world.parkourSurfaces.push({x:site.x,z:site.z,w:site.w-.15,d:site.d-.15,y:.04});box(0,4.65,0,w+1,.3,d+1,'#454e43');box(0,3.9,d/2,w,1.15,.32,site.color,true);
   for(const side of [-1,1]){box(side*(w/4+.8),.48,d/2,w/2-1.6,.8,.18,site.color,true);box(side*(w/4+.8),2,d/2,w/2-1.6,2.2,.08,'#63847c',true);for(const x of [side*1.65,side*(w/2-.2)])box(x,2,d/2+.06,.1,2.2,.2,site.accent);}
   box(0,3.05,d/2+.8,3.7,.18,1.8,site.accent);box(0,3.5,d/2+.25,w+1,.22,.65,site.accent);
   build.sign(g,site.name,w-2,.85,0,4.02,d/2+.22,{background:site.color,color:site.accent});build.sign(g,'ЗАКАЗЫ · ЕДА · '+site.price+' ₽',5.7,.45,0,2.0,-d/2+.18,{background:site.color});
   const counter=model(1,g,w*.65,0,0,-2.2);const cb=new T.Box3().setFromObject(assets[1].scene),cs=cb.getSize(new T.Vector3()),cc=cb.getCenter(new T.Vector3());counter.scale.y=1.12/cs.y;counter.scale.z=1/cs.z;counter.position.y=-cb.min.y*counter.scale.y;counter.position.z=-2.2-cc.z*counter.scale.z;const bounds=new T.Box3().setFromObject(counter),sz=bounds.getSize(new T.Vector3()),p=bounds.getCenter(new T.Vector3()),proxy=world.box(p.x,p.y,p.z,sz.x,sz.y,sz.z,'#a8a89b',true);proxy.visible=false;
   model(0,g,.6,-1.5,1.17,-2.2);model(3,g,.4,-.5,1.17,-2.2);model(2,g,.38,2,1.17,-2.2);
   const logo=new T.Group();logo.name='food-logo:'+site.style;logo.position.set(0,5.05,1.2);g.add(logo);logos.push({id:site.id,style:site.style});
   if(site.style==='burger'){box(0,4.93,0,w+1.1,.25,d+1.1,site.accent);for(let x=-w/2+.5;x<w/2;x+=.45)if(Math.abs(x)>1.8)box(x,.52,d/2+.15,.1,.7,.12,'#805534');model(0,logo,4.3,0,0,0);cylinder(logo,1.45,1.45,.16,0,.03,0,site.accent);}
   if(site.style==='fries'){
    logo.position.y+=.95;for(const side of [-1,1])for(let i=0;i<5;i++)box(side*(w/2-.28-i*.25),1.65,d/2+.14,.08,3.0,.15,'#aa7950');
    const rocket=new T.Group();rocket.rotation.z=-.35;logo.add(rocket);cylinder(rocket,.9,.6,1.5,0,.9,0,'#e57135');for(let i=0;i<7;i++){const f=new T.Mesh(new T.BoxGeometry(.23,1.5+(i%3)*.24,.26),new T.MeshStandardMaterial({color:i%2?'#e9bc58':'#f6da82'}));f.position.set((i-3)*.23,2.05+(i%3)*.12,(i%2)*.15);f.rotation.z=(i-3)*.04;rocket.add(f);build.owned.push(f.geometry);build.materials.push(f.material);}
    const flame=cylinder(rocket,.55,0,1.25,0,-.45,0,'#f7c846');flame.rotation.z=0;cylinder(rocket,.28,0,.9,0,-.25,.35,'#f19135').rotation.z=0;const orbit=new T.Mesh(new T.TorusGeometry(1.85,.045,6,48),new T.MeshStandardMaterial({color:'#cfd7b0'}));orbit.rotation.set(.8,.2,-.5);orbit.position.y=1.5;logo.add(orbit);build.owned.push(orbit.geometry);build.materials.push(orbit.material);
   }
   if(site.style==='chicken-pizza'){
    const arch=new T.Mesh(new T.TorusGeometry(1.8,.10,6,24,Math.PI),new T.MeshStandardMaterial({color:site.accent}));arch.scale.y=.35;arch.position.set(0,2.72,d/2+.32);g.add(arch);build.owned.push(arch.geometry);build.materials.push(arch.material);
    cylinder(logo,1.75,1.75,.18,0,.15,0,'#ba8244');cylinder(logo,1.60,1.60,.08,0,.27,0,'#edc775');for(let i=0;i<10;i++){const a=i*2.39996,r=.6+(i%2)*.55;cylinder(logo,.15,.15,.035,Math.cos(a)*r,.33,Math.sin(a)*r,'#b64b37');}
    for(const side of [-1,1]){cylinder(logo,.055,.055,.52,side*.22,.62,0,'#d5a044');sphere(logo,side*.22,.38,.16,.14,.055,.28,'#d5a044');}
    sphere(logo,0,1.30,0,.62,.72,.52,'#f0e6c7');sphere(logo,0,2.08,.12,.36,.45,.32,'#f1e9d6');for(const side of [-1,1]){const wing=sphere(logo,side*.55,1.35,0,.15,.42,.38,'#d7cfb5');wing.rotation.z=side*.22;sphere(logo,side*.22,2.18,.34,.11,.13,.06,'#faf0da');sphere(logo,side*.23,2.19,.39,.045,.055,.025,'#252f2c');}for(let i=0;i<3;i++)sphere(logo,0,2.47+i%2*.08,-.06+i*.16,.09,.16,.13,'#ba4738');sphere(logo,0,1.84,.4,.12,.19,.09,'#bb4435');const beak=cylinder(logo,0,.15,.36,0,2.05,.51,'#d7a33f',Math.PI/2);beak.rotation.x=Math.PI/2;for(let i=0;i<3;i++){const tail=sphere(logo,(i-1)*.15,1.5,-.52,.12,.42,.25,'#d6cfb8');tail.rotation.x=-.6;}
   }
  }
 }
 build.finish();const sites=FOOD_SITES.map(s=>({...s,approach:mealCounter(s)}));
 return {entrances(){return sites.map(s=>({u:s.u,v:s.v,approach:{x:s.x+Math.sin(s.heading)*(s.depth/2+1.4),z:s.z+Math.cos(s.heading)*(s.depth/2+1.4)}}));},setCallbacks(c){callbacks=c;},nearest(position){return sites.filter(s=>Math.abs((position.y??0)-s.approach.y)<1.5).map(s=>({site:s,d:Math.hypot(position.x-s.approach.x,position.z-s.approach.z)})).filter(s=>s.d<2.6).sort((a,b)=>a.d-b.d)[0]?.site??null;},interact(site){callbacks.dialog(site.name,`${site.meal} · ${site.price} ₽\nЗдоровье +${site.health} · стресс −${site.stress} · розыск −1 звезда`,[{id:'meal-'+site.id,label:`Купить · ${site.price} ₽`,disabled:state.money<site.price,run(){const result=buyMeal(state,site,world.player.mesh.position);if(result){callbacks.notify(`${site.meal}: +${result.health} здоровья · −${result.stars} звезда · −${result.stress} стресса`);callbacks.changed();callbacks.resume();}}},{id:'leave',label:'Уйти',run:callbacks.resume}]);},get diagnostics(){return {sites,logos,source:'KayKit Restaurant Bits 1.0 · CC0'};},dispose(){build.dispose();const geometries=new Set(),materials=new Set(),textures=new Set();for(const a of assets)a.scene.traverse(n=>{if(n.isMesh){geometries.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material]){materials.add(m);if(m.map)textures.add(m.map);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
