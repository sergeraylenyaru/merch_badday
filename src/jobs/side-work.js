export const SIDE_JOBS={
 delivery:{title:'Продукты соседям',description:'Отвезите коробку с продуктами к указанному подъезду.',pay:160},
 express:{title:'Срочный заказ',description:'Доставьте заказ к подъезду. За три минуты — ещё 100 ₽.',pay:180},
 returns:{title:'Возврат тары',description:'Заберите пустую тару у подъезда и привезите её обратно в подсобку.',pay:170},
};
export const newSideWork=()=>({active:null,completed:[],earned:0,board:null});
export function ensureSideWork(state){const current=state.sideWork??{};state.sideWork=Object.assign(current,{...newSideWork(),...current});if(current.active&&!SIDE_JOBS[current.active.type])current.active=null;return current;}
export function acceptSideWork(state,shop,type,address){
 const s=ensureSideWork(state),id=shop+':'+type;if(!SIDE_JOBS[type]||s.active||s.completed.includes(id)||!address)return false;
 s.board=null;s.active={id,shop,type,address:{...address},phase:type==='returns'?'collect':'deliver',carrying:type!=='returns',driven:0,due:state.time+180};return true;
}
export function advanceSideCargo(state,position,inVehicle){
 const a=state.sideWork?.active;if(!a)return;
 if(a.carrying&&inVehicle&&a.lastPosition){const d=Math.hypot(position.x-a.lastPosition.x,position.z-a.lastPosition.z);if(d<5)a.driven+=d;}
 a.lastPosition=inVehicle?{x:position.x,z:position.z}:null;
}
export function interactSideCargo(state,place){
 const s=ensureSideWork(state),a=s.active;if(!a)return {ok:false};
 if(a.phase==='collect'&&place==='address'){a.phase='return';a.carrying=true;a.driven=0;a.lastPosition=null;return {ok:true,collected:true};}
 if((a.phase==='return'?place!=='store':place!=='address')||!a.carrying)return {ok:false};
 if(a.driven<12)return {ok:false,needsCar:true};
 const amount=SIDE_JOBS[a.type].pay+(a.type==='express'&&state.time<=a.due?100:0);
 s.completed.push(a.id);s.earned+=amount;s.active=null;state.money+=amount;state.stress=Math.max(0,state.stress-3);return {ok:true,amount};
}
