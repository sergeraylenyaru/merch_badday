import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Original, Y-up city bus. Front is +Z, wheel axles are X, dimensions are metres. */
export function createCityBus(){
 const root=new T.Group();root.name='CityBus';root.userData={author:'merch_badday',provenance:'Original game geometry',frontAxis:'+Z',wheelRadius:.5};
 const colors={Paint:'#5793b0',Trim:'#d7d8bf',Glass:'#233d48',Tire:'#202624',Metal:'#a4b0ab',FrontLamp:'#ffedaa',RearLamp:'#b64f41'};
 const materials=new Map(Object.entries(colors).map(([name,color])=>{const m=new T.MeshStandardMaterial({name:'Bus_'+name,color,roughness:name==='Glass'?.2:.8,metalness:name==='Metal'?.65:.05});return [name,m];})),parts=new Map();
 function part(g,color,x,y,z){g.translate(x,y,z);if(g.index)g=g.toNonIndexed();if(!parts.has(color))parts.set(color,[]);parts.get(color).push(g);}
 const box=(color,x,y,z,w,h,d)=>part(new T.BoxGeometry(w,h,d),color,x,y,z);
 part(new RoundedBoxGeometry(2.55,2.65,8.3,2,.13),'Paint',0,1.875,0);
 box('Trim',0,.7,0,2.58,.32,8.35);box('Trim',0,3.35,0,2.5,.1,8.2);box('Metal',0,.6,0,1.8,.2,7);
 box('Glass',0,2.35,4.165,2.25,1.25,.035);box('Glass',0,2.3,-4.165,2.15,1.12,.035);
 box('Paint',0,3.12,4.18,2.35,.2,.04);box('Trim',0,1.48,4.18,2.3,.12,.04);
 for(const side of [-1,1]){
  for(let i=0;i<6;i++){const z=-3.25+i*1.05;box('Glass',side*1.284,2.37,z,.025,1.1,.94);}
  box('Trim',side*1.29,1.7,0,.035,.08,7.6);
  box('Glass',side*1.325,2.65,3.85,.05,.42,.22);box('Metal',side*1.28,2.85,3.85,.08,.06,.2);
  box('FrontLamp',side*.93,.96,4.2,.38,.3,.06);box('RearLamp',side*.96,.97,-4.2,.28,.5,.06);
 }
 for(const z of [2.85,-1.35]){box('Glass',1.305,1.6,z,.035,2.05,.82);for(const dz of [-.43,0,.43])box('Trim',1.33,1.6,z+dz,.035,2.08,.035);box('Metal',1.3,.53,z,.08,.1,.85);}
 for(const [color,list]of parts){const g=mergeGeometries(list);list.forEach(p=>p.dispose());const mesh=new T.Mesh(g,materials.get(color));mesh.name='BusBody_'+color;mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
 for(const [label,z]of [['Front',2.7],['Rear',-2.7]])for(const [side,x]of [['Left',-1.17],['Right',1.17]]){
  const wheel=new T.Group();wheel.name='VehicleWheel'+label+side;wheel.position.set(x,.5,z);wheel.userData.wheelRadius=.5;root.add(wheel);
  for(const [radius,width,color]of [[.5,.26,'Tire'],[.28,.28,'Metal']]){const g=new T.CylinderGeometry(radius,radius,width,20);g.rotateZ(Math.PI/2);const mesh=new T.Mesh(g,materials.get(color));mesh.castShadow=true;wheel.add(mesh);}
 }
 return root;
}
