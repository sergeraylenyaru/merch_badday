import {parkBridgeHeight} from './reference-layout.js';

/** Full collision span, with visible paving restricted to the approaches. */
export function bridgeSurfaces(b){
 const positions=[],uv=[],rampPositions=[],rampUV=[];
 for(let d=-b.length/2-4;d<b.length/2+4;d+=.5){
  const coords=[[d,-1],[d+.5,1],[d+.5,-1],[d,-1],[d,1],[d+.5,1]],visible=Math.abs(d+.25)>b.length/2;
  for(const [along,side]of coords){const x=b.x+Math.cos(b.angle)*along-Math.sin(b.angle)*side*b.width/2,z=b.z+Math.sin(b.angle)*along+Math.cos(b.angle)*side*b.width/2,y=Math.max(0,parkBridgeHeight(x,z));positions.push(x,y,z);uv.push(along,side);if(visible){rampPositions.push(x,y,z);rampUV.push(along,side);}}
 }
 return {positions,uv,rampPositions,rampUV};
}
