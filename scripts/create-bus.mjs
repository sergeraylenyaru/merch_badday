import {writeFile} from 'node:fs/promises';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {createCityBus} from '../src/visuals/bus-model.js';
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(value=>{this.result=value;this.onloadend?.();});}};
const model=createCityBus(),buffer=await new GLTFExporter().parseAsync(model,{binary:true});
await writeFile(new URL('../public/models/vehicles/bus.glb',import.meta.url),Buffer.from(buffer));
model.traverse(n=>{n.geometry?.dispose();n.material?.dispose();});
