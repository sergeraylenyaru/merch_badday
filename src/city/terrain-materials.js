import {TextureLoader,MeshStandardMaterial,RepeatWrapping,SRGBColorSpace} from 'three';
export async function createTerrainMaterials(){
 const base=`${import.meta.env.BASE_URL}models/city-pack/`;
 const response=await fetch(base+'texture-files.json');if(!response.ok)throw Error('City texture manifest unavailable');const files=await response.json();
 const loader=new TextureLoader(),textures=new Map();
 const definitions={grass:['#708666'],asphalt:['#414f59'],water:['#287f9d'],sand:['#d7bf88'],concretepaving:['#bcad8e','#bdb7a4']};
 const byColor=new Map(),materials=[];
 await Promise.all(Object.entries(definitions).map(async([name,colors])=>{
  const maps=await Promise.all(['base','normal','metal_rough'].map(async(role)=>{
   const file=files[`${name}_${role}.png`];if(!file)throw Error('Missing terrain texture '+name+' '+role);
   const texture=await loader.loadAsync(base+'textures/'+file);texture.wrapS=texture.wrapT=RepeatWrapping;texture.flipY=false;if(role==='base')texture.colorSpace=SRGBColorSpace;texture.anisotropy=4;textures.set(file,texture);return texture;
  }));
  const material=new MeshStandardMaterial({map:maps[0],normalMap:maps[1],roughnessMap:maps[2],metalnessMap:maps[2],roughness:1,metalness:1});material.userData.tileSize=name==='water'?6:4;materials.push(material);for(const color of colors)byColor.set(color,material);
 }));
 return {byColor,water:byColor.get('#287f9d'),dispose(){for(const m of materials)m.dispose();for(const t of textures.values())t.dispose();}};
}
export function tileBoxUV(geometry,width,height,depth,tileSize){
 const uv=geometry.attributes.uv,normal=geometry.attributes.normal;
 for(let i=0;i<uv.count;i++){const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i));const w=nx>.5?depth:width,h=ny>.5?depth:height;uv.setXY(i,uv.getX(i)*w/tileSize,uv.getY(i)*h/tileSize);}
}
