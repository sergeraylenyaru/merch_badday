import { WORK_STOPS, START } from './city/reference-layout.js';
import {makeShift,urgentReward,career,remember} from './city/shift.js';
import { JOBS, newJob, jobDone, isShopUnlocked } from './jobs/catalog.js';
import { newPlanogram } from './jobs/match3.js';
export const SHOPS = [
  [
    "У дома",
    "Нина · директор",
    "Тележки снова на тротуаре. Начнём с порядка.",
    -55,
    20,
    "#e6af55",
    2,
    "badge",
  ],
  [
    "Экономыч",
    "Олег · менеджер",
    "Выкладка должна быть по планограмме.",
    -55,
    -55,
    "#ed724c",
    3,
    "shelf",
  ],
  [
    "Семейный",
    "Лена · администратор",
    "Покупатели оставили тележки между машинами.",
    20,
    -55,
    "#71aaba",
    3,
    "photo",
  ],
  [
    "Маркет 24",
    "Саша · кассир",
    "У меня очередь. Принесите тележки и помогите с полкой.",
    95,
    -55,
    "#9976b5",
    2,
    "shelf",
  ],
  [
    "СуперЦена",
    "Борис · охранник",
    "Покажите бейдж. У нас посторонним нельзя.",
    95,
    20,
    "#d7a44b",
    3,
    "badge",
  ],
  [
    "Большая Корзина",
    "Игорь · директор",
    "На парковке опять пробка. Разберите тележки.",
    95,
    95,
    "#7a9c66",
    4,
    "photo",
  ],
  [
    "Свежак",
    "Алла · директор",
    "Товар перепутали. Исправьте выкладку.",
    20,
    95,
    "#83af74",
    3,
    "shelf",
  ],
  [
    "ГиперМакс",
    "Виктор · управляющий",
    "Закроем день, когда будут тележки и фотоотчёт.",
    -55,
    95,
    "#cf7772",
    4,
    "photo",
  ],
  ["Парк Маркет", "Марина · управляющая", "Документы поставки", 20, 20, "#659783", 2],
].map(([name, npc, description, x, z, color, required], i) => ({
  id: i,
  name,
  npc,
  description: JOBS[i].description,
  x: WORK_STOPS[i].x,
  z: WORK_STOPS[i].z,
  code: WORK_STOPS[i].code,
  color,
  required,
  task: JOBS[i].type,
}));
export const freshState = () => ({
  version: 1,
  cityVersion: 3,
  overtime: false,
  wantedElapsed: 0,
  shift: {...makeShift(),upgrades:{...career().upgrades}},
  career: career(),
  missionVersion: 3,
  onboarding: {callReceived: false},
  carrying: null,
  gateNotified: false,
  time: 0,
  health: 100,
  stress: 12,
  reputation: 50,
  money: 300,
  wanted: 0,
  conflicts: 0,
  fines: 0,
  bonus: 0,
  energy: 0,
  ending: null,
  selected: 0,
  position: {...START},
  shops: SHOPS.map((shop) => ({
    carts: 0,
    done: false,
    badge: false,
    shelf: false,
    photo: false,
    rep: 0,
    job: newJob(shop.id),
  })),
  messages: [
    "Региональный: Девять точек — девять разных задач. Задания и адреса — в телефоне. Тележки теперь за отдельный бонус.",
    "Утро у дома. Ответьте на звонок регионального, возьмите свою машину и отправляйтесь к магазину «У дома». После парковки Нина даст работу в зале. ГиперМакс откроется после пяти визитов.",
  ],
  carts: [],
  vehicles: [],
  weather: false,
});
export function normalize(s) {
  s.health = Math.max(0, Math.min(100, s.health));
  s.stress = Math.max(0, Math.min(100, s.stress));
  s.reputation = Math.max(0, Math.min(100, s.reputation));
  s.wanted = Math.max(0, Math.min(5, s.wanted));
}
export function canComplete(s, id) {
  const p = s.shops[id],
    shop = SHOPS[id];
  return !p.done && isShopUnlocked(s, id) && jobDone(s, id);
}
export function complete(s, id) {
  if (!canComplete(s, id)) return false;
  s.bonus += Math.min(3,s.career.loyalty[id])*20;
  s.career.loyalty[id]++; remember(s);
  s.shops[id].done = true;
  s.shops[id].rep += 10;
  s.reputation += 5;
  s.stress -= 8;
  s.money += 200;
  s.bonus += 100 + urgentReward(s,id);
  normalize(s);
  if (s.shops.every((x) => x.done)) finish(s);
  return true;
}
export function finish(s, quit = false) {
  const allDone = s.shops.every((p) => p.done);
  s.ending = quit
    ? "Уволен по собственному желанию"
    : s.wanted >= 3
      ? "Самый разыскиваемый мерч"
      : s.conflicts >= 8
        ? "Региональный кошмар"
        : allDone && s.reputation >= 85
          ? "Звезда торгового зала"
          : allDone && s.conflicts < 2
            ? "Работник месяца"
            : s.shops.every((p, i) => p.carts >= SHOPS[i].required)
              ? "Король тележек"
              : "Выжил и ладно";
  return s.ending;
}
export function save(s, storage = localStorage) {
  storage.setItem("merch-badday-v1", JSON.stringify(s));
}
export function load(storage = localStorage) {
  try {
    const s = JSON.parse(storage.getItem("merch-badday-v1"));
    if (
      s?.version === 1 &&
      [8, 9].includes(s.shops?.length) &&
      s.shops.every((p) => typeof p.done === "boolean") &&
      Number.isFinite(s.time) &&
      s.position &&
      Number.isFinite(s.position.x) &&
      Number.isFinite(s.position.z)
    ) {
      const v = { ...freshState(), ...s };
      if(s.shops.length===8&&Array.isArray(v.vehicles)){v.vehicles=[...v.vehicles];v.vehicles.splice(8,0,null);}
      const migrating = ![2,3].includes(s.missionVersion);
      v.missionVersion = 3;
      v.onboarding = {callReceived: s.onboarding ? s.onboarding.callReceived === true : true};
      if (s.cityVersion !== 3) {
        v.cityVersion = 3; v.position = {...START}; v.carts=[]; v.vehicles=[]; v.carrying=null;
      }
      v.wantedElapsed = Number.isFinite(v.wantedElapsed) ? v.wantedElapsed : 0;
      if (!v.shift?.order || v.shift.order.length !== 9) v.shift = makeShift();
      if (!v.career?.loyalty || v.career.loyalty.length !== 9) v.career=career();
      v.shift.upgrades={...v.shift.upgrades,...v.career.upgrades};
      v.shops = freshState().shops.map((base, id) => {
        const old = s.shops[id] ?? base;
        const job = { ...newJob(id), ...(!migrating && old.job && typeof old.job === 'object' ? old.job : {}) };
        if (id === 1) {
          const game = job.match;
          if (!Array.isArray(game?.board) || game.board.length !== 36 || !game.board.every((n) => Number.isInteger(n) && n >= 0 && n < 5)
            || !Array.isArray(game.collected) || game.collected.length !== 5 || !game.collected.every((n) => Number.isFinite(n) && n >= 0)
            || !Number.isInteger(game.moves) || game.moves < 0 || game.moves > 18) job.match = newPlanogram();
          job.match.seed = Number.isInteger(job.match.seed) ? job.match.seed >>> 0 : 19071;
          job.match.score = Number.isFinite(job.match.score) ? Math.max(0, job.match.score) : 0;
        }
        if (id === 0) { job.assigned = job.assigned === true || old.done; job.stocked = old.done ? [0,1,2] : [...new Set(Array.isArray(job.stocked) ? job.stocked : [])].filter(i=>[0,1,2].includes(i)); job.paid = job.paid === true; if (!Number.isInteger(job.parkedCarId) || job.parkedCarId < 0) { job.parkedCarId = null; job.paid = false; } }
        if (id === 2 || id === 4) job.delivered = [...new Set(Array.isArray(job.delivered) ? job.delivered : [])].filter((n) => (id === 2 ? [5, 6] : [0, 1, 2]).includes(n));
        if (id === 3 && (!Array.isArray(job.circuit) || job.circuit.length !== 9 || !job.circuit.every((n) => Number.isInteger(n) && n >= 1 && n < 16))) job.circuit = newJob(3).circuit;
        if (id === 5) job.removed = [...new Set(Array.isArray(job.removed) ? job.removed : [])].filter((n) => [0, 2, 4].includes(n));
        if (id === 6 && (!Array.isArray(job.labels) || job.labels.length !== 3)) job.labels = [null, null, null];
        if (id === 7) {
          job.searched = [...new Set(Array.isArray(job.searched) ? job.searched : [])].filter((n) => [0, 1, 2].includes(n));
          if (![0, 1, 2].includes(job.scannerLocation)) job.scannerLocation = 2;
        }
        return { carts: 0, badge: false, shelf: false, photo: false, rep: 0, ...old, job };
      });
      if (migrating) {
        v.carrying = null;
        v.carts = [...(Array.isArray(v.carts) ? v.carts : [])];
        if (!v.shops[2].done) for (let i = 0; i < 2; i++) v.carts[5 + i] = { x: SHOPS[2].x - 23.3 + i * 2.6, z: SHOPS[2].z - 1.5, heading: 0 };
        if (!v.shops[4].done && Array.isArray(v.vehicles)) v.vehicles[4] = null;
      }
      if (v.carrying && (v.carrying.shop !== 4 || ![0, 1, 2].includes(v.carrying.box) || v.shops[4].job.delivered.includes(v.carrying.box))) v.carrying = null;
      if(v.carrying?.extra!==undefined&&(![0,1,2].includes(v.carrying.extra)||v.carrying.extra===v.carrying.box||v.shops[4].job.delivered.includes(v.carrying.extra))) delete v.carrying.extra;
      normalize(v);
      return v;
    }
  } catch {}
  return freshState();
}
