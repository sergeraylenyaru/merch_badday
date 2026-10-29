import { MAP, ROADS, RIVERS, COAST, point, pixel, segmentDistance, PIER } from './reference-layout.js';
export const WATER_LEVEL = -0.45;
export const BRIDGE_HEIGHT = 0.55;
export function waterDistance(u,v) {
  let coast=COAST.at(-1)[1];
  for(let i=1;i<COAST.length;i++){const a=COAST[i-1],b=COAST[i];if(u<=b[0]){coast=a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]);break;}}
  let distance=coast-v;
  distance=Math.min(distance,(Math.hypot((u-1015)/48,(v-480)/50)-1)*48);
  for(const [i,river] of RIVERS.entries())for(let n=1;n<river.length;n++)distance=Math.min(distance,segmentDistance(u,v,...river[n-1],...river[n])-(i?10:13));
  return distance;
}
export const terrainHeight=(x,z)=>{const p=pixel(x,z);return Math.min(0,Math.max(-1.1,(waterDistance(p.x,p.y)-3)*.14));};
export const ROAD_PROFILES=ROADS.map(([a,b,c,d,width])=>{
  const start=point(a,b),end=point(c,d),length=Math.hypot(end.x-start.x,end.z-start.z),steps=Math.max(1,Math.ceil(length/1.2));
  const crossings=[];for(let i=0;i<=steps;i++){const t=i/steps;if(waterDistance(a+(c-a)*t,b+(d-b)*t)<width/2+3)crossings.push(t*length);}
  const heightAt=s=>{let h=.025;for(const cross of crossings)h=Math.max(h,BRIDGE_HEIGHT*Math.max(0,1-Math.max(0,Math.abs(s-cross)-2)/12));return h;};
  return {start,end,length,width:width*MAP.scale,dx:(end.x-start.x)/length,dz:(end.z-start.z)/length,steps,heightAt,crossings};
});
export function roadHeight(x,z) {
  let height=terrainHeight(x,z);
  for(const road of ROAD_PROFILES){const along=(x-road.start.x)*road.dx+(z-road.start.z)*road.dz;
    if(along<-.08||along>road.length+.08)continue;
    const across=Math.abs((x-road.start.x)*road.dz-(z-road.start.z)*road.dx);
    if(across<=road.width/2+.02)height=Math.max(height,road.heightAt(Math.max(0,Math.min(road.length,along))));}
  const p=pixel(x,z);if(segmentDistance(p.x,p.y,...PIER.slice(0,4))<=PIER[4]/2 || (p.x>837.5&&p.x<892.5&&p.y>870&&p.y<882))height=Math.max(height,.12);
  return height;
}
export function gridTerrain(step=4) {
 const columns=Math.ceil(MAP.width/step),rows=Math.ceil(MAP.height/step),positions=[],uv=[],indices=[];
 for(let j=0;j<=rows;j++)for(let i=0;i<=columns;i++){const p=point(i*MAP.width/columns,j*MAP.height/rows);positions.push(p.x,terrainHeight(p.x,p.z),p.z);uv.push(p.x/4,p.z/4);}
 for(let j=0;j<rows;j++)for(let i=0;i<columns;i++){const a=j*(columns+1)+i,b=a+1,c=a+columns+1,d=c+1;indices.push(a,c,b,b,c,d);}
 return {positions,uv,indices};
}
