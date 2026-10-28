import {MAP,pixel} from './reference-layout.js';
export const MINIMAP_SPAN = 360;
export function mapViewport(width,height,position,mini=false){
 const player=pixel(position.x,position.z);
 const zoom=mini?width/MINIMAP_SPAN:Math.min(width/MAP.width,height/MAP.height);
 const offsetX=mini?width/2-player.x*zoom:(width-MAP.width*zoom)/2;
 const offsetY=mini?height/2-player.y*zoom:(height-MAP.height*zoom)/2;
 return {zoom,offsetX,offsetY,project(x,z){const p=pixel(x,z);return{x:p.x*zoom+offsetX,y:p.y*zoom+offsetY};},unproject(x,y){return{u:(x-offsetX)/zoom,v:(y-offsetY)/zoom};}};
}
