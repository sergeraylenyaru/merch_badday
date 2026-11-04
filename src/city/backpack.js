import {remember} from './shift.js';
export const BAG_ITEMS={energy:{name:'Энергетик',action:'Выпить',effect:'Бег 10 м/с на 45 секунд · стресс −5, затем +12'},boots:{name:'Обувь для бега',action:'Надеть',effect:'Обычный бег быстрее примерно на 10%'},gloves:{name:'Перчатки для груза',action:'Надеть',effect:'Переноска одной коробки быстрее на 20%'}};
export function ensureBackpack(state){
 state.career.upgrades??={};state.shift.upgrades??={};
 const bag=state.backpack??{...state.career.supplies};bag.energy=Math.max(0,Math.min(99,Math.floor(Number(bag.energy)||0)));
 for(const id of ['boots','gloves'])bag[id]=!!(bag[id]||state.career.upgrades[id]||state.shift.upgrades[id]);
 state.backpack=bag;state.wearing??={...(state.career.wearing??state.shift.upgrades)};
 for(const id of ['boots','gloves'])state.shift.upgrades[id]=state.wearing[id]=bag[id]&&state.wearing[id]===true;
 return bag;
}
export function rememberBackpack(state){state.career.supplies={...state.backpack};state.career.wearing={...state.wearing};remember(state);}
export function packPurchase(state,id){const bag=ensureBackpack(state);if(id==='energy'){if(bag.energy>=99)return false;bag.energy++;}else if(['boots','gloves'].includes(id)){if(bag[id])return false;bag[id]=true;state.career.upgrades[id]=true;}else return false;rememberBackpack(state);return true;}
export function useBackpackItem(state,id){const bag=ensureBackpack(state);if(id==='energy'){if(!bag.energy||state.energy>0)return false;bag.energy--;state.energy=45;state._energyActive=true;state.stress=Math.max(0,state.stress-5);}else if(['boots','gloves'].includes(id)&&bag[id])state.shift.upgrades[id]=state.wearing[id]=!state.wearing[id];else return false;rememberBackpack(state);return true;}
