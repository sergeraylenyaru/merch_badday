import {COAST_HOMES,MANSION} from './coast-layout.js';
import {point} from './reference-layout.js';
import {boxesIntersect} from '../spatial.js';
export const FOOD_SITES=[
 {id:'fast-dot',name:'Быстро и точка',u:350,v:293,width:16,depth:10,heading:0,color:'#275e4c',accent:'#f48338',style:'fries',meal:'Космический обед',price:100,health:35,stress:20},
 {id:'buter-king',name:'Бутер Кинг',u:1530,v:300,width:17,depth:10,heading:0,color:'#a43729',accent:'#edbe65',style:'burger',meal:'Королевский бутерброд',price:120,health:45,stress:25},
 {id:'koko-pizza',name:'КоКоПицца',u:1280,v:300,width:16,depth:10,heading:0,color:'#e8dfc8',accent:'#da6540',style:'chicken-pizza',meal:'Пицца с курицей',price:150,health:60,stress:30},
 {id:'park-shaurma',name:'Шаурма',u:920,v:270,width:5,depth:4,heading:0,color:'#b76c38',accent:'#edd685',style:'shawarma',district:'park',meal:'Шаурма',price:90,health:40,stress:20},
 {id:'business-shaverma',name:'Шаверма',u:1430,v:600,width:5,depth:4,heading:-Math.PI/2,color:'#356b78',accent:'#e2d492',style:'shawarma',district:'business',meal:'Шаурма',price:90,health:40,stress:20},
 {id:'kebab-001',name:'Кебаб №001',u:309,v:620,width:5,depth:4,heading:-Math.PI/2,color:'#8c3c39',accent:'#eee1b5',style:'shawarma',district:'residential',meal:'Шаурма',price:90,health:40,stress:20},
].map(s=>({...s,...point(s.u,s.v),w:(Math.abs(Math.cos(s.heading))*s.width+Math.abs(Math.sin(s.heading))*s.depth)/2,d:(Math.abs(Math.sin(s.heading))*s.width+Math.abs(Math.cos(s.heading))*s.depth)/2}));
export const MALL_SITE={id:'unfinished-mall',name:'Недостроенный ТЦ «Горизонт»',...point(1590,710),w:18,d:15,height:12.6};
export const GARAGE_HIDEOUT={id:'garage-hideout',name:'Гаражи · скрыть розыск',...point(128,69),w:7,d:2.6};
export const NEW_PLOTS=[...COAST_HOMES.map(h=>({...h,w:6.8,d:7.5})),{...MANSION,w:MANSION.w+1,d:MANSION.d+1},...FOOD_SITES.map(s=>({...s,w:s.w+2,d:s.d+4})),{...MALL_SITE,w:21,d:18},{...GARAGE_HIDEOUT,w:8,d:3}];
export const reservedNewPlot=(shape,padding=0)=>NEW_PLOTS.some(p=>boxesIntersect(shape,{...p,w:p.w+padding,d:p.d+padding}));
