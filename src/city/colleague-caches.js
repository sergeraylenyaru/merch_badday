import * as T from 'three';
export const CACHE_SIZE=.8/3;
export function createCacheMark(mesh){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#315f72';c.beginPath();c.arc(48,48,44,0,Math.PI*2);c.fill();c.strokeStyle='#eadbad';c.lineWidth=6;c.stroke();c.fillStyle='#fff1ce';c.font='bold 63px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('М',48,50);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const material=new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}),geometry=new T.PlaneGeometry(CACHE_SIZE*.75,CACHE_SIZE*.75),front=new T.Mesh(geometry,material),top=new T.Mesh(geometry,material);
 front.position.set(0,0,CACHE_SIZE/2+.002);top.rotation.x=-Math.PI/2;top.position.y=CACHE_SIZE/2+.002;mesh.add(front,top);
 return {dispose(){texture.dispose();geometry.dispose();material.dispose();}};
}
