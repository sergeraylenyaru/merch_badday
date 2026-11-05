import {FOOD_SITES,MALL_SITE} from './new-places.js';
import {COAST_HOMES,MANSION,coastPixelAt,planCoastDecks} from './coast-layout.js';
import {MAP,ROADS,PEDESTRIAN_ROUTES,RIVERS,COAST,PARK_PATHS,PARK_BRIDGES,POND_ISLAND,PARK_SQUARE,WORK_STOPS,pixel} from './reference-layout.js';
import {MAP_BUILDINGS} from './map-buildings.js';
/** A cached navigator layer built from the same coordinates as the 3D city. */
export function createSchematicMap({labels=true}={}){
 const canvas=document.createElement('canvas');canvas.width=MAP.width;canvas.height=MAP.height;const c=canvas.getContext('2d');
 c.fillStyle='#f5f4f2';c.fillRect(0,0,MAP.width,MAP.height);
 function polygon(points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
 polygon([[660,65],[1025,60],[1117,150],[1118,305],[650,305]],'#bee09f');polygon([[650,370],[1128,370],[1150,660],[1162,706],[1120,770],[650,770],[585,710],[618,560]],'#bee09f');
 for(const [x,y,w,h]of PARK_PATHS){c.fillStyle='#f6f2df';c.fillRect(x-w/2,y-h/2,w,h);}
 const square=pixel(PARK_SQUARE.x,PARK_SQUARE.z);c.beginPath();c.arc(square.x,square.y,PARK_SQUARE.radius/MAP.scale,0,Math.PI*2);c.fillStyle='#f6f2df';c.fill();
 polygon([...COAST,[MAP.width,MAP.height],[0,MAP.height]],'#7bcdf1');
 c.lineCap='round';c.lineJoin='round';for(const [i,river]of RIVERS.entries()){c.beginPath();river.forEach(([x,y],n)=>n?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle='#72c6ed';c.lineWidth=(i?20:26)+4;c.stroke();c.strokeStyle='#7bcdf1';c.lineWidth=i?20:26;c.stroke();}
 c.beginPath();c.ellipse(1015,480,48,50,0,0,Math.PI*2);c.fillStyle='#7bcdf1';c.fill();if(POND_ISLAND.enabled){c.beginPath();c.arc(POND_ISLAND.u,POND_ISLAND.v,POND_ISLAND.radius,0,Math.PI*2);c.fillStyle='#bee09f';c.fill();}
 for(const floor of planCoastDecks().filter(f=>f.kind==='granite-quay'))polygon(floor.polygon.map(p=>{const q=pixel(p.x,p.z);return [q.x,q.y];}),'#b9b2a1');
 for(const h of COAST_HOMES){c.fillStyle=h.color;c.fillRect(h.u-h.w/MAP.scale,h.v-h.d/MAP.scale,h.w*2/MAP.scale,h.d*2/MAP.scale);}c.fillStyle='#98aa86';c.fillRect(MANSION.u-MANSION.w/MAP.scale,MANSION.v-MANSION.d/MAP.scale,MANSION.w*2/MAP.scale,MANSION.d*2/MAP.scale);c.fillStyle='#d4c5ab';c.fillRect(MANSION.u-MANSION.buildingW/MAP.scale,MANSION.v-MANSION.buildingD/MAP.scale,MANSION.buildingW*2/MAP.scale,MANSION.buildingD*2/MAP.scale);
 for(const [name,x,y,w,h,angle]of MAP_BUILDINGS){c.save();c.translate(x,y);c.rotate(angle*Math.PI/180);c.fillStyle='#d1d2d4';c.strokeStyle='#c9cccf';c.lineWidth=1.2;c.fillRect(-w/2,-h/2,w,h);c.strokeRect(-w/2,-h/2,w,h);c.restore();}
 for(const site of FOOD_SITES){c.fillStyle='#d5bd92';c.strokeStyle='#a28b6c';c.lineWidth=1.2;c.fillRect(site.u-site.w/MAP.scale,site.v-site.d/MAP.scale,site.w*2/MAP.scale,site.d*2/MAP.scale);c.strokeRect(site.u-site.w/MAP.scale,site.v-site.d/MAP.scale,site.w*2/MAP.scale,site.d*2/MAP.scale);}
 const mall=pixel(MALL_SITE.x,MALL_SITE.z),mw=MALL_SITE.w/MAP.scale,md=MALL_SITE.d/MAP.scale;c.fillStyle='#c3c1b7';c.strokeStyle='#938b79';c.lineWidth=1.1;c.fillRect(mall.x-mw,mall.y-md,mw*2,md*2);c.strokeRect(mall.x-mw,mall.y-md,mw*2,md*2);for(let i=1;i<4;i++){c.beginPath();c.moveTo(mall.x-mw+i*mw/2,mall.y-md);c.lineTo(mall.x-mw+i*mw/2,mall.y+md);c.stroke();}c.beginPath();c.moveTo(mall.x-mw,mall.y);c.lineTo(mall.x+mw,mall.y);c.stroke();
 for(const shop of WORK_STOPS){c.fillStyle='#dfcbb3';c.strokeStyle='#b29b7d';c.lineWidth=1.5;c.fillRect(shop.u-36.25,shop.v-21,72.5,29);c.strokeRect(shop.u-36.25,shop.v-21,72.5,29);}
 for(const [a,b,x,y,width]of ROADS){c.beginPath();c.moveTo(a,b);c.lineTo(x,y);c.strokeStyle='#b9c0bd';c.lineWidth=width+5;c.stroke();c.strokeStyle=width>=25&&((Math.abs(b-337)<1&&Math.abs(y-337)<1)||a===1390&&x===1390)?'#fff0b3':'#fffefa';c.lineWidth=width;c.stroke();}
 for(const [a,b,x,y,width]of PEDESTRIAN_ROUTES){c.beginPath();c.moveTo(a,b);c.lineTo(x,y);c.strokeStyle='#c8d0c1';c.lineWidth=width+2;c.stroke();c.strokeStyle='#fffef5';c.lineWidth=width;c.stroke();}
 for(const b of PARK_BRIDGES){const p=pixel(b.x,b.z),half=(b.length/2+4)/MAP.scale;c.beginPath();c.moveTo(p.x-Math.cos(b.angle)*half,p.y-Math.sin(b.angle)*half);c.lineTo(p.x+Math.cos(b.angle)*half,p.y+Math.sin(b.angle)*half);c.strokeStyle='#fdfbf0';c.lineWidth=b.width/MAP.scale+2;c.stroke();}
 if(labels){ c.fillStyle='#38433f';c.textAlign='center';c.font='bold 37px Arial';for(const [text,x,y]of [['ЖИЛЫЕ КВАРТАЛЫ',320,140],['ГОРОДСКОЙ ПАРК',870,635],['ДЕЛОВОЙ ЦЕНТР',1435,145]])c.fillText(text,x,y);
 c.font='28px Arial';c.fillStyle='#424b48';c.fillText('Центральный проспект',880,343);c.save();c.translate(1168,580);c.rotate(-Math.PI/2);c.fillText('Деловая улица',0,5);c.restore();
 }
 return canvas;
}
