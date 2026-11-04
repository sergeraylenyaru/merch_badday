const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a.x*b.z-b.x*a.z;},0)/2;
const ccw=p=>area(p)<0?[...p].reverse():p;
export const rectanglePolygon=(x,z,w,d)=>[{x:x-w/2,z:z-d/2},{x:x+w/2,z:z-d/2},{x:x+w/2,z:z+d/2},{x:x-w/2,z:z+d/2}];
export function roadPolygon(r){const x=r.dz*r.width/2,z=-r.dx*r.width/2;return ccw([{x:r.start.x-x,z:r.start.z-z},{x:r.start.x+x,z:r.start.z+z},{x:r.end.x+x,z:r.end.z+z},{x:r.end.x-x,z:r.end.z-z}]);}
function halfPlane(p,a,b,inside){const out=[],cross=q=>(b.x-a.x)*(q.z-a.z)-(b.z-a.z)*(q.x-a.x),sign=inside?1:-1;for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],du=cross(u)*sign,dv=cross(v)*sign;if(du>=-1e-8)out.push(u);if((du>1e-8&&dv< -1e-8)||(du< -1e-8&&dv>1e-8)){const t=du/(du-dv);out.push({x:u.x+(v.x-u.x)*t,z:u.z+(v.z-u.z)*t});}}return out;}
/** Disjoint polygon fragments: surfaces share edges instead of coplanar faces. */
export function subtractPolygon(subject,cutter){
 const xs=subject.map(p=>p.x),zs=subject.map(p=>p.z),cx=cutter.map(p=>p.x),cz=cutter.map(p=>p.z);
 if(Math.max(...xs)<=Math.min(...cx)+1e-8||Math.min(...xs)>=Math.max(...cx)-1e-8||Math.max(...zs)<=Math.min(...cz)+1e-8||Math.min(...zs)>=Math.max(...cz)-1e-8)return [ccw(subject)];
 let remaining=ccw(subject);const out=[],cut=ccw(cutter);
 for(let i=0;i<cut.length&&remaining.length>=3;i++){const a=cut[i],b=cut[(i+1)%cut.length],outside=halfPlane(remaining,a,b,false);if(outside.length>=3&&Math.abs(area(outside))>1e-7)out.push(outside);remaining=halfPlane(remaining,a,b,true);}
 return out;
}
export function clipSurface(polygon,cutters){let pieces=[ccw(polygon)];for(const cut of cutters){pieces=pieces.flatMap(p=>subtractPolygon(p,cut));if(!pieces.length)break;}return pieces;}
export function appendSurface(out,polygon,height,tile=4){const p=ccw(polygon);for(let i=1;i<p.length-1;i++)for(const n of [0,i+1,i]){const v=p[n];out.positions.push(v.x,height(v.x,v.z),v.z);out.uv.push(v.x/tile,v.z/tile);}}
export class SurfaceIndex{
 cells=new Map();
 keys(p){const xs=p.map(q=>q.x),zs=p.map(q=>q.z),keys=[];for(let x=Math.floor(Math.min(...xs)/8);x<=Math.floor(Math.max(...xs)/8);x++)for(let z=Math.floor(Math.min(...zs)/8);z<=Math.floor(Math.max(...zs)/8);z++)keys.push(x+','+z);return keys;}
 add(p){for(const key of this.keys(p)){if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(p);}}
 at(p){return [...new Set(this.keys(p).flatMap(key=>this.cells.get(key)??[]))];}
}
