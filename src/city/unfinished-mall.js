import * as T from 'three';
import {MALL_SITE} from './new-places.js';
import {sceneBuilder} from './scene-builder.js';
export function createUnfinishedMall(scene,world){
 const build=sceneBuilder(scene,world,'unfinished-shopping-center'),s=MALL_SITE,scaleX=s.w/24,platforms=[],ladders=[];
 const box=(x,y,z,w,h,d,color,solid=false)=>build.box(s.x+x*scaleX,y,s.z+z,w*scaleX,h,d,color,solid);
 function beam(x,y,z,length,heading=0){const position=new T.Vector3(s.x+x*scaleX,y,s.z+z),rotation=new T.Euler(0,heading,0);for(const [dy,w,h]of [[0,.08,.32],[-.18,.34,.045],[.18,.34,.045]]){const g=new T.BoxGeometry(w,h,length*(heading?scaleX:1));g.translate(0,dy,0);build.geometry(g,'#745a46',position,rotation);}}
 box(0,.10,0,48,.20,30,'#a09e8f',true);
 for(const x of [-23,-11.5,0,11.5,23])for(const z of [-14,0,14]){box(x,6.4,z,.28,12.8,.28,'#6a5847',true);for(const dx of [-.18,.18])box(x+dx,6.4,z,.045,12.8,.46,'#7d6550');box(x,.25,z,1.2,.3,1.2,'#8d8c80',true);}
 for(const [i,y]of [4.2,8.4,12.6].entries()){
  for(const z of [-14,0,14])beam(0,y-.25,z,46,Math.PI/2);for(const x of [-23,-11.5,0,11.5,23])beam(x,y-.25,0,28);
  for(const [x,z,w,d]of [[-21,0,4,30],[21,0,4,30],[0,-13,38,4],[0,13,38,4],[0,0,38,3]]){box(x,y-.1,z,w,.2,d,'#a09a87',true);const surface={x:s.x+x*scaleX,z:s.z+z,w:w*scaleX/2,d:d/2,y};world.parkourSurfaces.push(surface);platforms.push(surface);}
  const x=-21+i*7,ladder={x:s.x+x*scaleX,z:s.z+15.12,nx:0,nz:1,y0:i*4.2,exit:{x:s.x+x*scaleX,z:s.z+13,y}};
  world.roofs.push({id:'mall-ladder:'+i,x:s.x+x*scaleX,z:s.z+13,w:2*scaleX,d:2,y,kind:'construction',ladder});ladders.push({id:'mall-ladder:'+i,...ladder,top:y});
 }
 // Diagonal steel braces on the back leave the open front and ladder landings clear.
 for(const x of [-17.25,5.75])for(const y of [2.1,6.3,10.5]){const g=new T.BoxGeometry(12.3*scaleX,.12,.12);build.geometry(g,'#655747',new T.Vector3(s.x+x*scaleX,y,s.z-14),new T.Euler(0,0,.34));}
 build.sign(build.root,'ТЦ «ГОРИЗОНТ» · СТРОЙКА',17*scaleX,1.2,s.x+5*scaleX,2.0,s.z+15.1,{background:'#54654f',color:'#e9dba8'});build.finish();
 return {diagnostics:{...s,levels:[4.2,8.4,12.6],platforms,ladders,openFrame:true},dispose:build.dispose};
}
