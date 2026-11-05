import {circleIntersectsBox,vehicleBox} from '../spatial.js';
import {pixel,isReferenceWater} from '../city/reference-layout.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

export function createWalkingBlocker(world){
  const cells=new Map(),cellSize=8;
  for(const b of world.blockers){
    if((b.y??b.h/2)-b.h/2>2.05)continue;
    for(let x=Math.floor((b.x-b.w)/cellSize);x<=Math.floor((b.x+b.w)/cellSize);x++)
      for(let z=Math.floor((b.z-b.d)/cellSize);z<=Math.floor((b.z+b.d)/cellSize);z++){
        const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(b);
      }
  }
  return (x,z,r=.32)=>{
    const p=pixel(x,z);
    if(p.x<8||p.x>1664||p.y<8||p.y>930||(isReferenceWater(p.x,p.y)&&!world.coast?.walkable(x,z)))return true;
    for(let cx=Math.floor((x-r)/cellSize);cx<=Math.floor((x+r)/cellSize);cx++)
      for(let cz=Math.floor((z-r)/cellSize);cz<=Math.floor((z+r)/cellSize);cz++)
        if((cells.get(cx+','+cz)??[]).some(b=>b.enabled!==false&&circleIntersectsBox(x,z,r,b)))return true;
    return world.vehicles.some(v=>v.mesh.visible&&!(v.police&&world.state.wanted<3)&&circleIntersectsBox(x,z,r,vehicleBox(v)));
  };
}

export function clearSegment(a,b,blocked,radius=.32){
  const steps=Math.max(1,Math.ceil(distance(a,b)/.25));
  for(let i=0;i<=steps;i++)if(blocked(a.x+(b.x-a.x)*i/steps,a.z+(b.z-a.z)*i/steps,radius))return false;
  return true;
}

// A binary heap keeps bounded A* searches inexpensive even around long facades.
class Queue {
  items=[];
  push(node){const a=this.items;let i=a.length;a.push(node);while(i){const p=(i-1)>>1;if(a[p].score<=node.score)break;a[i]=a[p];i=p;}a[i]=node;}
  pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}

function* walkingSearch(start,goal,blocked,{step=1,maxVisited=900,cost=()=>1}={}){
  if(clearSegment(start,goal,blocked))return [{...goal}];
  const origin={x:start.x,z:start.z},queue=new Queue(),known=new Map(),closed=new Set(),free=new Map();
  const key=(x,z)=>x+','+z,position=(x,z)=>({x:origin.x+x*step,z:origin.z+z*step});
  const valid=(x,z)=>{const k=key(x,z);if(!free.has(k)){const p=position(x,z);free.set(k,!blocked(p.x,p.z,.38));}return free.get(k);};
  const first={x:0,z:0,g:0,score:distance(start,goal),previous:null};
  queue.push(first);known.set('0,0',0);let best=first,found=null;
  while(queue.items.length&&closed.size<maxVisited){
    const current=queue.pop(),k=key(current.x,current.z);if(closed.has(k))continue;closed.add(k);
    yield;
    const p=position(current.x,current.z),remaining=distance(p,goal);
    if(remaining<distance(position(best.x,best.z),goal))best=current;
    if(remaining<step*1.5&&clearSegment(p,goal,blocked)){found=current;break;}
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
      if(!dx&&!dz)continue;
      const x=current.x+dx,z=current.z+dz,nextKey=key(x,z);
      if(closed.has(nextKey)||!valid(x,z)||(dx&&dz&&(!valid(current.x+dx,current.z)||!valid(current.x,current.z+dz))))continue;
      const next=position(x,z);
      if(!clearSegment(p,next,blocked))continue;
      const g=current.g+Math.hypot(dx,dz)*step*cost(next);
      if(known.has(nextKey)&&known.get(nextKey)<=g)continue;
      known.set(nextKey,g);queue.push({x,z,g,score:g+distance(next,goal),previous:current});
    }
  }
  // A bounded search may advance along a partial route, but never crosses a
  // wall or teleports when the destination is unreachable.
  const end=found??best;if(end===first)return [];
  const route=found?[{...goal}]:[];
  for(let n=end;n.previous;n=n.previous)route.unshift(position(n.x,n.z));
  return route;
}

export function findWalkingPath(start,goal,blocked,options){
  const iterator=walkingSearch(start,goal,blocked,options);let result;
  do{result=iterator.next();}while(!result.done);
  return result.value;
}

export function createPedestrianNavigator(blocked){
  let pending=null;
  const diagnostics={nodesLastFrame:0,searchMs:0};
  return {
    diagnostics,
    beginFrame(now=0){
      diagnostics.nodesLastFrame=0;const start=performance.now();
      if(pending&&pending.person.mesh.visible===false)pending=null;
      while(pending&&diagnostics.nodesLastFrame<64&&performance.now()-start<1.5){
        const result=pending.iterator.next();diagnostics.nodesLastFrame++;
        if(result.done){pending.nav.path=result.value;pending.nav.goal=pending.goal;pending.nav.replan=now+1.5;pending=null;}
      }
      diagnostics.searchMs=performance.now()-start;
    },
    step(person,target,speed,dt,now){
      const position=person.mesh.position;
      const nav=person.navigation??={path:[],goal:null,replan:0,stuck:0};
      if(distance(position,target)<.25){nav.path=[];return {x:0,z:0};}
      if(now>=(nav.directCheck??0)||!nav.goal||distance(nav.goal,target)>2){
        nav.directCheck=now+.6;
        if(clearSegment(position,target,blocked)){nav.path=[{x:target.x,z:target.z}];nav.goal={x:target.x,z:target.z};if(pending?.person===person)pending=null;}
      }
      if(!pending&&now>=nav.replan&&(!nav.path.length||!nav.goal||distance(nav.goal,target)>3||nav.stuck>.4)){
        pending={person,nav,goal:{x:target.x,z:target.z},iterator:walkingSearch({x:position.x,z:position.z},{x:target.x,z:target.z},blocked)};
        nav.replan=now+1.5;nav.stuck=0;
      }
      while(nav.path.length&&distance(position,nav.path[0])<.15)nav.path.shift();
      const next=nav.path[0];if(!next)return {x:0,z:0};
      const d=distance(position,next),step=Math.min(d,speed*dt);
      const delta={x:(next.x-position.x)*step/d,z:(next.z-position.z)*step/d};
      if(clearSegment(position,{x:position.x+delta.x,z:position.z+delta.z},blocked)){
        position.x+=delta.x;position.z+=delta.z;nav.stuck=0;return delta;
      }
      nav.stuck+=dt;if(nav.stuck>.4)nav.path=[];
      return {x:0,z:0};
    },
  };
}
