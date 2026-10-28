import {boxesIntersect} from '../spatial.js';
// Coordinates measured on the user's 1672 × 941 map. Z increases south.
export const MAP = {width:1672,height:941,scale:0.4,x:-334,z:-188};
export const point = (u,v) => ({x:MAP.x+u*MAP.scale,z:MAP.z+v*MAP.scale});
export const pixel = (x,z) => ({x:(x-MAP.x)/MAP.scale,y:(z-MAP.z)/MAP.scale});
export const WORK_STOPS = [
 ['C1',110,285],['C2',110,562],['P1',754,173],['O1',1305,223],
 ['O2',1300,575],['O3',1590,548],['P2',1034,273],['C3',407,622],['P3',735,585],
].map(([code,u,v],id)=>({id,code,u,v,...point(u,v)}));
export const START = {...point(151,300)};
export const ROUNDABOUT={u:1390,v:337,radius:37,width:25};
export const ROADS = [
 [0,337,1340,337,38],[1440,337,1672,337,38],
 [239,15,239,578,25],[239,578,273,600,22],[273,600,277,650,22],[277,650,277,685,22],[500,42,500,681,24],
 [1168,0,1168,710,27],[1390,0,1390,287,27],[1390,387,1390,941,27],
 [30,20,239,20,14],[270,37,500,37,20],[30,20,30,781,20],
 [30,685,335,685,20],[239,578,500,578,20],
 [335,578,335,742,19],[335,742,365,760,19],[365,760,475,760,19],[475,760,500,738,19],[500,738,500,681,19],
 [500,681,650,770,20],
 [1168,20,1672,20,18],[1168,650,1672,650,24],
 [1168,710,1185,750,26],[1185,750,1235,780,26],[1235,780,1672,780,26],
 [1660,30,1660,780,14],
 // The two park bridges and the promenade retain their traced diagonals.
 [500,70,615,80,13],[615,80,660,65,13],[660,65,710,65,13],
 [1025,60,1120,20,13],[1030,440,1145,490,13],
 [650,770,1120,770,14],
 ...Array.from({length:32},(_,i)=>{const a=i*Math.PI/16,b=(i+1)*Math.PI/16;return [1390+Math.cos(a)*37,337+Math.sin(a)*37,1390+Math.cos(b)*37,337+Math.sin(b)*37,25];}),
];
export const PIER=[865,810,865,880,22];
export const RIVERS=[
 [[710,-20],[660,25],[640,70],[635,120],[637,200],[640,280],[641,340],[640,410],[623,480],[618,560],[608,625],[601,670],[585,710],[578,750],[593,800]],
 [[1020,-10],[1070,35],[1095,90],[1116,150],[1114,220],[1118,280],[1128,340],[1136,400],[1139,450],[1135,490],[1140,550],[1140,600],[1148,660],[1162,706],[1173,750],[1195,870]],
];
export const COAST=[[0,847],[120,855],[230,879],[300,878],[360,851],[430,830],[500,809],[565,798],[625,802],[690,808],[760,813],[800,811],[850,820],[900,820],[970,826],[1040,827],[1110,847],[1170,876],[1240,887],[1320,886],[1390,880],[1480,900],[1570,914],[1672,914]];
export const segmentDistance=(u,v,a,b,c,d)=>{const dx=c-a,dy=d-b,t=Math.max(0,Math.min(1,((u-a)*dx+(v-b)*dy)/(dx*dx+dy*dy)));return Math.hypot(u-a-t*dx,v-b-t*dy);};
export function rawWater(u,v){
 let sea=COAST.at(-1)[1];for(let i=1;i<COAST.length;i++){const a=COAST[i-1],b=COAST[i];if(u<=b[0]){sea=a[1]+(b[1]-a[1])*(u-a[0])/(b[0]-a[0]);break;}}
 if(v>sea)return true;
 if(((u-1015)/48)**2+((v-480)/50)**2<1)return true;
 return RIVERS.some((river,i)=>river.some((p,n)=>n>0&&segmentDistance(u,v,...river[n-1],...p)<(i?10:13)));
}
export const isReferenceWater=(u,v)=>rawWater(u,v)&&!nearRoad(u,v,0)&&segmentDistance(u,v,...PIER.slice(0,4))>PIER[4]/2&&!(u>837.5&&u<892.5&&v>870&&v<882);
export const LOCAL_POINTS = [[560,210],[560,562],[1059,601],[850,708],[1305,716],[1508,713]];
export const districtAt = x => x < point(640,0).x ? 0 : x < point(1150,0).x ? 1 : 2;
export function nearRoad(u,v,margin=0) {
 return ROADS.some(([a,b,c,d,width])=>segmentDistance(u,v,a,b,c,d)<width/2+margin);
}

export const ROAD_BOXES=ROADS.map(([a,b,c,d,width])=>{const start=point(a,b),end=point(c,d);return {x:(start.x+end.x)/2,z:(start.z+end.z)/2,w:width*MAP.scale/2,d:Math.hypot(end.x-start.x,end.z-start.z)/2,heading:Math.atan2(end.x-start.x,end.z-start.z)};});
export const meetsStreet=(x,z,w,d,heading=0)=>ROAD_BOXES.some(road=>boxesIntersect({x,z,w:w/2,d:d/2,heading},road));

// Centres of the pins already printed on the supplied image. Doors remain
// separate navigation targets, so the tablet does not draw duplicate labels.
export const MAP_MARKERS = [[106,240],[108,525],[783,138],[1303,162],[1297,512],[1594,481],[1017,225],[408,584],[735,533]];
