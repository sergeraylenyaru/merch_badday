import * as T from 'three';
import {MAP} from './reference-layout.js';
/** One static overhead render of the real city, with no baked navigation pins. */
export function captureSatelliteMap(renderer,scene,world,extras=[]){
 const canvas=document.createElement('canvas');canvas.width=MAP.width;canvas.height=MAP.height;const width=MAP.width*MAP.scale,height=MAP.height*MAP.scale,camera=new T.OrthographicCamera(-width/2,width/2,height/2,-height/2,450,680),cx=MAP.x+width/2,cz=MAP.z+height/2;camera.position.set(cx,650,cz);camera.up.set(0,0,-1);camera.lookAt(cx,0,cz);camera.updateMatrixWorld();
 const target=new T.WebGLRenderTarget(MAP.width,MAP.height,{type:T.UnsignedByteType});target.texture.colorSpace=T.SRGBColorSpace;const previous=renderer.getRenderTarget(),fog=scene.fog,shadows=renderer.shadowMap.enabled,hidden=new Map();
 target.depthTexture=new T.DepthTexture(MAP.width,MAP.height,T.FloatType);
 const hide=o=>{if(o&&!hidden.has(o)){hidden.set(o,o.visible);o.visible=false;}};for(const o of [world.player.mesh,...world.people.map(n=>n.mesh),...world.vehicles.map(v=>v.mesh),...extras])hide(o);
 scene.traverse(o=>{if(o.isSprite||o.name.startsWith('weapon-rig:')||o.userData.navigationOverlay||['neighbourhood-sky','city-adventures','collectable-and-thrown-stones'].includes(o.name))hide(o);});
 try{scene.fog=null;renderer.shadowMap.enabled=false;renderer.setRenderTarget(target);renderer.clear();renderer.render(scene,camera);const data=new Uint8Array(MAP.width*MAP.height*4);renderer.readRenderTargetPixels(target,0,0,MAP.width,MAP.height,data);const image=new ImageData(MAP.width,MAP.height),row=MAP.width*4;for(let y=0;y<MAP.height;y++)image.data.set(data.subarray(y*row,(y+1)*row),(MAP.height-y-1)*row);canvas.getContext('2d').putImageData(image,0,0);}finally{scene.fog=fog;renderer.shadowMap.enabled=shadows;for(const [o,visible]of hidden)o.visible=visible;renderer.setRenderTarget(previous);target.dispose();}
 return canvas;
}
