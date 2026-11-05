import {remember} from '../city/shift.js';
export const WEAPONS={bat:{name:'Бита',reach:3.5,power:3,color:'#ffba45'},stick:{name:'Палка',reach:3.2,power:2,color:'#adf16b'},water:{name:'Водяной пистолет',reach:10,power:0,color:'#43deff'}};
WEAPONS.stone={name:'Камни',reach:35,power:1,color:'#b4b5a0'};
WEAPONS.slingshot={name:'Рогатка',reach:60,power:1,color:'#ffce63'};
WEAPONS.baton={name:'Полицейская дубинка',reach:2.8,power:2,color:'#7eb6cc'};
WEAPONS.shovel={name:'Лопата',reach:3.5,power:3,color:'#e8a657'};
export const WEAPON_SLOTS=[null,'bat','stick','water','stone','slingshot','baton','shovel'];
export function equipSlot(state,slot){const id=WEAPON_SLOTS[slot-1];if(slot<1||slot>WEAPON_SLOTS.length||id&&!state.adventure.inventory.includes(id))return false;state.adventure.equipped=id;return true;}
export const PACKS=['Красная','Синяя','Зелёная','Жёлтая','Фиолетовая','Оранжевая','Бирюзовая','Розовая','Белая','Чёрная'].map((name,id)=>({id,name,color:['#f04d52','#4c8cff','#54cd72','#ffe268','#b67aff','#ff9e46','#49e1cf','#ff79bb','#e7edf4','#43495c'][id]}));
PACKS.push(...['Бордовая','Лимонная','Мятная','Лазурная','Сиреневая','Медная','Салатовая','Индиго','Коралловая','Серебряная'].map((name,i)=>({id:i+10,name,color:['#922b47','#d3df55','#9be4b5','#39b8df','#d8abef','#b98250','#95c948','#5354a8','#ff997f','#bbc7d0'][i],rooftop:true})));
export const EVENT_INFO={spill:{title:'Упавший груз',text:'Соберите три коробки возле фургона. Можно помочь за 80 ₽ или отказаться.',reward:80},delivery:{title:'Срочная доставка',text:'Заберите посылку и доставьте за четыре минуты. До 150 ₽ за целый груз; авария может выбросить его из машины.',reward:150},favor:{title:'Кошелёк продавца',text:'Найдите потерянный кошелёк и верните продавцу. Награда 120 ₽ и знакомство: кофе здесь вполовину дешевле в следующих сменах.',reward:120}};
export const BRIBE_RESET_SECONDS=30;
export function newAdventure(){return {inventory:[],equipped:null,pickedWeapons:[],cigarettes:[],collectionRewarded:false,knocked:[],drops:[],events:{spill:{status:'offered',boxes:[]},delivery:{status:'offered',carrying:false,integrity:100,due:0,drop:null},favor:{status:'offered',found:false}},fun:{goals:0,footballWon:false,table:{matched:[],open:[],won:false}},garage:{condition:100,vanId:null},tracked:null,bribes:{count:0,lastAt:null}};}
export function ensureAdventure(state){
 const base=newAdventure(),old=state.adventure??{};
 Object.assign(old,{...base,...old,events:Object.fromEntries(Object.keys(base.events).map(k=>[k,{...base.events[k],...old.events?.[k]}])),fun:{...base.fun,...old.fun,table:{...base.fun.table,...old.fun?.table}},garage:{...base.garage,...old.garage}});state.adventure=old;
 const a=state.adventure;
 a.bribes={count:0,lastAt:null,...a.bribes};
 a.stones=Math.max(0,Math.min(5,Math.floor(Number(a.stones)||0)));a.pickedStoneSites??=[];a.stoneDrops??=[];
 a.apples=Math.max(0,Math.min(30,Math.floor(Number(a.apples)||0)));a.weaponDrops??=[];a.policeLootRolls??=[];
 a.bribes.count=Math.max(0,Math.floor(Number(a.bribes.count)||0));
 if(!Number.isFinite(a.bribes.lastAt))a.bribes.lastAt=null;
 a.inventory=[...new Set(Array.isArray(a.inventory)?a.inventory:[])].filter(k=>WEAPONS[k]);
 a.cigarettes=[...new Set(Array.isArray(a.cigarettes)?a.cigarettes:[])].filter(i=>Number.isInteger(i)&&i>=0&&i<PACKS.length);
 if(!a.inventory.includes(a.equipped))a.equipped=null;
 state.career.garage={engine:false,suspension:false,van:false,...state.career.garage};
 state.career.contacts??=[];
 return a;
}
export function collectPack(state,id){const a=state.adventure;if(!PACKS[id]||a.cigarettes.includes(id))return false;a.cigarettes.push(id);if(a.cigarettes.filter(i=>i<10).length===10&&!a.collectionRewarded){a.collectionRewarded=true;state.money+=300;}if(a.cigarettes.filter(i=>i>=10).length===10&&!a.roofCollectionRewarded){a.roofCollectionRewarded=true;state.money+=400;}return true;}
export function pickupWeapon(state,id){const a=state.adventure;if(!WEAPONS[id])return false;if(!a.inventory.includes(id))a.inventory.push(id);if(!a.pickedWeapons.includes(id))a.pickedWeapons.push(id);a.equipped=id;return true;}
export function pickupStone(state,id){const a=state.adventure;if((a.stones??0)>=5||a.pickedStoneSites?.includes(id))return false;a.stones=(a.stones??0)+1;a.pickedStoneSites??=[];if(!id.startsWith('thrown:'))a.pickedStoneSites.push(id);if(!a.inventory.includes('stone'))a.inventory.push('stone');a.equipped='stone';return true;}
export function consumeStone(state){if(!(state.adventure.stones>0))return false;state.adventure.stones--;return true;}
export function consumeApple(state){if(!(state.adventure.apples>0))return false;state.adventure.apples--;return true;}
export function bribePrice(state){const b=state.adventure.bribes,elapsed=state.time-(b?.lastAt??-Infinity);return 50*(1+(elapsed>=0&&elapsed<BRIBE_RESET_SECONDS?(b?.count??0):0));}
export function bribeGuard(state){const price=bribePrice(state);if(state.wanted<=0||state.money<price)return false;state.money-=price;state.wanted=Math.max(0,Math.ceil(state.wanted)-1);state.wantedElapsed=0;state.wantedParkourCredit=0;state.adventure.bribes={count:price/50,lastAt:state.time};return true;}
export function startEvent(state,id){const e=state.adventure.events[id];if(!e||e.status!=='offered')return false;e.status='active';if(id==='delivery')e.due=state.time+240;state.adventure.tracked=id;return true;}
export function finishEvent(state,id,keep=false){const a=state.adventure,e=a.events[id];if(!e||e.status!=='active')return 0;let amount=0;
 if(id==='spill'&&e.boxes.length===3)amount=80+(state.career.contacts.includes('seller')?20:0);
 if(id==='delivery'&&e.carrying){amount=Math.round((state.time<=e.due?90:50)+e.integrity*.6);e.carrying=false;}
 if(id==='favor'&&e.found){amount=keep?80:120;if(!keep){if(!state.career.contacts.includes('seller'))state.career.contacts.push('seller');state.career.loyalty[0]++;remember(state);}else state.reputation-=5;}
 if(!amount)return 0;e.status=keep?'kept':'done';state.money+=amount;if(a.tracked===id)a.tracked=null;return amount;
}
export function buyGarage(state,id){const prices={engine:400,suspension:250,van:900,repair:120},cost=prices[id];if(!cost||state.money<cost)return false;
 if(id==='repair'){if(state.adventure.garage.condition>=100)return false;state.adventure.garage.condition=100;}
 else{if(state.career.garage[id])return false;state.career.garage[id]=true;remember(state);}state.money-=cost;return true;
}
export function crashCargo(state,speed,position){const a=state.adventure,damage=Math.min(30,Math.round(Math.abs(speed)*(state.career.garage.suspension?.5:1.5)));a.garage.condition=Math.max(0,a.garage.condition-damage);const e=a.events.delivery;
 if(e.status==='active'&&e.carrying){e.integrity=Math.max(0,e.integrity-damage);if(Math.abs(speed)>8&&!state.career.garage.suspension){e.carrying=false;e.drop={x:position.x,z:position.z};}}
}
export function tableCard(state,index){const t=state.adventure.fun.table,deck=[0,2,1,0,1,2];if(t.won||index<0||index>5||t.matched.includes(index)||t.open.includes(index))return false;if(t.open.length===2)t.open=[];t.open.push(index);
 if(t.open.length===2&&deck[t.open[0]]===deck[t.open[1]]){t.matched.push(...t.open);t.open=[];if(t.matched.length===6){t.won=true;state.stress=Math.max(0,state.stress-10);state.money+=20;}}return true;
}
