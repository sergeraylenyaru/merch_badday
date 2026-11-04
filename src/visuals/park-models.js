import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const palette={cream:'#efe0ab',red:'#c95643',blue:'#397e98',green:'#80a34c',steel:'#8a9385',wood:'#a87d51',dark:'#334b4b',yellow:'#e4bb52'};
export function coasterCurve(){return new T.CatmullRomCurve3(Array.from({length:12},(_,i)=>{const a=i*Math.PI/6;return new T.Vector3(Math.cos(a)*8,1.2+Math.max(0,Math.sin(a))*6,Math.sin(a)*5.5);}),true,'catmullrom',.5);}
export function createParkModel(kind){
 const root=new T.Group();root.name='Park_'+kind;const mats=new Map(Object.entries(palette).map(([name,color])=>[name,new T.MeshStandardMaterial({name:'Ride_'+name,color,roughness:.65,metalness:name==='steel'?.55:.08})]));
 function mesh(parent,g,color,x=0,y=0,z=0){const m=new T.Mesh(g,mats.get(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
 const box=(p,c,x,y,z,w,h,d)=>mesh(p,new T.BoxGeometry(w,h,d),c,x,y,z);
 function rod(p,c,a,b,r=.07){const dir=new T.Vector3().subVectors(b,a),m=mesh(p,new T.CylinderGeometry(r,r,dir.length(),8),c,...a.clone().add(b).multiplyScalar(.5).toArray());m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());return m;}
 const V=(x,y,z)=>new T.Vector3(x,y,z),clips=[];
 if(kind==='chain-swing'){
  mesh(root,new T.CylinderGeometry(6.5,6.8,.25,40),'cream',0,.125,0);mesh(root,new T.CylinderGeometry(.4,.6,8,12),'red',0,4.1,0);const rotor=new T.Group();rotor.name='SwingRotor';rotor.position.y=7.9;root.add(rotor);mesh(rotor,new T.ConeGeometry(5.3,2.1,24),'yellow',0,.85,0);mesh(rotor,new T.TorusGeometry(5,.12,6,32),'red').rotation.x=Math.PI/2;
  for(let i=0;i<10;i++){const a=i*Math.PI/5,c=Math.cos(a),s=Math.sin(a);rod(rotor,'cream',V(0,0,0),V(c*5,0,s*5),.08);for(const side of [-1,1])rod(rotor,'steel',V(c*4.6+s*side*.22,-.1,s*4.6-c*side*.22),V(c*5.7+s*side*.22,-3.1,s*5.7-c*side*.22),.025);const seat=new T.Group();seat.position.set(c*5.7,-3.1,s*5.7);seat.rotation.y=-a;rotor.add(seat);box(seat,i%2?'blue':'red',0,0,0,.75,.15,.7);box(seat,'cream',0,.35,-.32,.75,.7,.1);}
  clips.push(new T.AnimationClip('Chairs',14,[new T.QuaternionKeyframeTrack('SwingRotor.quaternion',[0,3.5,7,10.5,14],[0,Math.PI/2,Math.PI,Math.PI*1.5,Math.PI*2].flatMap(a=>new T.Quaternion().setFromAxisAngle(V(0,1,0),a).toArray()))]));
 }else if(kind==='pirate-ship'){
  box(root,'cream',0,.15,0,12,.3,9);for(const z of [-3.5,3.5]){rod(root,'blue',V(-5,0,z),V(0,8,z),.2);rod(root,'blue',V(5,0,z),V(0,8,z),.2);}rod(root,'steel',V(0,8,-4),V(0,8,4),.18);
  const ship=new T.Group();ship.name='PirateSwing';ship.position.y=8;root.add(ship);for(const z of [-1.5,1.5])for(const x of [-3.8,3.8])rod(ship,'steel',V(0,0,z),V(x,-4.7,z),.1);
  const hull=mesh(ship,new T.SphereGeometry(1,20,8,0,Math.PI*2,Math.PI/2,Math.PI/2),'wood',0,-4.25,0);hull.scale.set(5.1,1.5,1.8);box(ship,'red',0,-4.28,0,9.3,.2,3.3);for(let i=-3;i<=3;i++){box(ship,'yellow',i*1.1,-3.92,0,.65,.24,2.7);box(ship,'blue',i*1.1+.35,-3.6,0,.12,.65,2.7);}for(const side of [-1,1])rod(ship,'cream',V(-4.7,-3.65,side*1.7),V(4.7,-3.65,side*1.7),.07);
  clips.push(new T.AnimationClip('Ship',8,[new T.QuaternionKeyframeTrack('PirateSwing.quaternion',[0,2,4,6,8],[-.65,0,.65,0,-.65].flatMap(a=>new T.Quaternion().setFromAxisAngle(V(0,0,1),a).toArray()))]));
 }else if(kind==='mini-coaster'){
  box(root,'cream',0,.1,0,19,.2,14);const curve=coasterCurve();for(const side of [-1,1]){const rail=new T.CatmullRomCurve3(Array.from({length:80},(_,i)=>{const t=i/80,p=curve.getPointAt(t),tangent=curve.getTangentAt(t),right=new T.Vector3(-tangent.z,0,tangent.x).normalize();return p.addScaledVector(right,side*.42);}),true);mesh(root,new T.TubeGeometry(rail,160,.09,6,true),'yellow');}
  for(let i=0;i<24;i++){const p=curve.getPointAt(i/24);rod(root,'green',V(p.x,.2,p.z),p,.12);const t=curve.getTangentAt(i/24),right=V(-t.z,0,t.x).normalize();rod(root,'steel',p.clone().addScaledVector(right,-.62),p.clone().addScaledVector(right,.62),.06);}
  const train=new T.Group();train.name='CoasterTrain';root.add(train);for(let i=0;i<2;i++){box(train,'red',0,.4,-i*1.5,1.35,.6,1.3);box(train,'dark',0,.77,-i*1.5,1.05,.13,.9);box(train,'yellow',0,1,-i*1.5-.5,1.2,.45,.15);}
  const times=[],positions=[],quaternions=[];for(let i=0;i<=120;i++){const t=i/120,p=curve.getPointAt(t),direction=curve.getTangentAt(t),q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(new T.Vector3(),direction,new T.Vector3(0,1,0)));times.push(t*20);positions.push(...p.toArray());quaternions.push(...q.toArray());}clips.push(new T.AnimationClip('Train',20,[new T.VectorKeyframeTrack('CoasterTrain.position',times,positions),new T.QuaternionKeyframeTrack('CoasterTrain.quaternion',times,quaternions)]));
 }
 // Merge each static part while preserving the independently animated groups.
 function batch(group){for(const child of [...group.children])if(child.isGroup)batch(child);const sets=new Map();for(const n of [...group.children])if(n.isMesh){n.updateMatrix();const key=n.material.uuid;if(!sets.has(key))sets.set(key,{material:n.material,geometries:[]});sets.get(key).geometries.push(n.geometry.clone().applyMatrix4(n.matrix));n.geometry.dispose();group.remove(n);}for(const {material,geometries}of sets.values()){const g=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());const m=new T.Mesh(g,material);m.castShadow=m.receiveShadow=true;group.add(m);}}
 batch(root);root.animations=clips;return root;
}
