import {ensureBackpack,packPurchase} from './backpack.js';
import {dealWithDima} from './shift.js';
import {buyGarage} from '../adventure/state.js';
export const SUPPLIES={
 energy:{name:'Энергетик',cost:70,currency:'money',vendor:'drinks',effect:'Бег 10 м/с на 45 секунд. Стресс −5 сразу и +12 после окончания эффекта.'},
 boots:{name:'Обувь для бега',reward:true,cost:0,currency:'bonus',vendor:null,effect:'Бег 6,8 → 7,5 м/с. Награда за первое выполненное задание текущей смены.'},
 gloves:{name:'Перчатки для груза',cost:120,currency:'bonus',vendor:'workwear',effect:'С одной коробкой: 2,25 → 2,7 м/с, на 20% быстрее. Улучшение сохраняется между сменами.'},
 dima:{name:'Договор с Димой',cost:40,currency:'money',vendor:'dima',effect:'Сроки срочных визитов продлеваются на две минуты. Один договор на смену.'},
 repair:{name:'Ремонт машины',cost:120,currency:'money',vendor:'garage',effect:'Восстанавливает состояние рабочей машины до 100%.'},
 engine:{name:'Тюнинг двигателя',cost:400,currency:'money',vendor:'garage',effect:'Максимальная скорость рабочей машины повышается на 15%.'},
 suspension:{name:'Усиленная подвеска',cost:250,currency:'money',vendor:'garage',effect:'Уменьшает повреждение груза при столкновениях и предотвращает его выпадение.'},
 van:{name:'Собственный фургон',cost:900,currency:'money',vendor:'garage',effect:'Фургон у дома для перевозки тележек. Покупка сохраняется между сменами.'},
};
export const priceText=item=>item.reward?'Награда за первое задание':`${item.cost} ₽${item.currency==='bonus'?' премии':''}`;
export function supplyOwned(state,id){if(id==='boots'||id==='gloves')return !!ensureBackpack(state)[id];if(id==='dima')return !!state.shift.dima;if(id==='repair')return state.adventure.garage.condition>=100;if(['engine','suspension','van'].includes(id))return !!state.career.garage[id];return false;}
export function planSupply(state,id){if(!SUPPLIES[id]||SUPPLIES[id].reward||supplyOwned(state,id))return false;state.supplyTrip={item:id,vendor:SUPPLIES[id].vendor};return true;}
export function buySupplyAt(state,id,position,seller){
 const item=SUPPLIES[id];if(!item||item.reward||item.vendor!==seller?.id||!position||Math.hypot(position.x-seller.x,position.z-seller.z)>2.6||Math.abs((position.y??0)-(seller.y??0))>1.5||supplyOwned(state,id)||(state[item.currency]??0)<item.cost)return false;
 let ok=false;if(['energy','boots','gloves'].includes(id)){ok=packPurchase(state,id);if(ok)state[item.currency]-=item.cost;}else if(id==='dima')ok=dealWithDima(state);else ok=buyGarage(state,id);
 if(ok&&state.supplyTrip?.item===id)state.supplyTrip=null;if(ok&&state.mapTarget?.id==='vendor:'+item.vendor)state.mapTarget=null;return ok;
}
