import * as T from 'three';
export const GARAGE_STYLES=['brick','block','metal','plaster'];
export const garageStyleAt=(u,v)=>(Math.round(u/16)+Math.round(v/42))%4;
export function createGarageStyles(){
 const wall=new T.MeshStandardMaterial({color:'#ffffff',roughness:.95});
 wall.onBeforeCompile=s=>{
  s.vertexShader='varying vec3 garagePosition; varying vec3 garageNormal; varying float garageStyle;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ngaragePosition=(modelMatrix*instanceMatrix*vec4(transformed,1.)).xyz;garageStyle=instanceColor.r*3.;garageNormal=normalize(mat3(modelMatrix*instanceMatrix)*objectNormal);');
  s.fragmentShader='varying vec3 garagePosition; varying vec3 garageNormal; varying float garageStyle;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float style=floor(garageStyle+.1);vec3 p=garagePosition;float h=abs(garageNormal.x)<.5?p.x:p.z;
   vec3 color=style<.5?vec3(.55,.28,.18):style<1.5?vec3(.58,.59,.53):style<2.5?vec3(.33,.48,.42):vec3(.70,.65,.50);
   if(style<1.5){float tall=style<.5?.21:.43;float wide=style<.5?.48:.86;float row=floor(p.y/tall);vec2 cell=fract(vec2(h/wide+mod(row,2.)*.5,p.y/tall));float joint=step(cell.x,.055)+step(cell.y,.10);color=mix(color,vec3(.27,.28,.25),min(1.,joint)*.7);}
   if(style>1.5&&style<2.5)color*=.78+.22*sin(h*38.);
   diffuseColor.rgb=color;
  `);
 };
 wall.customProgramCacheKey=()=> 'garage-four-finishes-v1';
 return {wall,dispose(){wall.dispose();}};
}
