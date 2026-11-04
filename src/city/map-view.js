import {MAP,pixel} from './reference-layout.js';
export const MINIMAP_SPAN=360;
export function mapViewport(width,height,position,mini=false,heading=Math.PI){
 const player=pixel(position.x,position.z),zoom=mini?width/MINIMAP_SPAN:Math.min(width/MAP.width,height/MAP.height),offsetX=mini?width/2-player.x*zoom:(width-MAP.width*zoom)/2,offsetY=mini?height/2-player.y*zoom:(height-MAP.height*zoom)/2,angle=mini?heading-Math.PI:0,c=Math.cos(angle),s=Math.sin(angle);
 return {zoom,offsetX,offsetY,angle,project(x,z){const p=pixel(x,z),px=p.x*zoom+offsetX-width/2,py=p.y*zoom+offsetY-height/2;return {x:width/2+c*px-s*py,y:height/2+s*px+c*py};},unproject(x,y){const dx=x-width/2,dy=y-height/2;return {u:(width/2+c*dx+s*dy-offsetX)/zoom,v:(height/2-s*dx+c*dy-offsetY)/zoom};}};
}
export function miniGoalPoint(point,width,height,margin=18){const dx=point.x-width/2,dy=point.y-height/2,t=Math.min(1,(width/2-margin)/Math.max(.00001,Math.abs(dx)),(height/2-margin)/Math.max(.00001,Math.abs(dy)));return {x:width/2+dx*t,y:height/2+dy*t,edge:t<1,angle:Math.atan2(dy,dx)+Math.PI/2};}
