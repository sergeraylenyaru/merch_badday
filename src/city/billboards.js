import * as T from 'three';
import {ROAD_PROFILES} from './terrain.js';
import {boxesIntersect} from '../spatial.js';
import {meetsStreet,point} from './reference-layout.js';
export function planBillboards(blockers=[]){
 const wanted=[[170,295],[430,295],[830,295],[1220,295],[1490,380],[510,610],[1180,660]],out=[];
 for(const uv of wanted){const target=point(...uv),choices=[];
  for(const road of ROAD_PROFILES.filter(r=>Math.abs(r.dx)<.01||Math.abs(r.dz)<.01))for(let d=12;d<road.length-12;d+=12)for(const side of [-1,1]){
   const x=road.start.x+road.dx*d+road.dz*(road.width/2+4.4)*side,z=road.start.z+road.dz*d-road.dx*(road.width/2+4.4)*side,angle=-Math.atan2(road.dz,road.dx),shape={x,z,w:4.3,d:1.8,heading:angle};
   if(meetsStreet(x,z,8.6,3.6,angle)||blockers.some(b=>b.enabled!==false&&boxesIntersect(shape,b))||out.some(b=>Math.hypot(x-b.x,z-b.z)<45))continue;
   choices.push({x,z,angle,score:Math.hypot(x-target.x,z-target.z)});
  }
  const chosen=choices.sort((a,b)=>a.score-b.score)[0];if(chosen)out.push({id:'billboard:'+out.length,...chosen});
 }return out;
}
export function createBillboards(scene,world){
 const root=new T.Group();root.name='seven-roadside-billboards';scene.add(root);const owned=[],materials=[],textures=[],boards=planBillboards(world.blockers);
 const box=(parent,x,y,z,w,h,d,color)=>{const g=new T.BoxGeometry(w,h,d),m=new T.MeshStandardMaterial({color,roughness:.8}),mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);parent.add(mesh);owned.push(g);materials.push(m);};
 const ads=[['СВЕЖАК','Свежий хлеб каждый день','#386d58'],['ЗАЕЗЖАЙ НА КОФЕ','Пять минут для себя','#a35743'],['ШИНОМОНТАЖ','Переобуем без очереди','#365773'],['ГОРОДСКОЙ ПАРК','Новый взгляд на город','#6a7b48'],['ДОСТАВКА РЯДОМ','От магазина до подъезда','#835464'],['ТВОЯ СМЕНА','Работа найдётся каждому','#aa793f'],['БЕРЕГИ НЕРВЫ','Спокойный день — хороший день','#426b78']];
 for(const [i,b]of boards.entries()){
  const group=new T.Group();group.position.set(b.x,0,b.z);group.rotation.y=b.angle;root.add(group);box(group,0,3.75,0,.4,7.5,.4,'#666e69');box(group,0,7.38,-.65,8,.24,2.6,'#64756b');box(group,0,9.6,.6,8.3,4.1,.18,'#4d5b55');
  const c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d'),[title,text,color]=ads[i];ctx.fillStyle=color;ctx.fillRect(0,0,1024,512);ctx.strokeStyle='#eadbb1';ctx.lineWidth=10;ctx.strokeRect(24,24,976,464);ctx.fillStyle='#fff0c7';ctx.textAlign='center';ctx.font='bold 62px Arial';ctx.fillText(title,512,230,920);ctx.font='34px Arial';ctx.fillText(text,512,320,900);
  const t=new T.CanvasTexture(c),g=new T.PlaneGeometry(8,3.8),m=new T.MeshBasicMaterial({map:t});textures.push(t);owned.push(g);materials.push(m);for(const side of [-1,1]){const face=new T.Mesh(g,m);face.position.set(0,9.6,.6+side*.1);face.rotation.y=side<0?Math.PI:0;group.add(face);}
  const transform=(x,z)=>({x:b.x+Math.cos(b.angle)*x+Math.sin(b.angle)*z,z:b.z-Math.sin(b.angle)*x+Math.cos(b.angle)*z});
  for(let y=.5;y<7.5;y+=1.4)box(group,0,y,-.25,.8,.05,.14,'#7d8980');
  const center=transform(0,-.65),base=transform(0,-.30),exit=transform(0,-.85),normal={nx:-Math.sin(b.angle),nz:-Math.cos(b.angle)};
  const w=Math.abs(Math.cos(b.angle))*4+Math.abs(Math.sin(b.angle))*1.3,d=Math.abs(Math.sin(b.angle))*4+Math.abs(Math.cos(b.angle))*1.3;
  world.roofs.push({id:b.id,...center,w,d,y:7.5,kind:'billboard',ladder:{...base,...normal,exit:{...exit,y:7.5}}});
  const p=world.box(b.x,3.75,b.z,.4,7.5,.4,'#666e69',true);p.visible=false;
 }
 return {diagnostics:{count:boards.length,boards},dispose(){root.removeFromParent();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
