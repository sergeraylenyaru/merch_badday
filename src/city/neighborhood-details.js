// Rectangles follow the street-enclosed blocks of the reference map (pixels).
// Templates repeat shared geometry, while each district keeps its own purpose.
export const NEIGHBORHOODS = [
  ['homes-nw',0,45,55,220,310], ['homes-nc',0,260,55,480,310],
  ['homes-ne',0,520,100,610,310], ['homes-sw',0,45,365,220,665],
  ['homes-sc',0,260,365,480,555], ['homes-se',0,520,365,610,655],
  ['homes-south',0,350,600,480,735],
  ['park-north',1,710,90,1020,300], ['park-west',1,675,370,825,700],
  ['park-east',1,875,465,1090,695], ['park-south',1,700,715,1070,760],
  ['offices-nw',2,1190,45,1365,305], ['offices-ne',2,1415,45,1640,305],
  ['offices-sw',2,1190,370,1365,625], ['offices-se',2,1415,370,1640,625],
  ['offices-southwest',2,1205,675,1365,755], ['offices-southeast',2,1415,675,1640,755],
].map(([id,district,left,top,right,bottom])=>({id,district,left,top,right,bottom}));

const COURTYARD = [
  ['bench-wood',-8,0], ['game-table',4,8], ['ball',10,0],
];
const PARK = [
  ['bench-wood',-8,0], ['trash-bin',-2,0], ['ball',8,6],
];
const BUSINESS = [
  ['bench-metal',-8,0], ['recycling-bin',-2,0], ['bike-rack',8,0],
];

export function populateNeighborhoods(add) {
  for (const block of NEIGHBORHOODS) {
    const template = [COURTYARD,PARK,BUSINESS][block.district];
    // One modest rest area per block. Paths are continuous geometry, not props.
    for (const [id,dx,dz] of template) {
      for (const [fx,fy] of [[.55,.75],[.25,.25],[.75,.25],[.25,.65]]) {
        const u=block.left+(block.right-block.left)*fx;
        const v=block.top+(block.bottom-block.top)*fy;
        if(add(id,u+dx,v+dz,block.district,0,{
          neighborhood:block.id, cluster:0, region:block, search:20,
          parking:id==='parking-stop',
          solid:id!=='ball',
        }))break;
      }
    }
  }
}

export function populateEntrances(buildings, add, scale) {
  buildings.forEach(([,u,v,w,d],buildingIndex)=>{
    // Each entrance is a single assembly; no detached doors in open lawns.
    // Try the broad facades first, then the other sides if access is obstructed.
    const sides=w>=d?[0,2,1,3]:[1,3,0,2];
    for (const side of sides) {
      const angle=side*Math.PI/2, nx=Math.sin(angle), nz=Math.cos(angle);
      const half=(side%2?w:d)/2, span=side%2?d:w;
      let count=0;
      for (const offset of span>85?[-span*.25,span*.25]:[0]) {
        if(add('entry-door',u+nx*(half+.42/scale)+Math.cos(angle)*offset,
          v+nz*(half+.42/scale)-Math.sin(angle)*offset,
          buildingIndex%6,angle,{entrance:true,buildingIndex}))count++;
      }
      if(count)break;
    }
  });
}
