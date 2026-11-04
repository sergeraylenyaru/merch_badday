import {MAP,ROADS,RIVERS,COAST,PARK_PATHS,PARK_BRIDGES,POND_ISLAND,WORK_STOPS,pixel} from './reference-layout.js';
import {MAP_BUILDINGS} from './map-buildings.js';
/** A cached navigator layer built from the same coordinates as the 3D city. */
export function createSchematicMap(){
 const canvas=document.createElement('canvas');canvas.width=MAP.width;canvas.height=MAP.height;const c=canvas.getContext('2d');
 c.fillStyle='#e8ebe5';c.fillRect(0,0,MAP.width,MAP.height);
 function polygon(points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
 polygon([[660,65],[1025,60],[1117,150],[1118,305],[650,305]],'#c6dbb9');polygon([[650,370],[1128,370],[1150,660],[1162,706],[1120,770],[650,770],[585,710],[618,560]],'#c6dbb9');
 for(const [x,y,w,h]of PARK_PATHS){c.fillStyle='#f6f2df';c.fillRect(x-w/2,y-h/2,w,h);}
 polygon([...COAST,[MAP.width,MAP.height],[0,MAP.height]],'#98cbdc');
 c.lineCap='round';c.lineJoin='round';for(const [i,river]of RIVERS.entries()){c.beginPath();river.forEach(([x,y],n)=>n?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle='#83b8cc';c.lineWidth=(i?20:26)+4;c.stroke();c.strokeStyle='#98cbdc';c.lineWidth=i?20:26;c.stroke();}
 c.beginPath();c.ellipse(1015,480,48,50,0,0,Math.PI*2);c.fillStyle='#98cbdc';c.fill();c.beginPath();c.arc(POND_ISLAND.u,POND_ISLAND.v,POND_ISLAND.radius,0,Math.PI*2);c.fillStyle='#c6dbb9';c.fill();
 for(const [name,x,y,w,h,angle]of MAP_BUILDINGS){c.save();c.translate(x,y);c.rotate(angle*Math.PI/180);c.fillStyle=name.startsWith('office')?'#bdccd5':name==='garage'?'#c5c4bd':'#d2cbbd';c.strokeStyle='#b5b5aa';c.lineWidth=1.2;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.restore();}
 for(const shop of WORK_STOPS){c.fillStyle='#dfcbb3';c.strokeStyle='#b29b7d';c.lineWidth=1.5;c.fillRect(shop.u-36.25,shop.v-21,72.5,29);c.strokeRect(shop.u-36.25,shop.v-21,72.5,29);}
 for(const [a,b,x,y,width]of ROADS){c.beginPath();c.moveTo(a,b);c.lineTo(x,y);c.strokeStyle='#b9c0bd';c.lineWidth=width+5;c.stroke();c.strokeStyle='#fffefa';c.lineWidth=width;c.stroke();}
 for(const b of PARK_BRIDGES){const p=pixel(b.x,b.z),half=(b.length/2+4)/MAP.scale;c.beginPath();c.moveTo(p.x-Math.cos(b.angle)*half,p.y-Math.sin(b.angle)*half);c.lineTo(p.x+Math.cos(b.angle)*half,p.y+Math.sin(b.angle)*half);c.strokeStyle='#fdfbf0';c.lineWidth=b.width/MAP.scale+2;c.stroke();}
 c.fillStyle='#65766e';c.textAlign='center';c.font='bold 25px Arial';for(const [text,x,y]of [['ЖИЛЫЕ КВАРТАЛЫ',320,115],['ГОРОДСКОЙ ПАРК',850,650],['ДЕЛОВОЙ ЦЕНТР',1435,120]])c.fillText(text,x,y);
 c.font='18px Arial';c.fillStyle='#7d8982';c.fillText('Центральный проспект',880,343);c.save();c.translate(1168,580);c.rotate(-Math.PI/2);c.fillText('Деловая улица',0,5);c.restore();
 return canvas;
}
