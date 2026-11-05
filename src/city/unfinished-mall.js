import * as T from 'three';
import {MALL_SITE} from './new-places.js';
import {sceneBuilder} from './scene-builder.js';
import {createConstructionWorkers} from '../npc/construction-workers.js';
export function createUnfinishedMall(scene,world,state,{human}){
 const build=sceneBuilder(scene,world,'unfinished-shopping-center'),s=MALL_SITE,scaleX=s.w/24,platforms=[],ladders=[],beams=[],stoneSites=[];
 const box=(x,y,z,w,h,d,color,solid=false)=>build.box(s.x+x*scaleX,y,s.z+z,w*scaleX,h,d,color,solid);
 function beam(x,y,z,length,heading=0){const position=new T.Vector3(s.x+x*scaleX,y,s.z+z),rotation=new T.Euler(0,heading,0);for(const [dy,w,h]of [[0,.08,.32],[-.18,.34,.045],[.18,.34,.045]]){const g=new T.BoxGeometry(w,h,length*(heading?scaleX:1));g.translate(0,dy,0);build.geometry(g,'#745a46',position,rotation);}
  const surface={x:position.x,z:position.z,w:heading?length*scaleX/2:.17,d:heading?.17:length/2,y:y+.2025,narrow:true,kind:'steel-beam'};beams.push(surface);world.parkourSurfaces.push(surface);const g=new T.PlaneGeometry(surface.w*2,surface.d*2).rotateX(-Math.PI/2).translate(surface.x,surface.y,surface.z);world.terrainCollider(g);build.owned.push(g);
 }
 box(0,.10,0,48,.20,30,'#a09e8f');world.addSurface(s.x,s.z,s.w*2,s.d*2,.2);
 for(const x of [-23,-11.5,0,11.5,23])for(const z of [-14,0,14]){box(x,6.4,z,.28,12.8,.28,'#6a5847',true);for(const dx of [-.18,.18])box(x+dx,6.4,z,.045,12.8,.46,'#7d6550');box(x,.25,z,1.2,.3,1.2,'#8d8c80',true);}
 for(const [i,y]of [4.2,8.4,12.6].entries()){
  for(const z of [-14,0,14])beam(0,y-.25,z,46,Math.PI/2);for(const x of [-23,-11.5,0,11.5,23])beam(x,y-.25,0,28);
  for(const [x,z,w,d]of [[-21,0,4,30],[21,0,4,30],[0,-13,38,4],[0,13,38,4],[0,0,38,3]]){box(x,y-.1,z,w,.2,d,'#a09a87',true);const surface={x:s.x+x*scaleX,z:s.z+z,w:w*scaleX/2,d:d/2,y};world.parkourSurfaces.push(surface);platforms.push(surface);}
  const x=-21+i*7,ladder={x:s.x+x*scaleX,z:s.z+15.12,nx:0,nz:1,width:.56,y0:i*4.2,exit:{x:s.x+x*scaleX,z:s.z+13,y}};
  world.roofs.push({id:'mall-ladder:'+i,x:s.x+x*scaleX,z:s.z+13,w:2*scaleX,d:2,y,kind:'construction',ladder});ladders.push({id:'mall-ladder:'+i,...ladder,top:y});
 }
 const blocks=[[-9,-5,2.5,.7,1],[11,6,2.8,.9,1.1],[15,-7,2.5,.7,1],[-14,8,2.1,.65,1.1]];
 for(const [x,z,w,h,d]of blocks){box(x,h/2+.2,z,w,h,d,'#a6a69a',true);for(const dx of [-w*.3,w*.3])box(x+dx,h+.22,z,.06,.12,.18,'#6d716b');}
 const walls=[{x:1,z:-8,y:.2,w:8,h:1.7},{x:11,z:4,y:.2,w:6,h:1.2},{x:0,z:-13,y:4.2,w:7,h:1.3},{x:9,z:1,y:8.4,w:6,h:1.5}];
 for(const wall of walls){box(wall.x,wall.y+wall.h/2,wall.z,wall.w,wall.h,.28,'#996e50',true);for(let row=0;row<Math.floor(wall.h/.19);row++)for(let j=0;j<Math.floor(wall.w/.42);j++){const x=wall.x-wall.w/2+.23+j*.42+(row%2)*.16;if(x>wall.x+wall.w/2-.15)continue;box(x,wall.y+.1+row*.19,wall.z-.147,.38,.16,.018,(row+j)%3?'#bd8b62':'#a77455');}}
 for(const [floor,y]of [.2,4.2,8.4,12.6].entries()){
  for(const [index,[x,z]]of [[-21,-7],[21,5],[3,13],[8,-13]].entries()){stoneSites.push({x:s.x+x*scaleX+(index%2?-.7:.7),z:s.z+z,y,kind:'construction'});}
  for(const [x,z]of [[-22.5,5],[22.5,-5]]){box(x,y+.14,z,1,.28,.7,'#8c6347',true);for(let row=0;row<2;row++)for(let j=0;j<3;j++)box(x+(j-1)*.34,y+.08+row*.14,z,.3,.12,.28,(j+row+floor)%2?'#c98a5f':'#b77a51');}
 }
 // Diagonal steel braces on the back leave the open front and ladder landings clear.
 for(const x of [-17.25,5.75])for(const y of [2.1,6.3,10.5]){const g=new T.BoxGeometry(12.3*scaleX,.12,.12);build.geometry(g,'#655747',new T.Vector3(s.x+x*scaleX,y,s.z-14),new T.Euler(0,0,.34));}
 build.sign(build.root,'ТЦ «ГОРИЗОНТ» · СТРОЙКА',17*scaleX,1.2,s.x+5*scaleX,2.0,s.z+15.1,{background:'#54654f',color:'#e9dba8'});build.finish();
 const crew=createConstructionWorkers(world,state,s,ladders,{human});
 return {stoneSites,updateWorker:crew.update,get diagnostics(){return {...s,levels:[4.2,8.4,12.6],platforms,ladders,beams,stoneSites,blocks:blocks.length,walls:4,brickStacks:8,workers:crew.diagnostics,openFrame:true};},dispose:build.dispose};
}
