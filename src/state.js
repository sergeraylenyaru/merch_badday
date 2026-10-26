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
].map(([name, npc, description, x, z, color, required, task], i) => ({
  id: i,
  name,
  npc,
  description,
  x,
  z,
  color,
  required,
  task,
}));
export const freshState = () => ({
  version: 1,
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
  shops: SHOPS.map(() => ({
    carts: 0,
    done: false,
    badge: false,
    shelf: false,
    photo: false,
    rep: 0,
  })),
  messages: [
    "Региональный: Доброе утро! Сегодня 8 точек. И пожалуйста, без жалоб.",
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
  return p.carts >= shop.required && p[shop.task] && !p.done;
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
      normalize(v);
      return v;
    }
  } catch {}
  return freshState();
}
