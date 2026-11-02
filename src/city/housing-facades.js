import * as T from 'three';

export const HOUSING_STYLES=[
 {id:'red-brick',name:'Красный кирпич',kind:'brick',base:'#a65d43',joint:'#c5b19a'},
 {id:'silicate-brick',name:'Светлый силикатный кирпич',kind:'brick',base:'#d1c39c',joint:'#a99f87'},
 {id:'brown-brick',name:'Тёмный кирпич',kind:'brick',base:'#80523f',joint:'#ac9d85'},
 {id:'warm-panel',name:'Бежевые панели',kind:'panel',base:'#c4bb9e',accent:'#7e9582'},
 {id:'blue-tile',name:'Бело-голубая плитка',kind:'tile',base:'#d1d8d0',accent:'#789da9'},
 {id:'green-tile',name:'Бело-зелёная плитка',kind:'tile',base:'#cfd6ba',accent:'#809d85'},
 {id:'ochre-plaster',name:'Охристая штукатурка',kind:'plaster',base:'#caaa7c',accent:'#e0d0ae'},
 {id:'rose-panel',name:'Розовые панели',kind:'panel',base:'#c3a398',accent:'#d4c5b3'},
];
export const housingStyleAt=(u,v)=>(Math.floor(u/20)+Math.floor(v/20)*3)%HOUSING_STYLES.length;

// One atlas and one instanced wall material for all eight finishes. Each house
// selects a tile with instanceColor; it never adds bricks as separate objects.
export function createHousingFacades(){
 const size=256,canvas=document.createElement('canvas');canvas.width=size*4;canvas.height=size*2;
 const ctx=canvas.getContext('2d');
 for(const [index,s]of HOUSING_STYLES.entries()){
  ctx.save();ctx.translate(index%4*size,Math.floor(index/4)*size);ctx.beginPath();ctx.rect(0,0,size,size);ctx.clip();
  ctx.fillStyle=s.base;ctx.fillRect(0,0,size,size);
  if(s.kind==='brick'){
   ctx.fillStyle=s.joint;ctx.fillRect(0,0,size,size);
   for(let row=0;row<16;row++)for(let col=-1;col<5;col++){
    ctx.fillStyle=s.base;const x=col*64+(row%2)*32;ctx.fillRect(x+1,row*16+1,62,14);
    ctx.fillStyle=(row*7+col*3)%4===0?'#ffffff12':'#0000000a';ctx.fillRect(x+1,row*16+1,62,14);
   }
  }else if(s.kind==='tile'){
   ctx.fillStyle=s.accent;ctx.fillRect(0,0,size,48);ctx.fillRect(0,208,size,48);
   ctx.strokeStyle='#79877e88';ctx.lineWidth=1;for(let i=0;i<=16;i++){ctx.beginPath();ctx.moveTo(i*16,0);ctx.lineTo(i*16,size);ctx.moveTo(0,i*16);ctx.lineTo(size,i*16);ctx.stroke();}
  }else if(s.kind==='panel'){
   ctx.fillStyle=s.accent;ctx.fillRect(9,9,26,238);ctx.fillStyle='#66736588';ctx.fillRect(0,0,3,size);ctx.fillRect(0,0,size,3);ctx.fillStyle='#fff3da55';ctx.fillRect(3,3,2,size);
  }else{
   ctx.fillStyle=s.accent;ctx.fillRect(0,0,size,10);ctx.fillRect(0,244,size,12);
  }
  // Deterministic plaster grain and weathering, also at a distance in mipmaps.
  for(let i=0;i<700;i++){const x=(i*73+index*13)%256,y=(i*139+index*17)%256;ctx.fillStyle=i%2?'#fff4dc0d':'#322c2810';ctx.fillRect(x,y,1+i%3,1+i%2);}
  ctx.restore();
 }
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;
 const wall=new T.MeshStandardMaterial({map:texture,roughness:.94,color:'#ffffff'});wall.name='residential-finish-atlas';
 wall.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vHousingStyle;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHousingStyle=instanceColor.r*7.0;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vHousingStyle;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','');
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','float houseStyle=floor(vHousingStyle+0.5); vec2 houseTile=vec2(mod(houseStyle,4.0),floor(houseStyle/4.0)); diffuseColor *= texture2D(map,(fract(vMapUv)*0.996+0.002+houseTile)/vec2(4.0,2.0));');
 };
 wall.customProgramCacheKey=()=> 'residential-finish-atlas-v1';
 return {
  wall,
  prepare(geometry){
   const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),uv=new Float32Array(p.count*2);
   for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));uv[i*2]=(nx>nz?p.getZ(i):p.getX(i))/2;uv[i*2+1]=(ny>.8?p.getZ(i):p.getY(i))/2;}
   geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
  },
  dispose(){texture.dispose();wall.dispose();},
 };
}
