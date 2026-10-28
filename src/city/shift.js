export function makeShift(seed=Date.now()) {
 let n=seed>>>0;const random=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
 const order=Array.from({length:9},(_,i)=>i);for(let i=8;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return {order,urgent:order.slice(0,3),deadlines:order.map((_,i)=>420+i*60),events:[],eventTimes:[150+Math.floor(random()*90),420+Math.floor(random()*120)],dima:false,upgrades:{boots:false,gloves:false},damage:0};
}
export function urgentReward(state,id){return state.shift?.urgent.includes(id)&&state.time<=state.shift.deadlines[id]?80:0;}
export function buyEquipment(state,item){const cost={boots:150,gloves:120}[item];if(!cost||state.shift.upgrades[item]||state.bonus<cost)return false;state.bonus-=cost;state.shift.upgrades[item]=true;state.career.upgrades[item]=true;remember(state);return true;}
export function dealWithDima(state){if(state.shift.dima||state.money<40)return false;state.money-=40;state.shift.dima=true;state.shift.deadlines=state.shift.deadlines.map(n=>n+120);return true;}

export function career(storage=globalThis.localStorage){try{const p=JSON.parse(storage?.getItem('merch-career')||'null');if(p?.loyalty?.length===9)return p;}catch{}return {loyalty:Array(9).fill(0),upgrades:{boots:false,gloves:false},shifts:0};}
export function remember(state){try{globalThis.localStorage?.setItem('merch-career',JSON.stringify(state.career));}catch{}}
