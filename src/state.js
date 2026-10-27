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
].map(([name, npc, description, x, z, color, required], i) => ({
  id: i,
  name,
  npc,
  description: JOBS[i].description,
  x,
  z,
  color,
  required,
  task: JOBS[i].type,
}));
export const freshState = () => ({
  version: 1,
  missionVersion: 2,
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
  position: { x: -42, z: 34 },
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
    "Региональный: Восемь точек — восемь разных задач. Задания и адреса — в телефоне. Тележки теперь за отдельный бонус.",
    "ГиперМакс откроется после пяти подтверждённых визитов. Начать можно с любого другого магазина.",
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
  s.shops[id].done = true;
  s.shops[id].rep += 10;
  s.reputation += 5;
  s.stress -= 8;
  s.money += 200;
  s.bonus += 100;
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
      s.shops?.length === 8 &&
      s.shops.every((p) => typeof p.done === "boolean") &&
      Number.isFinite(s.time) &&
      s.position &&
      Number.isFinite(s.position.x) &&
      Number.isFinite(s.position.z)
    ) {
      const v = { ...freshState(), ...s };
      const migrating = s.missionVersion !== 2;
      v.missionVersion = 2;
      v.shops = s.shops.map((old, id) => {
        const job = { ...newJob(id), ...(!migrating && old.job && typeof old.job === 'object' ? old.job : {}) };
        if (id === 1) {
          const game = job.match;
          if (!Array.isArray(game?.board) || game.board.length !== 36 || !game.board.every((n) => Number.isInteger(n) && n >= 0 && n < 5)
            || !Array.isArray(game.collected) || game.collected.length !== 5 || !game.collected.every((n) => Number.isFinite(n) && n >= 0)
            || !Number.isInteger(game.moves) || game.moves < 0 || game.moves > 18) job.match = newPlanogram();
          job.match.seed = Number.isInteger(job.match.seed) ? job.match.seed >>> 0 : 19071;
          job.match.score = Number.isFinite(job.match.score) ? Math.max(0, job.match.score) : 0;
        }
        if (id === 0) { job.paid = job.paid === true; if (!Number.isInteger(job.parkedCarId) || job.parkedCarId < 0) { job.parkedCarId = null; job.paid = false; } }
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
      normalize(v);
      return v;
    }
  } catch {}
  return freshState();
}
