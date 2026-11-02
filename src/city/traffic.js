import {ROADS,point} from './reference-layout.js';
import {vehicleBox} from '../spatial.js';

// Split road crossings so local drivers turn at real junctions and use both lanes.
export function buildRoadGraph(){
 const roads=ROADS.map(([a,b,c,d,width])=>({a:point(a,b),b:point(c,d),width:width*.4,cuts:[0,1]}));
 for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
  const p=roads[i],q=roads[j],rx=p.b.x-p.a.x,rz=p.b.z-p.a.z,sx=q.b.x-q.a.x,sz=q.b.z-q.a.z,den=rx*sz-rz*sx;if(Math.abs(den)<1e-7)continue;
  const dx=q.a.x-p.a.x,dz=q.a.z-p.a.z,t=(dx*sz-dz*sx)/den,u=(dx*rz-dz*rx)/den;if(t>=0&&t<=1&&u>=0&&u<=1){p.cuts.push(t);q.cuts.push(u);}
 }
 const nodes=[],edges=[],keys=new Map();
 const node=p=>{const k=Math.round(p.x*100)+':'+Math.round(p.z*100);if(!keys.has(k)){keys.set(k,nodes.length);nodes.push({...p,edges:[]});}return keys.get(k);};
 for(const road of roads){const cuts=[...new Set(road.cuts)].sort((a,b)=>a-b);for(let i=1;i<cuts.length;i++){
  const at=t=>({x:road.a.x+(road.b.x-road.a.x)*t,z:road.a.z+(road.b.z-road.a.z)*t}),a=node(at(cuts[i-1])),b=node(at(cuts[i])),length=Math.hypot(nodes[b].x-nodes[a].x,nodes[b].z-nodes[a].z);if(length<.15)continue;
  const edge={a,b,length,width:road.width,id:edges.length};edges.push(edge);nodes[a].edges.push(edge.id);nodes[b].edges.push(edge.id);
 }}return {nodes,edges};
}
export function trafficPoint(graph,route){
 const e=graph.edges[route.edge],from=graph.nodes[route.reverse?e.b:e.a],to=graph.nodes[route.reverse?e.a:e.b],dx=(to.x-from.x)/e.length,dz=(to.z-from.z)/e.length,lane=Math.min(1.65,e.width*.23);
 return {x:from.x+dx*route.distance+dz*lane,z:from.z+dz*route.distance-dx*lane,heading:Math.atan2(dx,dz)};
}
export function createTraffic(world){
 const graph=buildRoadGraph(),pool=world.vehicles.filter(v=>v.traffic&&!v.rival);let lastRefresh=-Infinity,serial=0;
 function spawn(v,player,index){
  const candidates=[];
  for(const e of graph.edges){const a=graph.nodes[e.a],b=graph.nodes[e.b],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((player.x-a.x)*dx+(player.z-a.z)*dz)/(e.length*e.length)));
   for(const offset of [-30,-15,15,30]){const distance=Math.max(4,Math.min(e.length-4,t*e.length+offset));if(e.length<9)continue;const route={edge:e.id,distance,reverse:distance>t*e.length};if(route.reverse)route.distance=e.length-distance;
    const p=trafficPoint(graph,route),d=Math.hypot(p.x-player.x,p.z-player.z);if(d<14||d>115||world.vehicleBlocked(v,p.x,p.z,p.heading))continue;
    const spread=pool.filter(c=>c!==v&&c.mesh.visible&&!c.claimed).reduce((n,c)=>Math.min(n,Math.hypot(p.x-c.mesh.position.x,p.z-c.mesh.position.z)),100);if(spread<11)continue;
    candidates.push({route,p,score:d+Math.max(0,25-spread)*3+((e.id+serial)%7)});
   }
  }
  const chosen=candidates.sort((a,b)=>a.score-b.score)[index%Math.min(3,candidates.length)];if(!chosen)return false;
  v.trafficRoute=chosen.route;v.mesh.position.set(chosen.p.x,world.groundHeight(chosen.p.x,chosen.p.z),chosen.p.z);v.heading=chosen.p.heading;v.mesh.rotation.y=v.heading;v.mesh.visible=true;v.stalled=0;v.speed=5;serial++;return true;
 }
 return {update(dt,player,time){
  const eligible=pool.filter(v=>!v.claimed&&!v.sunk&&!v.waterTime);
  if(time-lastRefresh>.5){lastRefresh=time;let active=0;
   for(const v of eligible){if(v.mesh.visible&&v.trafficRoute&&Math.hypot(v.mesh.position.x-player.x,v.mesh.position.z-player.z)<110&&v.stalled<5)active++;else{v.mesh.visible=false;v.speed=0;}}
   for(let i=0;active<3&&i<eligible.length;i++){const v=eligible[(i+Math.floor(time/28))%eligible.length];if(v.mesh.visible)continue;if(spawn(v,player,active))active++;}
  }
  for(const v of eligible){if(!v.mesh.visible||!v.trafficRoute)continue;v.impactBrake=Math.max(0,(v.impactBrake??0)-dt);const r=v.trafficRoute,e=graph.edges[r.edge],speed=v.impactBrake>0?0:v.visualModel==='bus'?4.7:v.visualModel==='truck'?5.2:6.5;
   const next={...r,distance:Math.min(e.length,r.distance+dt*speed)},p=trafficPoint(graph,next);
   if(!world.vehicleBlocked(v,p.x,p.z,p.heading)){Object.assign(r,next);v.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);v.heading=p.heading;v.mesh.rotation.y=p.heading;v.speed=speed;v.stalled=0;world.props.vehicle(vehicleBox(v),speed,{x:Math.sin(p.heading),z:Math.cos(p.heading)});}else{v.speed=0;v.stalled=(v.stalled??0)+dt;}
   if(r.distance>=e.length-.05){const at=r.reverse?e.a:e.b,options=graph.nodes[at].edges.filter(id=>id!==e.id),id=options[(v.id+serial++)%options.length]??e.id,edge=graph.edges[id];v.trafficRoute={edge:id,reverse:edge.b===at,distance:0};}
  }
 },get diagnostics(){const cars=pool.filter(v=>v.mesh.visible&&!v.claimed&&!v.sunk);return {limit:3,active:cars.length,moving:cars.filter(v=>v.speed>0).length,roads:graph.edges.length,cars:cars.map(v=>({id:v.id,model:v.visualModel,speed:v.speed,position:v.mesh.position.toArray()}))};}};
}
