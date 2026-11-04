import {MAP} from '../city/reference-layout.js';
import {mapViewport,miniGoalPoint} from '../city/map-view.js';
import {navigationTarget,TARGET_COLOR} from '../city/navigation-target.js';
import {mapMarkers} from './map-markers.js';
export function drawNavigator(canvas,state,world,background,heading=Math.PI){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,mini=canvas.id==='minimap',view=mapViewport(w,h,state.position,mini,heading),goal=navigationTarget(state,world),hits=[];
 ctx.fillStyle=state.mapMode==='schematic'?'#f4f4f2':'#344c48';ctx.fillRect(0,0,w,h);
 ctx.save();ctx.translate(w/2,h/2);ctx.rotate(view.angle);if(background)ctx.drawImage(background,view.offsetX-w/2,view.offsetY-h/2,MAP.width*view.zoom,MAP.height*view.zoom);ctx.restore();
 const me=view.project(state.position.x,state.position.z),g=goal?view.project(goal.x,goal.z):null;
 if(g){ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.setLineDash([5,5]);ctx.strokeStyle=goal.color??TARGET_COLOR;ctx.lineWidth=mini?3:2;ctx.beginPath();ctx.moveTo(me.x,me.y);ctx.lineTo(g.x,g.y);ctx.stroke();ctx.restore();}
 const priority=m=>m.id===goal?.id?2:m.layer==='shops'&&m.shop===state.selected&&!state.awaitingShopChoice&&!state.mapTarget?1:0;
 for(const m of [...mapMarkers(state,world)].sort((a,b)=>priority(a)-priority(b))){
  const selected=m.id===goal?.id||m.layer==='shops'&&m.shop===state.selected&&!state.awaitingShopChoice&&!state.mapTarget;
  if(!state.mapLayers[m.layer]&&!selected)continue;
  const p=view.project(m.x,m.z),r=mini?7:m.layer==='shops'?12:10;if(p.x<-r||p.x>w+r||p.y<-r||p.y>h+r)continue;
  if(selected){const pulse=1+Math.sin(performance.now()*.004)*.12;ctx.beginPath();ctx.arc(p.x,p.y,(r+6)*pulse,0,Math.PI*2);ctx.fillStyle='#ffbd4540';ctx.fill();ctx.strokeStyle=TARGET_COLOR;ctx.lineWidth=2.5;ctx.stroke();}
  ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=m.done?'#508266':m.locked?'#8b9499':selected?TARGET_COLOR:m.color;ctx.fill();ctx.strokeStyle='#ffffffdc';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle=selected?'#263b43':'#fff';ctx.font=`bold ${mini?8:10}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(m.done?'✓':m.locked?'×':m.symbol,p.x,p.y+.5);hits.push({...m,px:p.x,py:p.y,r:r+5});
 }
 if(g){const p=mini?miniGoalPoint(g,w,h):{...g,edge:false,angle:0},color=goal.color??TARGET_COLOR;
  const hasPin=!mini&&hits.some(m=>m.id===goal.id&&Math.hypot(m.px-g.x,m.py-g.y)<15);if(!hasPin){ctx.save();ctx.translate(p.x,p.y);ctx.shadowColor=color;ctx.shadowBlur=9;ctx.fillStyle=color;ctx.strokeStyle='#17343d';ctx.lineWidth=2;
  if(p.edge){ctx.rotate(p.angle);ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(8,8);ctx.lineTo(0,4);ctx.lineTo(-8,8);ctx.closePath();}else{ctx.beginPath();ctx.arc(0,0,mini?9:7,0,Math.PI*2);}ctx.fill();ctx.stroke();ctx.restore();}if(!mini&&!hasPin)hits.push({...goal,px:g.x,py:g.y,r:14,detail:'Выбранная цель маршрута'});canvas.dataset.targetEdge=String(p.edge);canvas.dataset.targetX=String(p.x);canvas.dataset.targetY=String(p.y);canvas.dataset.targetColor=color;
 }else delete canvas.dataset.targetEdge;
 ctx.save();ctx.translate(me.x,me.y);if(!mini)ctx.rotate(Math.PI-heading);ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(7,8);ctx.lineTo(0,4);ctx.lineTo(-7,8);ctx.closePath();ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle='#143643';ctx.lineWidth=2;ctx.stroke();ctx.restore();
 canvas.dataset.mapZoom=String(view.zoom);canvas.dataset.mapMode=state.mapMode;canvas.dataset.heading=String(heading);canvas.dataset.heroAngle=mini?'0':String(Math.PI-heading);canvas.dataset.markerCount=String(hits.length);
 return hits;
}
