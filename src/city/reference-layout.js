import {boxesIntersect} from '../spatial.js';
// Coordinates measured on the user's 1672 × 941 map. Z increases south.
export const MAP = {width:1672,height:941,scale:0.3,x:-250,z:-140};
export const point = (u,v) => ({x:MAP.x+u*MAP.scale,z:MAP.z+v*MAP.scale});
export const pixel = (x,z) => ({x:(x-MAP.x)/MAP.scale,y:(z-MAP.z)/MAP.scale});
export const WORK_STOPS = [
 ['C1',107,275],['C2',108,550],['P1',754,165],['O1',1305,211],
 ['O2',1300,568],['O3',1590,526],['P2',1030,270],['C3',410,615],['P3',735,575],
].map(([code,u,v],id)=>({id,code,u,v,...point(u,v)}));
export const START = {...point(151,300)};
export const ROADS = [
 [0,340,1672,340,35], [250,0,250,770,25], [500,0,500,700,24],
 [1168,0,1168,710,27], [1390,0,1390,941,27],
 [30,40,620,40,21], [30,40,30,780,20], [30,590,250,590,20], [250,590,350,575,20], [350,575,500,575,20],
 [350,590,350,800,19], [350,800,500,800,20], [500,700,575,770,20],
 [1168,30,1672,30,20], [1168,650,1672,650,24],
 [1168,710,1235,780,26], [1235,780,1672,780,26], [1660,30,1660,780,14],
 [640,745,1120,745,16], [570,80,1050,80,13], [1050,80,1135,35,13],
 [1030,440,1145,490,13],
];
export const LOCAL_POINTS = [[570,210],[570,540],[1060,620],[850,715],[1300,725],[1510,720]];
export const districtAt = x => x < point(640,0).x ? 0 : x < point(1150,0).x ? 1 : 2;
export function nearRoad(u,v,margin=0) {
 return ROADS.some(([a,b,c,d,width])=>{const dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((u-a)*dx+(v-b)*dy)/(dx*dx+dy*dy)));return Math.hypot(u-a-t*dx,v-b-t*dy)<width/2+margin;});
}

export const ROAD_BOXES=ROADS.map(([a,b,c,d,width])=>{const start=point(a,b),end=point(c,d);return {x:(start.x+end.x)/2,z:(start.z+end.z)/2,w:width*MAP.scale/2,d:Math.hypot(end.x-start.x,end.z-start.z)/2,heading:Math.atan2(end.x-start.x,end.z-start.z)};});
export const meetsStreet=(x,z,w,d,heading=0)=>ROAD_BOXES.some(road=>boxesIntersect({x,z,w:w/2,d:d/2,heading},road));
