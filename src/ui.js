import { SHOPS } from "./state.js";
export function createUI(state, actions) {
  const root = document.createElement("div");
  document.body.append(root);
  root.innerHTML = `<div class="hud hidden" id="hud"><div class="topline"><div><div class="brand">ПЛОХОЙ ДЕНЬ МЕРЧА<small>ЕЩЁ ОДНА ОБЫЧНАЯ СМЕНА</small></div><div class="objective panel"><div class="eyebrow">РАБОЧИЙ МАРШРУТ <span id="routeCount"></span></div><h2 id="targetName"></h2><p id="targetDesc"></p><div class="progressbar"><i id="routeBar"></i></div><div class="row"><span id="cartCount"></span><span id="distance"></span></div></div></div><div class="clock"><strong id="clock">08:00</strong><p>ДО КОНЦА СМЕНЫ <span id="remaining"></span></p><div class="wanted" id="wanted">☆☆☆☆☆</div><div class="speed" id="speed"></div></div></div><div class="bottomline"><div class="bottomleft"><div class="mapbox panel"><canvas id="minimap" width="300" height="300"></canvas><div class="mapcaption"><span>СЕВЕРНЫЙ РАЙОН</span><span>↑ N</span></div></div><div class="statbox panel"><div class="eyebrow">МЕРЧЕНДАЙЗЕР · СТАЖЁР</div><div class="stat"><span>ЗДОРОВЬЕ</span><div class="meter"><i id="hpBar"></i></div><span id="hp"></span></div><div class="stat"><span>СТРЕСС</span><div class="meter stress"><i id="stressBar"></i></div><span id="stress"></span></div><div class="row" style="font-size:11px;color:#d8c28e" id="money"></div></div></div><div class="controls"><span><b>WASD</b>движение</span><span><b>E</b>действие</span><span><b>R</b>тележка</span><span><b>M</b>телефон</span><span><b>ESC</b>пауза</span></div></div></div><div class="crosshair hidden" id="crosshair"></div><div class="context hidden" id="context"><span></span></div><div class="toast" id="toast"></div><div id="overlay"></div><div class="loading" id="loading">СОБИРАЕМ ТЕЛЕЖКИ…</div>`;
  const $ = (id) => document.getElementById(id);
  let toastTimer,
    tab = "Маршрут";
  function toast(t) {
    $("toast").textContent = t;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4500);
  }
  function map(canvas, world) {
    const ctx = canvas.getContext("2d"),
      w = canvas.width;
    ctx.fillStyle = "#304839";
    ctx.fillRect(0, 0, w, w);
    const p = (x) => ((x + 130) / 300) * w;
    ctx.strokeStyle = "#76816b";
    ctx.lineWidth = w * 0.045;
    for (const v of [-17.5, 57.5]) {
      ctx.beginPath();
      ctx.moveTo(p(v), 0);
      ctx.lineTo(p(v), w);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p(v));
      ctx.lineTo(w, p(v));
      ctx.stroke();
    }
    SHOPS.forEach((s) => {
      ctx.fillStyle = state.shops[s.id].done
        ? "#95b68c"
        : s.id === state.selected
          ? "#f1c76d"
          : "#bbbea0";
      ctx.fillRect(p(s.x) - 7, p(s.z) - 7, 14, 14);
      ctx.fillStyle = "#23372a";
      ctx.font = `bold ${Math.round(w * 0.035)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText(String(s.id + 1), p(s.x), p(s.z) + 4);
    });
    if (world)
      for (const n of world.people.filter(
        (n) => n.kind === "police" && state.wanted > 0,
      )) {
        ctx.fillStyle = "#90b9df";
        ctx.fillRect(p(n.mesh.position.x) - 3, p(n.mesh.position.z) - 3, 6, 6);
      }
    ctx.fillStyle = "#fff0bd";
    ctx.beginPath();
    ctx.arc(p(state.position.x), p(state.position.z), 5, 0, Math.PI * 2);
    ctx.fill();
  }
  function update(world, vehicle) {
    const s = SHOPS[state.selected],
      p = state.shops[s.id],
      done = state.shops.filter((x) => x.done).length;
    const hour = 8 + state.time / 150;
    const hh = Math.floor(hour),
      mm = Math.floor((hour - hh) * 60);
    $("clock").textContent =
      `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    $("remaining").textContent =
      `${Math.max(0, Math.ceil((1500 - state.time) / 60))} МИН`;
    $("routeCount").textContent = `${done} / 8`;
    $("routeBar").style.width = `${(done / 8) * 100}%`;
    $("targetName").textContent =
      `${String(s.id + 1).padStart(2, "0")} / ${s.name}`;
    $("targetDesc").textContent = p.done
      ? "Визит подтверждён. Выберите следующую точку в телефоне."
      : p.carts < s.required
        ? "Соберите тележки в жёлтой зоне. Затем найдите сотрудника внутри магазина."
        : !p[s.task]
          ? {
              badge: "Покажите бейдж сотруднику магазина.",
              shelf: "Исправьте выкладку на правой полке: E рядом с ней.",
              photo: "Сделайте фотоотчёт в телефоне, находясь у тележек.",
            }[s.task]
          : "Поговорите с сотрудником и подтвердите визит.";
    $("cartCount").textContent = `ТЕЛЕЖКИ ${p.carts} / ${s.required}`;
    $("distance").textContent =
      `${Math.round(Math.hypot(s.x - state.position.x, s.z - state.position.z))} М`;
    $("hp").textContent = Math.round(state.health);
    $("stress").textContent = Math.round(state.stress);
    $("hpBar").style.width = `${state.health}%`;
    $("stressBar").style.width = `${state.stress}%`;
    $("money").textContent =
      `${Math.round(state.money)} ₽   ·   Репутация ${Math.round(state.reputation)}`;
    $("wanted").textContent =
      "★".repeat(Math.ceil(state.wanted)) +
      "☆".repeat(5 - Math.ceil(state.wanted));
    $("speed").textContent = vehicle
      ? `${Math.round(Math.abs(vehicle.speed) * 3.6)} км/ч`
      : "";
    map($("minimap"), world);
    if ($("bigmap")) map($("bigmap"), world);
  }
  function clear() {
    $("overlay").innerHTML = "";
    $("hud").classList.remove("hidden");
    $("crosshair").classList.remove("hidden");
  }
  function show(html) {
    $("overlay").innerHTML = html;
    $("context").classList.add("hidden");
    $("crosshair").classList.add("hidden");
  }
  function confirmNewShift() {
    if (confirm("Начать новую смену? Маршрут, деньги и задания текущей смены будут сброшены. Настройки останутся."))
      actions.restart();
  }
  function intro() {
    const hasProgress = state.time > 0 || state.shops.some((shop) =>
      shop.done || shop.carts > 0 || shop.badge || shop.shelf || shop.photo,
    );
    show(
      `<div class="veil"><div class="intro"><div class="tag">ГОРОДСКАЯ ПЕСОЧНИЦА · ПЕРВАЯ СМЕНА</div><h1>ПЛОХОЙ ДЕНЬ<br><em>МЕРЧА.</em></h1><p class="subtitle">Восемь магазинов. Один мерчендайзер.<br>Ноль причин задерживаться на работе.</p><p>Собирай тележки, договаривайся с директорами и закрой маршрут до конца смены. Или посмотри, насколько плохим может стать этот день.</p><div class="actions"><button class="primary" id="begin">${hasProgress ? "ПРОДОЛЖИТЬ СМЕНУ" : "ВЫЙТИ НА МАРШРУТ"} ↗</button>${hasProgress ? '<button class="secondary" id="newShift" title="Сбросить текущий маршрут и начать с 08:00">НОВАЯ СМЕНА</button>' : ""}<button class="secondary" id="how">КАК ВЫЖИТЬ?</button></div><div class="introfooter"><div><b>08</b>ТОРГОВЫХ ТОЧЕК</div><div><b>25</b>МИНУТ ДО КОНЦА ДНЯ</div><div><b>∞</b>НЕУДАЧНЫХ РЕШЕНИЙ</div></div></div><div class="buildtag">СЕВЕРНЫЙ РАЙОН / У ДОМА</div></div>`,
    );
    $("begin").onclick = actions.resume;
    $("how").onclick = () => pause(true);
    if ($("newShift")) $("newShift").onclick = confirmNewShift;
  }
  function pause(help = false) {
    show(
      `<div class="modal"><div class="window settings"><div class="eyebrow">${help ? "ПАМЯТКА МЕРЧЕНДАЙЗЕРА" : "КОФЕ-БРЕЙК"}</div><h2>${help ? "Как пережить эту смену" : "Смена на паузе"}</h2><p>WASD — ходить или вести машину; Shift — бег / ручной тормоз; Space — прыжок / тормоз; Ctrl — присесть; C — камера. Мышь — обзор (щелчок по городу захватывает курсор).</p><p>E — разговор, полка, кофе, сесть / выйти из машины. R — взяться за ручку / отпустить тележку; в фургоне — загрузить / выгрузить. С тележкой WASD — движение, мышь или стрелки ← → — поворот. F / ЛКМ — удар, G — сильный удар, Q — блок. M — телефон; Tab — карта.</p><p>Отнесите тележки в жёлтый прямоугольник, выполните просьбу сотрудника и получите подпись. Фото — во вкладке телефона у зоны тележек. Прогресс сохраняется автоматически; телефон и диалоги ставят игру на паузу.</p><label>Чувствительность мыши<input id="sensitivity" type="range" min="0.2" max="2" step="0.1" value="${actions.settings.sensitivity}"></label><label>Громкость<input id="volume" type="range" min="0" max="1" step="0.05" value="${actions.settings.volume}"></label><label>Качество<select id="quality"><option value="low">Экономное</option><option value="high">Высокое</option></select></label><div class="actions"><button class="primary" id="resume">${help ? "ПОНЯТНО, НА МАРШРУТ" : "ПРОДОЛЖИТЬ"}</button><button class="secondary" id="finish">Завершить день</button><button class="secondary" id="quit">Бросить маршрут</button><button class="secondary" id="new">Новая смена</button></div></div></div>`,
    );
    $("quality").value = actions.settings.quality;
    $("quality").onchange = (e) => actions.configure("quality", e.target.value);
    $("sensitivity").oninput = (e) =>
      actions.configure("sensitivity", +e.target.value);
    $("volume").oninput = (e) => actions.configure("volume", +e.target.value);
    $("resume").onclick = actions.resume;
    $("finish").onclick = actions.finish;
    $("quit").onclick = actions.quit;
    $("new").onclick = confirmNewShift;
  }
  function phone(which = tab) {
    tab = which;
    const tabs = ["Маршрут", "Сообщения", "Карта", "Показатели", "Фото"];
    let body = "";
    if (tab === "Маршрут")
      body = SHOPS.map(
        (s) =>
          `<button class="shoprow" data-shop="${s.id}"><span class="n">${String(s.id + 1).padStart(2, "0")}</span><strong>${s.name} ${state.shops[s.id].done ? "✓" : state.selected === s.id ? "← ЦЕЛЬ" : ""}</strong><small>Тележки ${state.shops[s.id].carts}/${s.required} · ${state.shops[s.id].done ? "Визит подтверждён" : "Ожидает визита"}</small></button>`,
      ).join("");
    if (tab === "Сообщения")
      body = state.messages
        .slice()
        .reverse()
        .map((m) => `<div class="message"></div>`)
        .join("");
    if (tab === "Карта")
      body =
        '<canvas id="bigmap" width="500" height="500"></canvas><p class="message">Жёлтый — цель · белый — вы · синий — полиция</p>';
    if (tab === "Показатели")
      body = `<div class="message">Репутация: ${Math.round(state.reputation)} / 100<br>Стресс: ${Math.round(state.stress)} / 100<br>Деньги: ${state.money} ₽<br>Премия: ${state.bonus} ₽<br>Конфликты: ${state.conflicts}<br>Штрафы: ${state.fines} ₽<br>Закрыто: ${state.shops.filter((s) => s.done).length} / 8<br>Осталось: ${Math.ceil((1500 - state.time) / 60)} мин</div><div class="actions"><button id="energy" class="secondary">Энергетик · 70 ₽</button></div>`;
    if (tab === "Фото")
      body = `<p class="message">Встаньте у жёлтой зоны магазина. Все тележки должны быть собраны. Фотоотчёт фиксирует текущий вид камеры.</p><button class="primary" id="takePhoto">СДЕЛАТЬ ФОТО</button><div id="photoResult"></div>`;
    show(
      `<div class="modal"><div class="phone"><div class="phonebar"><span>МЕРЧФОН • 4G</span><button class="close" id="close">×</button></div><h2>Рабочий телефон</h2><div class="tabs">${tabs.map((t) => `<button data-tab="${t}" class="${t === tab ? "active" : ""}">${t}</button>`).join("")}</div><div id="phoneBody">${body}</div></div></div>`,
    );
    $("close").onclick = actions.resume;
    document
      .querySelectorAll("[data-tab]")
      .forEach((b) => (b.onclick = () => phone(b.dataset.tab)));
    document.querySelectorAll("[data-shop]").forEach(
      (b) =>
        (b.onclick = () => {
          state.selected = +b.dataset.shop;
          phone();
        }),
    );
    if (tab === "Сообщения")
      document
        .querySelectorAll(".message")
        .forEach(
          (el, i) =>
            (el.textContent = state.messages[state.messages.length - 1 - i]),
        );
    if ($("takePhoto")) $("takePhoto").onclick = actions.photo;
    if ($("energy")) $("energy").onclick = actions.energy;
  }
  function dialogue(shop) {
    const p = state.shops[shop.id];
    show(
      `<div class="modal"><div class="window"><button class="close" id="close">×</button><div class="eyebrow">${shop.name.toUpperCase()} · ОТНОШЕНИЕ ${p.rep}</div><h2>${shop.npc}</h2><p id="speech"></p><div class="dialogueoptions"><button data-choice="polite">Я по рабочему маршруту. Подтвердите визит, пожалуйста.</button><button data-choice="badge">Показать бейдж и пообещать всё сделать.</button><button data-choice="bargain">Может, договоримся? Компенсация 100 ₽.</button><button data-choice="rude">У меня восемь точек! Давайте быстрее.</button></div></div></div>`,
    );
    $("speech").textContent = p.done
      ? "Спасибо, визит уже закрыт. Удачной смены!"
      : shop.description;
    $("close").onclick = actions.resume;
    document
      .querySelectorAll("[data-choice]")
      .forEach((b) => (b.onclick = () => actions.talk(shop, b.dataset.choice)));
  }
  function shelf(shop, order) {
    show(
      `<div class="modal"><div class="window"><button class="close" id="close">×</button><div class="eyebrow">ПЛАНОГРАММА · ${shop.name}</div><h2>Каждому товару своё место</h2><p>Расставьте слева направо: чай → сок → крупа. Нажмите две коробки, чтобы поменять их местами.</p><div class="shelfitems">${order.map((n, i) => `<button data-item="${i}" style="background:${["#83a786", "#df9c67", "#d8c27c"][n]}">${["ЧАЙ", "СОК", "КРУПА"][n]}</button>`).join("")}</div><p id="shelfHint">Выберите первую коробку.</p></div></div>`,
    );
    $("close").onclick = actions.resume;
    let first = null;
    document.querySelectorAll("[data-item]").forEach(
      (b) =>
        (b.onclick = () => {
          const n = +b.dataset.item;
          if (first === null) {
            first = n;
            b.style.outline = "3px solid white";
            $("shelfHint").textContent = "Теперь выберите вторую.";
          } else {
            [order[first], order[n]] = [order[n], order[first]];
            actions.arrange(shop, order);
          }
        }),
    );
  }
  function ending() {
    show(
      `<div class="modal"><div class="window"><div class="eyebrow">СМЕНА ОКОНЧЕНА · ВЫ ЭТО ПЕРЕЖИЛИ</div><h2>${state.ending}</h2><p>Точек закрыто: ${state.shops.filter((s) => s.done).length} / 8<br>Тележек собрано: ${state.shops.reduce((n, s) => n + s.carts, 0)}<br>Репутация: ${Math.round(state.reputation)} · Стресс: ${Math.round(state.stress)}<br>Конфликтов: ${state.conflicts} · Штрафов: ${state.fines} ₽<br>Время в пути: ${Math.floor(state.time / 60)} мин ${Math.floor(state.time % 60)} сек</p><h2>Премия: ${Math.max(0, state.bonus - state.conflicts * 50)} ₽</h2><p>Региональный: «Спасибо за отчёт. Завтра тот же маршрут».</p><button class="primary" id="restart">ЕЩЁ ОДИН ПЛОХОЙ ДЕНЬ ↗</button></div></div>`,
    );
    $("restart").onclick = actions.restart;
  }
  return {
    root,
    $,
    toast,
    map,
    update,
    clear,
    intro,
    pause,
    phone,
    dialogue,
    shelf,
    ending,
    context(t) {
      $("context").classList.toggle("hidden", !t);
      $("context").firstElementChild.textContent = t;
    },
  };
}
