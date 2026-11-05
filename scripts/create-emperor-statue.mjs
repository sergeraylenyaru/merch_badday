import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {writeFile,mkdir} from 'node:fs/promises';
import {Sculpt} from './vendor/aktobe/sculpt.mjs';
import {HAIRLINE,chamferFrustum} from './vendor/aktobe/figure.mjs';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}};
const parts=[],batch={add(g,{color}){g=g.index?g.toNonIndexed():g;if(color!==null){const c=new T.Color(color),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(a,3));}for(const k of Object.keys(g.attributes))if(!['position','normal','color'].includes(k))g.deleteAttribute(k);parts.push(g);}};
const bronze=0x657c69,gold=0x9f8752,s=new Sculpt(batch,0,1.25,0,0,1.9,{statue:true});
for(const side of [-1,1]){s.sweep([[side*.10,.88,0],[side*.13,.46,side*.035],[side*.14,.10,side*.05]],[.09,.065,.052],bronze,{seg:12});s.ball([side*.14,.06,-.04+side*.05],[.065,.06,.16],bronze,12);}
s.loft([{y:.72,rx:.25,rf:.15,rb:.15,fold:.04,folds:10},{y:.95,rx:.19,rf:.13,rb:.14},{y:1.25,rx:.21,rf:.15,rb:.12},{y:1.42,rx:.23,rf:.13,rb:.12},{y:1.48,rx:.09,rf:.08,rb:.08}],bronze,{seg:28,capTop:true,capBottom:true});
// Draped imperial cloak, breastplate, belt and sandals.
s.loft([{y:.30,z:.13,rx:.31,rf:.09,rb:.20,fold:.07,folds:9,openR:1.5,openL:1.5},{y:.95,z:.08,rx:.25,rf:.14,rb:.18,openR:1.6,openL:1.6},{y:1.43,rx:.26,rf:.13,rb:.17,openR:1.5,openL:1.5}],bronze,{seg:32});
s.box(.39,.05,.29,[0,.95,0],gold);s.ball([.17,1.43,-.12],.055,gold,12);
s.sweep([[0,1.46,0],[0,1.55,0]],[.06,.055],bronze,{seg:12});
s.head([0,1.67,-.015],[.05,0,0],bronze,{hair:HAIRLINE.fringe,moustache:false,brow:.07,hairOpts:{thick:.03}});
for(let i=0;i<12;i++){const a=i*Math.PI/6;s.ball([Math.sin(a)*.105,1.76,-.015-Math.cos(a)*.088],[.035,.014,.017],gold,8,[0,-a,.3]);}
s.sweep([[.22,1.4,0],[.38,1.20,-.05],[.43,1.32,-.20]],[.075,.06,.045],bronze,{seg:12});s.hand([.43,1.32,-.20],[0,1,0],[0,0,-1],bronze,{kind:'fist',side:1});
s.sweep([[.43,.12,-.2],[.43,1.70,-.2]],[.018,.018],gold,{seg:10});s.ball([.43,1.73,-.2],.055,gold,12);
s.sweep([[-.22,1.4,0],[-.32,1.13,-.07],[-.16,1.01,-.15]],[.075,.06,.04],bronze,{seg:12});s.hand([-.16,1.01,-.15],[1,0,0],[0,0,-1],bronze,{kind:'fist',side:-1});
const root=new T.Group();root.name='Emperor-with-laurel-cloak-and-sceptre';root.userData={design:'Original imperial figure for merch_badday',geometryToolkit:'Iskander Kinzhibayev · MIT · aktobe-2000s'};
root.add(new T.Mesh(mergeGeometries(parts),new T.MeshStandardMaterial({vertexColors:true,metalness:.55,roughness:.52})));parts.forEach(p=>p.dispose());
for(const [w,h,y]of [[2.2,.18,0],[1.45,.95,.18],[1.65,.16,1.13]]){const mesh=new T.Mesh(chamferFrustum(w,w,w*.97,w*.97,h,.04),new T.MeshStandardMaterial({color:'#c5b99e',roughness:.9}));mesh.position.y=y;root.add(mesh);}
await mkdir('public/models/estate',{recursive:true});const bytes=await new GLTFExporter().parseAsync(root,{binary:true});await writeFile('public/models/estate/emperor.glb',Buffer.from(bytes));console.log('EMPEROR',bytes.byteLength);
