import { newPlanogram, planogramWon } from './match3.js';
import { newCircuit, circuitConnected } from './circuit.js';

export const JOBS = [
  { type: 'parking', title: 'Свободное место', description: 'Найдите голубое парковочное место, припаркуйте легковую машину и оплатите 40 ₽ в паркомате.', action: 'Оплатить парковку', point: [11, 14.8] },
  { type: 'planogram', title: 'Полочная головоломка', description: 'Выполните планограмму: соберите по 6 упаковок чая, сока и крупы в игре «три в ряд».', action: 'Планограмма: три в ряд', point: [8, -1] },
  { type: 'warehouse', title: 'Акцизная поставка', description: 'Зайдите на склад слева от магазина и вывезите две загруженные табачными коробками тележки в голубую приёмку.', action: 'Склад: две тележки', point: [-22, 2] },
  { type: 'repair', title: 'Снова светло', description: 'В правом холодильном шкафу погасла подсветка. Соедините контакты на панели, затем включите лампу.', action: 'Починить подсветку', point: [11, -4.7] },
  { type: 'delivery', title: 'Товар приехал', description: 'Разгрузите три коробки из грузовика: E — взять, отнесите их в приёмку внутри магазина и нажмите E.', action: 'Разгрузить товар', point: [16, 8.8] },
  { type: 'expiry', title: 'Проверка сроков', description: 'Проверьте шесть партий на левой полке и снимите три просроченных товара. Дата смены — 27 октября.', action: 'Проверить сроки годности', point: [-8, -1] },
  { type: 'prices', title: 'Цена на полке', description: 'Сверьте накладную с фруктовым прилавком и замените три неверных ценника.', action: 'Сверить и заменить ценники', point: [10.9, 5.7] },
  { type: 'scanner', title: 'Потерянный ТСД', description: 'Найдите терминал сбора данных: проверьте тару у кассы, коробки у полки и правого холодильника. Верните его управляющему.', action: 'Поиск терминала', point: [-11, 1.6], unlockAfter: 5 },
];
JOBS.push({type:'courier',title:'Документы поставки',description:'Заберите накладную в приёмке слева от стеллажей и передайте управляющей.',point:[-3.8,-4.8]});
export const EXPIRY_BATCHES = [
  { name: 'Йогурт', date: '24.10', expired: true },
  { name: 'Крупа', date: '30.12', expired: false },
  { name: 'Салат', date: '26.10', expired: true },
  { name: 'Сок', date: '03.11', expired: false },
  { name: 'Молоко', date: '25.10', expired: true },
  { name: 'Чай', date: '10.12', expired: false },
];
export const PRICE_ITEMS = [
  { name: 'Яблоки', price: 89, old: 99, options: [79, 89, 99] },
  { name: 'Томаты', price: 119, old: 129, options: [129, 109, 119] },
  { name: 'Бананы', price: 139, old: 159, options: [139, 159, 149] },
];
export const WAREHOUSE_RECEIVING = Object.freeze({ x: -1, z: 7.4, w: 6.5, d: 4 });
export const DELIVERY_ORDER = Object.freeze([2, 0, 1]); // top carton before its supporting carton
export function newJob(id) {
  return [
    () => ({ paid: false, parkedCarId: null }),
    () => ({ match: newPlanogram() }),
    () => ({ delivered: [] }),
    () => ({ circuit: newCircuit(), repaired: false, rotations: 0 }),
    () => ({ delivered: [] }),
    () => ({ removed: [] }),
    () => ({ labels: [null, null, null] }),
    () => ({ searched: [], scannerFound: false, scannerReturned: false, scannerLocation: 2 }),
    () => ({collected:false}),
  ][id]();
}
export function isShopUnlocked(state, id) {
  return state.shops[id].done || state.shops.filter((shop) => shop.done).length >= (JOBS[id].unlockAfter || 0);
}
export function jobDone(state, id) {
  const p = state.shops[id].job;
  if (!p) return false;
  switch (JOBS[id].type) {
    case 'courier': return p.collected === true;
    case 'parking': return p.paid === true && Number.isInteger(p.parkedCarId) && p.parkedCarId >= 0;
    case 'planogram': return !!p.match && planogramWon(p.match);
    case 'warehouse': return [5, 6].every((cart) => p.delivered.includes(cart));
    case 'repair': return p.repaired === true && circuitConnected(p.circuit);
    case 'delivery': return [0, 1, 2].every((box) => p.delivered.includes(box));
    case 'expiry': return EXPIRY_BATCHES.every((batch, i) => !batch.expired || p.removed.includes(i));
    case 'prices': return PRICE_ITEMS.every((item, i) => p.labels[i] === item.price);
    case 'scanner': return p.scannerFound && p.scannerReturned;
    default: return false;
  }
}
export function jobProgress(state, id) {
  const p = state.shops[id].job;
  if (!isShopUnlocked(state, id)) return `ЗАКРЫТО · ВИЗИТЫ ${state.shops.filter((s) => s.done).length}/5`;
  if (state.shops[id].done) return 'ВИЗИТ ПОДТВЕРЖДЁН';
  if (jobDone(state, id)) return 'ГОТОВО · НАЙДИТЕ ДИРЕКТОРА';
  switch (JOBS[id].type) {
    case 'courier': return 'НАКЛАДНАЯ · ЗАБЕРИТЕ В ПРИЁМКЕ';
    case 'parking': return p.parkedCarId === null ? 'ПАРКОВКА · НАЙДИТЕ МЕСТО' : 'ПАРКОВКА · ОПЛАТИТЕ 40 ₽';
    case 'planogram': return `ПЛАНОГРАММА · ${p.match.collected.slice(0, 3).map((n) => Math.min(6, n)).join(' / ')} ИЗ 6`;
    case 'warehouse': return `ПОСТАВКА · ${p.delivered.length}/2 ТЕЛЕЖКИ`;
    case 'repair': return 'ПОДСВЕТКА · СОЕДИНИТЕ КОНТАКТЫ';
    case 'delivery': return `РАЗГРУЗКА · ${p.delivered.length}/3 КОРОБКИ`;
    case 'expiry': return `ПРОСРОЧКА · ${p.removed.length}/3 СНЯТО`;
    case 'prices': return `ЦЕННИКИ · ${p.labels.filter((v, i) => v === PRICE_ITEMS[i].price).length}/3`;
    case 'scanner': return p.scannerFound ? 'ТСД У ВАС · ВЕРНИТЕ УПРАВЛЯЮЩЕМУ' : `ПОИСК ТСД · ${p.searched.length}/3 МЕСТА`;
  }
}
export function payParking(state, carId) {
  const job = state.shops[0].job;
  if (job.paid || !Number.isInteger(carId) || carId < 0 || state.money < 40) return false;
  state.money -= 40;
  job.parkedCarId = carId;
  job.paid = true;
  return true;
}
