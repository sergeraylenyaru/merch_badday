import {createSpawnVisibility} from './spawn-visibility.js';
import {ROADS,point} from './reference-layout.js';
import {vehicleBox} from '../spatial.js';

// Split road crossings so local drivers turn at real junctions and use both lanes.
export function buildRoadGraph(){
 const roads=ROADS.filter(r=>r[4]>=13).map(([a,b,c,d,width])=>({a:point(a,b),b:point(c,d),width:width*.4,cuts:[0,1]}));
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
 const graph=buildRoadGraph(),pool=world.vehicles.filter(v=>v.traffic&&!v.rival),concealed=createSpawnVisibility(world);let lastRefresh=-Infinity,nextSpawn=-Infinity,serial=0,lastSpawn=null,lastPlayer={x:0,z:0};
 for(const v of pool)if(!v.claimed&&!v.sunk){v.mesh.visible=false;v.trafficRoute=null;}
 function spawn(v,player,index,yaw,eye,initial=false){const candidates=[];
  for(const e of graph.edges){if(e.length<9)continue;const a=graph.nodes[e.a],b=graph.nodes[e.b],dx=b.x-a.x,dz=b.z-a.z,t=((player.x-a.x)*dx+(player.z-a.z)*dz)/(e.length*e.length),px=a.x+dx*t,pz=a.z+dz*t,perpendicular=Math.hypot(px-player.x,pz-player.z);if(perpendicular>74)continue;const inner=Math.sqrt(Math.max(0,24**2-perpendicular**2)),outer=Math.sqrt(75**2-perpendicular**2);
   for(const offset of [-outer+.5,-(inner+outer)/2,-inner-.5,inner+.5,(inner+outer)/2,outer-.5]){let distance=Math.max(4,Math.min(e.length-4,t*e.length+offset));const route={edge:e.id,distance,reverse:distance>t*e.length};if(route.reverse)route.distance=e.length-distance;
    const p=trafficPoint(graph,route),d=Math.hypot(p.x-player.x,p.z-player.z);if(d<24||d>75||world.vehicleBlocked(v,p.x,p.z,p.heading))continue;
    const spread=pool.filter(c=>c!==v&&c.mesh.visible&&!c.claimed).reduce((n,c)=>Math.min(n,Math.hypot(p.x-c.mesh.position.x,p.z-c.mesh.position.z)),100);if(spread<18)continue;
    const reason=initial?'initial-traffic':concealed(player,p,yaw,{height:v.h??3,radius:Math.max(v.w,v.l),eye});if(!reason)continue;candidates.push({route,p,reason,score:Math.abs(d-(32+index%3*12))+Math.max(0,25-spread)*2+((e.id+serial)%7)});
   }
  }const chosen=candidates.sort((a,b)=>a.score-b.score)[0];if(!chosen)return false;
  v.trafficRoute=chosen.route;v.cameFromTraffic=true;v.mesh.position.set(chosen.p.x,world.groundHeight(chosen.p.x,chosen.p.z),chosen.p.z);v.heading=chosen.p.heading;v.mesh.rotation.y=v.heading;v.mesh.visible=true;v.stalled=0;v.backing=0;v.impactBrake=0;v.crashed=false;v.impactMotion=null;v.speed=5;lastSpawn={id:v.id,distance:Math.hypot(chosen.p.x-player.x,chosen.p.z-player.z),reason:chosen.reason};serial++;return true;
 }
 return {prime(player,time=0,yaw=0){lastPlayer=player;let count=0;for(const v of pool)if(!v.claimed&&!v.sunk&&count<3&&spawn(v,player,count,yaw,null,true))count++;lastRefresh=time;nextSpawn=time+1.2;},update(dt,player,time,yaw=0,eye=null){
  lastPlayer=player;const eligible=pool.filter(v=>!v.claimed&&!v.sunk&&!v.waterTime);
  if(time-lastRefresh>.5){lastRefresh=time;for(const v of eligible)if(v.mesh.visible){const d=Math.hypot(v.mesh.position.x-player.x,v.mesh.position.z-player.z);if(!v.impactMotion&&(d>285||(d>110||v.crashed&&d>45)&&concealed(player,v.mesh.position,yaw,{height:v.h??3,radius:Math.max(v.w,v.l),eye}))){v.mesh.visible=false;v.speed=0;}}
   const active=eligible.filter(v=>v.mesh.visible),near=active.filter(v=>!v.crashed&&Math.hypot(v.mesh.position.x-player.x,v.mesh.position.z-player.z)<90).length;
   if(near<3&&active.length<5&&time>=nextSpawn){for(const v of eligible){if(v.mesh.visible)continue;if(spawn(v,player,near,yaw,eye)){nextSpawn=time+1.2;break;}}}
  }
  for(const v of eligible){if(!v.mesh.visible||!v.trafficRoute||v.crashed||v.impactMotion)continue;v.impactBrake=Math.max(0,(v.impactBrake??0)-dt);const r=v.trafficRoute,e=graph.edges[r.edge],speed=v.impactBrake>0?0:(v.backing??0)>0?-2:v.visualModel==='bus'?4.7:v.visualModel==='truck'?5.2:6.5;
   const next={...r,distance:Math.max(0,Math.min(e.length,r.distance+dt*speed))},p=trafficPoint(graph,next);
   if(!world.vehicleBlocked(v,p.x,p.z,p.heading)){Object.assign(r,next);v.mesh.position.set(p.x,world.groundHeight(p.x,p.z),p.z);v.heading=p.heading;v.mesh.rotation.y=p.heading;v.speed=speed;v.stalled=0;v.backing=Math.max(0,(v.backing??0)-dt);world.props.vehicle(vehicleBox(v),speed,{x:Math.sin(p.heading),z:Math.cos(p.heading)});}else{v.speed=0;v.stalled=(v.stalled??0)+dt;if(v.stalled>4){v.backing=2;v.stalled=0;}}
   if(r.distance>=e.length-.05){const at=r.reverse?e.a:e.b,options=graph.nodes[at].edges.filter(id=>id!==e.id),id=options[(v.id+serial++)%options.length]??e.id,edge=graph.edges[id];v.trafficRoute={edge:id,reverse:edge.b===at,distance:0};}
  }
 },get diagnostics(){const cars=pool.filter(v=>v.mesh.visible&&!v.claimed&&!v.sunk);return {limit:5,targetNearby:3,spawnMin:24,lastSpawn,active:cars.length,nearby:cars.filter(v=>Math.hypot(v.mesh.position.x-lastPlayer.x,v.mesh.position.z-lastPlayer.z)<90).length,moving:cars.filter(v=>v.speed>0).length,roads:graph.edges.length,cars:cars.map(v=>({id:v.id,model:v.visualModel,speed:v.speed,position:v.mesh.position.toArray(),crashed:!!v.crashed}))};}};
}
