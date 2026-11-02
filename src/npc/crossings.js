import * as T from 'three';
import {point,pixel} from '../city/reference-layout.js';

const STREETS=[
  {axis:'v',at:337,from:0,to:1672,width:38,gates:[239,500,850,1168,1340,1440]},
  {axis:'u',at:239,from:15,to:578,width:25,gates:[140,337,500]},
  {axis:'u',at:500,from:42,to:738,width:24,gates:[180,337,560]},
  {axis:'u',at:1168,from:0,to:710,width:27,gates:[180,337,600]},
  {axis:'u',at:1390,from:0,to:941,width:27,gates:[180,480,716]},
];

export function streetWaypoints(from,to,blocked=()=>false){
  const a=pixel(from.x,from.z),b=pixel(to.x,to.z),crossings=[];
  for(const street of STREETS){
    const vertical=street.axis==='u',start=vertical?a.x:a.y,end=vertical?b.x:b.y;
    if((start-street.at)*(end-street.at)>=0)continue;
    const t=(street.at-start)/(end-start),along=vertical?a.y+(b.y-a.y)*t:a.x+(b.x-a.x)*t;
    if(along<street.from||along>street.to)continue;
    const direction=Math.sign(end-start),offset=street.width/2+5;
    const pairs=street.gates.map(gate=>{
      const near=vertical?point(street.at-direction*offset,gate):point(gate,street.at-direction*offset);
      const far=vertical?point(street.at+direction*offset,gate):point(gate,street.at+direction*offset);
      return {near,far,score:Math.hypot(near.x-from.x,near.z-from.z)+Math.hypot(far.x-to.x,far.z-to.z)};
    }).filter(p=>!blocked(p.near.x,p.near.z,.4)&&!blocked(p.far.x,p.far.z,.4)).sort((a,b)=>a.score-b.score);
    if(pairs.length)crossings.push({t,...pairs[0]});
  }
  return [...crossings.sort((a,b)=>a.t-b.t).flatMap(c=>[c.near,c.far]),{x:to.x,z:to.z}];
}

export function createCrossingMarkings(scene,groundHeight){
  const geometry=new T.BoxGeometry(3.2,.012,.34),material=new T.MeshStandardMaterial({color:'#e8e5dc',roughness:.95});
  const transforms=[],matrix=new T.Matrix4(),rotation=new T.Quaternion(),scale=new T.Vector3(1,1,1);
  for(const street of STREETS)for(const gate of street.gates){
    // Junctions already have another crossing through their centre; paint
    // perpendicular stripes on its approach instead of stacking both sets.
    if(street.axis==='u'&&gate===337)continue;
    const p=street.axis==='u'?point(street.at,gate):point(gate,street.at);
    rotation.setFromAxisAngle(new T.Vector3(0,1,0),street.axis==='u'?Math.PI/2:0);
    for(let d=-street.width*.2+.4;d<street.width*.2;d+=.8){
      const x=p.x+(street.axis==='u'?d:0),z=p.z+(street.axis==='v'?d:0);
      transforms.push(matrix.compose(new T.Vector3(x,groundHeight(x,z)+.02,z),rotation,scale).clone());
    }
  }
  const mesh=new T.InstancedMesh(geometry,material,transforms.length);mesh.name='pedestrian-crossings';
  transforms.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.receiveShadow=true;scene.add(mesh);
  return {dispose(){mesh.removeFromParent();mesh.dispose();geometry.dispose();material.dispose();}};
}
