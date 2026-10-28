import {mapViewport} from './city/map-view.js';
import {MAP,pixel,districtAt,WORK_STOPS,MAP_MARKERS,point} from './city/reference-layout.js';
import { BOROUGHS, boroughFor, LOCAL_SHOPS } from './city/layout.js';
import { SHOPS } from "./state.js";
import { JOBS, EXPIRY_BATCHES, PRICE_ITEMS, jobDone, jobProgress, isShopUnlocked } from './jobs/catalog.js';
import { PRODUCT_NAMES, planogramWon } from './jobs/match3.js';
import { poweredContacts, circuitConnected } from './jobs/circuit.js';
export function createUI(state, actions) {
  const root = document.createElement("div");
  document.body.append(root);
  root.innerHTML = `<div class="hud hidden" id="hud"><div class="topline"><div><div class="brand">ПЛОХОЙ ДЕНЬ МЕРЧА<small>ЕЩЁ ОДНА ОБЫЧНАЯ СМЕНА</small></div><div class="objective panel"><div class="eyebrow">РАБОЧИЙ МАРШРУТ <span id="routeCount"></span></div><h2 id="targetName"></h2><p id="targetDesc"></p><div class="progressbar"><i id="routeBar"></i></div><div class="row"><span id="cartCount"></span><span id="distance"></span></div></div></div><div class="clock"><strong id="clock">08:00</strong><p>ДО КОНЦА СМЕНЫ <span id="remaining"></span></p><div class="wanted" id="wanted">☆☆☆☆☆</div><div class="speed" id="speed"></div></div></div><div class="bottomline"><div class="bottomleft"><div class="mapbox panel"><canvas id="minimap" width="300" height="300"></canvas><div class="mapcaption"><span>СЕВЕРНЫЙ РАЙОН</span><span>↑ N</span></div></div><div class="statbox panel"><div class="eyebrow">МЕРЧЕНДАЙЗЕР · СТАЖЁР</div><div class="stat"><span>ЗДОРОВЬЕ</span><div class="meter"><i id="hpBar"></i></div><span id="hp"></span></div><div class="stat"><span>СТРЕСС</span><div class="meter stress"><i id="stressBar"></i></div><span id="stress"></span></div><div class="row" style="font-size:11px;color:#d8c28e" id="money"></div></div></div><div class="controls"><span><b>WASD</b>движение</span><span><b>E</b>действие</span><span><b>R</b>тележка</span><span><b>M</b>планшет</span><span><b>ESC</b>пауза</span></div></div></div><div class="crosshair hidden" id="crosshair"></div><div class="context hidden" id="context"><span></span></div><div class="toast" id="toast"></div><div id="overlay"></div><div class="loading" id="loading">СОБИРАЕМ ТЕЛЕЖКИ…</div>`;
  const $ = (id) => document.getElementById(id);
  const mapImage=new Image();mapImage.src=`${import.meta.env.BASE_URL}maps/city-reference.png`;
  let toastTimer,
    tab = "Маршрут", overlayEpoch = 0;
  function toast(t) {
    $("toast").textContent = t;
    $("toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("toast").classList.remove("show"), 4500);
  }
  function map(canvas, world) {
    const ctx = canvas.getContext("2d"),
      w = canvas.width;
    const h=canvas.height,mini=canvas.id==='minimap';
    const player=pixel(state.position.x,state.position.z);
    // The same affine transform positions models, markers and the navigator.
    const view=mapViewport(w,h,state.position,mini),xy=view.project;
    canvas.dataset.mapZoom=String(view.zoom);
    ctx.fillStyle='#132830';ctx.fillRect(0,0,w,h);
    if(mapImage.complete&&mapImage.naturalWidth)ctx.drawImage(mapImage,view.offsetX,view.offsetY,MAP.width*view.zoom,MAP.height*view.zoom);
    const target=xy(SHOPS[state.selected].x,SHOPS[state.selected].z),me=xy(state.position.x,state.position.z);
    ctx.setLineDash([4,5]);ctx.strokeStyle='#ffe18b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(me.x,me.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);
    for(const shop of SHOPS){
      const done=state.shops[shop.id].done,selected=shop.id===state.selected,locked=!isShopUnlocked(state,shop.id);
      if(!done&&!selected&&!locked)continue;
      const location=point(...MAP_MARKERS[shop.id]),p=xy(location.x,location.z),radius=Math.max(8,17*view.zoom);
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.strokeStyle=done?'#8be59a':locked?'#859296':'#ffe18b';ctx.lineWidth=selected?3:2;ctx.stroke();
      if(done||locked){ctx.fillStyle=done?'#235a3c':'#34454b';ctx.fill();ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(10,radius)}px Arial`;ctx.textAlign='center';ctx.fillText(done?'✓':'×',p.x,p.y+radius*.4);}
    }
    ctx.save();ctx.translate(me.x,me.y);ctx.rotate(-(world?.player.mesh.rotation.y??0)+Math.PI);ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fillStyle='#fff6c8';ctx.fill();ctx.strokeStyle='#102331';ctx.lineWidth=2;ctx.stroke();ctx.restore();
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
      state.overtime ? "СВОБОДНЫЙ РЕЖИМ" : `${Math.max(0, Math.ceil((1500 - state.time) / 60))} МИН`;
    $("routeCount").textContent = `${done} / ${SHOPS.length}`;
    $("routeBar").style.width = `${(done / SHOPS.length) * 100}%`;
    document.querySelector(".mapcaption span").textContent = BOROUGHS[districtAt(state.position.x)].name;
    $("targetName").textContent =
      `${String(s.id + 1).padStart(2, "0")} / ${s.name}`;
    $("targetDesc").textContent = p.done ? 'Визит подтверждён. Выберите следующую точку в телефоне.'
      : !isShopUnlocked(state, s.id) ? `Магазин закрыт. Подтвердите пять визитов: сейчас ${done}/5. Остальные точки доступны.`
        : jobDone(state, s.id) ? 'Работа выполнена. Найдите директора в торговом зале и подтвердите визит.'
          : s.id === 7 && p.job.scannerFound ? 'ТСД найден. Отнесите его управляющему, который обходит торговый зал.'
            : s.id === 4 && state.carrying ? 'Коробка в руках. Отнесите её в голубую приёмку внутри магазина и нажмите E.'
              : JOBS[s.id].description;
    $("cartCount").textContent = jobProgress(state, s.id);
    const goal = world?.jobs?.targetFor(s.id) ?? s;
    $("distance").textContent =
      `${Math.round(Math.hypot(goal.x - state.position.x, goal.z - state.position.z))} М`;
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
    if ($("bigmap")) {
      const canvas=$("bigmap"),rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5);
      const width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);
      if(width>0&&height>0&&(canvas.width!==width||canvas.height!==height)){canvas.width=width;canvas.height=height;}
      map(canvas, world);
      $("tabletGoal").textContent=`${s.code} · ${s.name} · ${Math.round(Math.hypot(s.x-state.position.x,s.z-state.position.z))} м`;
    }
  }
  function clear() {
    overlayEpoch++;
    $("overlay").innerHTML = "";
    $("hud").classList.remove("hidden");
    $("crosshair").classList.remove("hidden");
  }
  function show(html) {
    overlayEpoch++;
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
      `<div class="veil"><div class="intro"><div class="tag">ГОРОДСКАЯ ПЕСОЧНИЦА · ПЕРВАЯ СМЕНА</div><h1>ПЛОХОЙ ДЕНЬ<br><em>МЕРЧА.</em></h1><p class="subtitle">Девять магазинов. Один мерчендайзер.<br>Ноль причин задерживаться на работе.</p><p>Паркуйся, разгружай товар, решай полочные головоломки и договаривайся с директорами. В каждой точке своя работа. Или посмотри, насколько плохим может стать этот день.</p><div class="actions"><button class="primary" id="begin">${hasProgress ? "ПРОДОЛЖИТЬ СМЕНУ" : "ВЫЙТИ НА МАРШРУТ"} ↗</button>${hasProgress ? '<button class="secondary" id="newShift" title="Сбросить текущий маршрут и начать с 08:00">НОВАЯ СМЕНА</button>' : ""}<button class="secondary" id="how">КАК ВЫЖИТЬ?</button></div><div class="introfooter"><div><b>09</b>ТОРГОВЫХ ТОЧЕК</div><div><b>25</b>МИНУТ ДО КОНЦА ДНЯ</div><div><b>∞</b>НЕУДАЧНЫХ РЕШЕНИЙ</div></div></div><div class="buildtag">СЕВЕРНЫЙ РАЙОН / У ДОМА</div></div>`,
    );
    $("begin").onclick = actions.resume;
    $("how").onclick = () => pause(true);
    if ($("newShift")) $("newShift").onclick = confirmNewShift;
  }
  function pause(help = false) {
    show(
      `<div class="modal"><div class="window settings"><div class="eyebrow">${help ? "ПАМЯТКА МЕРЧЕНДАЙЗЕРА" : "КОФЕ-БРЕЙК"}</div><h2>${help ? "Как пережить эту смену" : "Смена на паузе"}</h2><p>WASD — ходить или вести машину; Бег по умолчанию; удерживайте Shift — ходьба / ручной тормоз; Space — прыжок / тормоз; Ctrl — присесть; C — камера. Мышь — обзор; курсор автоматически скрыт в игре и появляется в меню, телефоне и диалогах.</p><p>E — разговор, полка, кофе, сесть / выйти из машины. R — взяться за ручку / отпустить тележку; в фургоне — загрузить / выгрузить. С тележкой WASD — движение, мышь или стрелки ← → — поворот. F / ЛКМ — удар, G — сильный удар, Q — блок. M — планшет с картой; Tab — карта.</p><p>Работа каждой точки указана в телефоне: парковка, три в ряд, склад, ремонт, разгрузка, сроки, ценники и поиск ТСД. ГиперМакс открывается после пяти визитов. Директоры обходят зал — найдите их после задания. Обычные тележки в жёлтой зоне дают бонус, они не обязательны для всех магазинов. Прогресс сохраняется автоматически; телефон и диалоги ставят игру на паузу.</p><label>Чувствительность мыши<input id="sensitivity" type="range" min="0.2" max="2" step="0.1" value="${actions.settings.sensitivity}"></label><label>Громкость<input id="volume" type="range" min="0" max="1" step="0.05" value="${actions.settings.volume}"></label><label>Качество<select id="quality"><option value="low">Экономное</option><option value="high">Высокое</option></select></label><div class="actions"><button class="primary" id="resume">${help ? "ПОНЯТНО, НА МАРШРУТ" : "ПРОДОЛЖИТЬ"}</button><button class="secondary" id="finish">Завершить день</button><button class="secondary" id="quit">Бросить маршрут</button><button class="secondary" id="new">Новая смена</button></div></div></div>`,
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
      body = [...SHOPS].sort((a,b)=>state.shift.order.indexOf(a.id)-state.shift.order.indexOf(b.id)).map(
        (s) =>
          `<button class="shoprow" data-shop="${s.id}"><span class="n">${String(s.id + 1).padStart(2, "0")}</span><strong>${boroughFor(s.id).name} · ${s.code} · ${s.name} ${state.shops[s.id].done ? "✓" : state.selected === s.id ? "← ЦЕЛЬ" : ""}</strong><small>${state.shift.urgent.includes(s.id) ? "СРОЧНО +80 ₽ ДО "+Math.floor(state.shift.deadlines[s.id]/60)+" МИН · " : ""}ДОВЕРИЕ ${state.career.loyalty[s.id]} · ${JOBS[s.id].title} · ${jobProgress(state, s.id)}</small></button>`,
      ).join("");
    if (tab === "Сообщения")
      body = state.messages
        .slice()
        .reverse()
        .map((m) => `<div class="message"></div>`)
        .join("");
    if (tab === "Карта")
      body =
        '<p class="message">Карта города открыта слева. Нажмите на рабочую точку, чтобы выбрать цель.<br><br>Жёлтый — цель · стрелка — вы · зелёный — визит закрыт. Пунктир показывает направление.</p>';
    if (tab === "Показатели")
      body = `<div class="message">Репутация: ${Math.round(state.reputation)} / 100<br>Стресс: ${Math.round(state.stress)} / 100<br>Деньги: ${state.money} ₽<br>Премия: ${state.bonus} ₽<br>Конфликты: ${state.conflicts}<br>Штрафы: ${state.fines} ₽<br>Закрыто: ${state.shops.filter((s) => s.done).length} / ${SHOPS.length}<br>Осталось: ${Math.max(0,Math.ceil((1500 - state.time) / 60))} мин</div><div class="actions"><button id="energy" class="secondary">Энергетик · 70 ₽</button><button id="boots" class="secondary">Обувь для бега · 150 ₽ премии</button><button id="gloves" class="secondary">Перчатки для груза · 120 ₽ премии</button><button id="dimaDeal" class="secondary">Дима: договориться о сроках · 40 ₽</button></div>`;
    if (tab === "Фото")
      body = `<p class="message">Необязательный фотоотчёт: встаньте рядом с магазином. Фото сохраняет текущий вид камеры; задания у каждой точки свои.</p><button class="primary" id="takePhoto">СДЕЛАТЬ ФОТО</button><div id="photoResult"></div>`;
    show(
      `<div class="modal tablet-modal"><div class="phone tablet" role="dialog" aria-modal="true" aria-label="Рабочий планшет"><div class="phonebar tabletbar"><span>МЕРЧПЛАНШЕТ · ГОРОДСКОЙ МАРШРУТ</span><button class="close" id="close" aria-label="Закрыть планшет">×</button></div><div class="tablet-layout"><section class="tablet-map" aria-label="Карта города"><div class="tablet-mapbar"><span>ТРИ РАЙОНА · ДЕВЯТЬ ВИЗИТОВ</span><strong id="tabletGoal"></strong></div><div class="tablet-mapstage"><canvas id="bigmap" width="1672" height="941" aria-label="Карта районов и положение игрока"></canvas></div><div class="tablet-mapfooter"><span>↑ СЕВЕР · НАЖМИТЕ НА МАГАЗИН, ЧТОБЫ ВЫБРАТЬ ЦЕЛЬ</span><span>M / ESC — ЗАКРЫТЬ</span></div></section><aside class="tablet-sidebar"><h2>Рабочий день</h2><nav class="tabs" aria-label="Меню планшета">${tabs.map((t) => `<button data-tab="${t}" class="${t === tab ? "active" : ""}" aria-pressed="${t === tab}">${t}</button>`).join("")}</nav><div id="phoneBody" tabindex="0">${body}</div></aside></div></div></div>`,
    );
    $("bigmap").onclick=(event)=>{
      const canvas=$("bigmap"),rect=canvas.getBoundingClientRect();
      const p=mapViewport(canvas.width,canvas.height,state.position).unproject((event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height);
      const nearest=SHOPS.map(shop=>({shop,d:Math.min(Math.hypot(pixel(shop.x,shop.z).x-p.u,pixel(shop.x,shop.z).y-p.v),Math.hypot(MAP_MARKERS[shop.id][0]-p.u,MAP_MARKERS[shop.id][1]-p.v))})).sort((a,b)=>a.d-b.d)[0];
      if(nearest?.d<45){state.selected=nearest.shop.id;phone(tab);}
    };
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
        .querySelectorAll("#phoneBody .message")
        .forEach(
          (el, i) =>
            (el.textContent = state.messages[state.messages.length - 1 - i]),
        );
    if ($("takePhoto")) $("takePhoto").onclick = actions.photo;
    if ($("boots")) $("boots").onclick=()=>{actions.equipment("boots");};
    if ($("gloves")) $("gloves").onclick=()=>{actions.equipment("gloves");};
    if ($("dimaDeal")) $("dimaDeal").onclick=actions.dima;
    if ($("energy")) $("energy").onclick = actions.energy;
  }
  function dialogue(shop) {
    const p = state.shops[shop.id];
    show(
      `<div class="modal"><div class="window"><button class="close" id="close">×</button><div class="eyebrow">${shop.name.toUpperCase()} · ОТНОШЕНИЕ ${p.rep}</div><h2>${shop.npc}</h2><p id="speech"></p><div class="dialogueoptions"><button data-choice="polite">Я по рабочему маршруту. Подтвердите визит, пожалуйста.</button><button data-choice="badge">Показать бейдж и пообещать всё сделать.</button><button data-choice="job">Напомните, что нужно сделать и где искать.</button><button data-choice="rude">У меня девять точек! Давайте быстрее.</button></div></div></div>`,
    );
    $("speech").textContent = p.done
      ? "Спасибо, визит уже закрыт. Удачной смены!"
      : !isShopUnlocked(state, shop.id) ? "Мы ещё закрыты. Возвращайтесь после пяти подтверждённых визитов." : jobDone(state, shop.id) ? "Всё сделано? Отлично, можно подтверждать визит." : shop.description;
    $("close").onclick = actions.resume;
    document
      .querySelectorAll("[data-choice]")
      .forEach((b) => (b.onclick = () => actions.talk(shop, b.dataset.choice)));
  }
  function jobWindow(shop, body) {
    show(`<div class="modal"><div class="window job-window"><button class="close" id="close">×</button><div class="eyebrow">${shop.name} · ${JOBS[shop.id].title}</div><div id="jobContent">${body}</div></div></div>`);
    $('close').onclick = actions.resume;
    return overlayEpoch;
  }
  function parking(shop, car) {
    const paid = state.shops[shop.id].job.paid;
    jobWindow(shop, `<h2>Парковочный терминал</h2><div class="parking-ticket"><span>${paid ? 'ЧЕК · ОПЛАЧЕНО' : 'ТАРИФ НА СМЕНУ'}</span><strong>40 ₽</strong><p>${paid ? 'Парковка оплачена. Чек сохранён в маршруте.' : car ? `${car.displayName} стоит в голубом месте.` : 'Найдите свободное голубое место перед магазином. Машина должна полностью помещаться в разметке и стоять неподвижно.'}</p></div><p>После оплаты найдите Нину в зале и подтвердите визит.</p><button class="primary" id="payParking" ${paid || !car || state.money < 40 ? 'disabled' : ''}>${paid ? 'ПАРКОВКА ОПЛАЧЕНА' : 'ОПЛАТИТЬ 40 ₽'}</button>${!paid && state.money < 40 ? '<p>Не хватает денег. Выполните бесплатное задание в другой точке или верните обычные тележки за бонус.</p>' : ''}`);
    $('payParking').onclick = () => actions.payParking(shop);
  }
  function planogram(shop) {
    const epoch = jobWindow(shop, '');
    let selected = null, busy = false, hint = 'Поменяйте местами соседние товары: нужен ряд из трёх или больше.';
    const alive = () => overlayEpoch === epoch && !!$('jobContent');
    function draw(board = state.shops[shop.id].job.match.board, cleared = [], settling = false) {
      if (!alive()) return;
      const game = state.shops[shop.id].job.match, won = planogramWon(game);
      $('jobContent').innerHTML = `<h2>Планограмма: три в ряд</h2><p>Соберите по 6 упаковок чая, сока и крупы. Длинные ряды и каскады дают больше товаров.</p><div class="match-goals">${[0, 1, 2].map((n) => `<div class="goal ${game.collected[n] >= 6 ? 'done' : ''}"><b>${PRODUCT_NAMES[n]}</b><strong>${Math.min(6, game.collected[n])}/6</strong></div>`).join('')}<div class="goal"><b>ХОДЫ</b><strong id="matchMoves">${game.moves}</strong></div></div><div class="match-grid" id="matchGrid" role="grid" aria-label="Полка с товарами" data-busy="${busy}">${board.map((product, index) => `<button class="match-tile product-${product} ${selected === index ? 'selected' : ''} ${cleared.includes(index) ? 'popping' : ''} ${settling ? 'settling' : ''}" data-cell="${index}" data-product="${product}" aria-label="${PRODUCT_NAMES[product]}, ряд ${Math.floor(index / 6) + 1}, место ${index % 6 + 1}" aria-pressed="${selected === index}" ${busy || won || game.moves === 0 ? 'disabled' : ''}><span class="product-pack"><b>${['Ч', 'С', 'К', 'В', 'КФ'][product]}</b></span><small>${PRODUCT_NAMES[product]}</small></button>`).join('')}</div><p class="job-hint ${won ? 'success' : ''}" id="matchHint" role="status">${won ? 'Планограмма выполнена! Можно отчитаться директору.' : game.moves === 0 ? 'Ходы закончились. Новая попытка не стоит денег; другие задания сохранятся.' : hint}</p><div class="job-actions"><span>ОЧКИ ${game.score}</span>${won ? '<button class="primary" id="matchFinish">ГОТОВО · К ДИРЕКТОРУ</button>' : `<button class="secondary" id="matchRestart" ${busy ? 'disabled' : ''}>Новая попытка · 18 ходов</button>`}</div>`;
      document.querySelectorAll('[data-cell]').forEach((button) => {
        button.onclick = async () => {
          if (busy) return;
          const index = +button.dataset.cell;
          if (selected === null || selected === index) { selected = selected === index ? null : index; draw(); return; }
          const from = selected; selected = null;
          const before = [...state.shops[shop.id].job.match.board];
          const result = actions.planogramSwap(shop, from, index);
          if (!result.valid) { hint = result.reason; draw(); return; }
          busy = true; draw(before);
          const a = document.querySelector(`[data-cell="${from}"]`), b = document.querySelector(`[data-cell="${index}"]`);
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          a.animate?.([{ transform: 'translate(0,0)' }, { transform: `translate(${rb.x - ra.x}px,${rb.y - ra.y}px)` }], { duration: 170, fill: 'forwards' });
          b.animate?.([{ transform: 'translate(0,0)' }, { transform: `translate(${ra.x - rb.x}px,${ra.y - rb.y}px)` }], { duration: 170, fill: 'forwards' });
          await new Promise((r) => setTimeout(r, 180));
          for (const event of result.events) {
            if (!alive()) return;
            draw(event.before, event.cleared);
            await new Promise((r) => setTimeout(r, 190));
            if (!alive()) return;
            draw(event.after, [], true);
            await new Promise((r) => setTimeout(r, 130));
          }
          if (!alive()) return;
          busy = false;
          hint = result.shuffled ? 'Ходов не осталось на поле — товары перемешаны, ваш прогресс сохранён.' : result.events.length > 1 ? `Каскад ×${result.events.length}! Продолжайте выкладку.` : 'Хороший ряд! Соберите оставшиеся товары.';
          draw();
        };
        button.onkeydown = (event) => {
          const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -6, ArrowDown: 6 }[event.key];
          if (!offset) return;
          event.preventDefault(); document.querySelector(`[data-cell="${Math.max(0, Math.min(35, +button.dataset.cell + offset))}"]`)?.focus();
        };
      });
      if ($('matchFinish')) $('matchFinish').onclick = actions.resume;
      if ($('matchRestart')) $('matchRestart').onclick = () => { actions.resetPlanogram(shop); selected = null; hint = 'Новая расстановка. Найдите выгодный обмен.'; draw(); };
    }
    draw();
  }
  function repair(shop) {
    jobWindow(shop, '');
    function draw() {
      const job = state.shops[shop.id].job, powered = poweredContacts(job.circuit), connected = circuitConnected(job.circuit);
      $('jobContent').innerHTML = `<h2>Погасла подсветка</h2><p>Поворачивайте секции, чтобы соединить питание слева с лампой справа. Подключённые участки подсвечиваются.</p><div class="circuit-labels"><span>ПИТАНИЕ →</span><span>→ ЛАМПА ${connected ? '●' : '○'}</span></div><div class="circuit-grid" role="grid">${job.circuit.map((mask, index) => `<button class="circuit-tile ${powered.includes(index) ? 'powered' : ''}" data-circuit="${index}" data-mask="${mask}" aria-label="Повернуть секцию ${index + 1}"><svg viewBox="0 0 80 80" aria-hidden="true"><path d="${[[1, 'M40 40V0'], [2, 'M40 40H80'], [4, 'M40 40V80'], [8, 'M40 40H0']].filter(([bit]) => mask & bit).map(([, path]) => path).join(' ')}"/><circle cx="40" cy="40" r="8"/></svg></button>`).join('')}</div><p class="job-hint ${connected ? 'success' : ''}" role="status">${connected ? 'Цепь собрана. Установите секцию и включите лампу.' : 'Ищите непрерывный путь. Повороты и собранная схема сохраняются.'}</p><button class="primary" id="repairApply" ${connected ? '' : 'disabled'}>УСТАНОВИТЬ И ВКЛЮЧИТЬ</button>`;
      document.querySelectorAll('[data-circuit]').forEach((button) => button.onclick = () => { actions.rotateCircuit(shop, +button.dataset.circuit); draw(); });
      $('repairApply').onclick = () => actions.applyRepair(shop);
    }
    draw();
  }
  function expiry(shop) {
    jobWindow(shop, '');
    function draw() {
      const removed = state.shops[shop.id].job.removed;
      $('jobContent').innerHTML = `<h2>Проверка партий</h2><p>Сегодня <b>27 октября</b>. Снимите только товары с истёкшим сроком. Правильные партии оставьте на полке.</p><div class="audit-grid">${EXPIRY_BATCHES.map((batch, i) => `<div class="audit-card ${removed.includes(i) ? 'done' : ''}"><h3>${batch.name}</h3><span class="batch-date">ГОДЕН ДО <b>${batch.date}</b></span><small>Партия ${String(410 + i)}</small><button class="secondary" data-expiry="${i}" ${removed.includes(i) ? 'disabled' : ''}>${removed.includes(i) ? 'СНЯТО · В КАРАНТИН' : 'Снять с полки'}</button></div>`).join('')}</div><p class="job-hint" role="status">Снято ${removed.length}/3. Сроки и карантин сохраняются при закрытии.</p>${jobDone(state, shop.id) ? '<button class="primary" id="auditFinish">ГОТОВО · К ДИРЕКТОРУ</button>' : ''}`;
      document.querySelectorAll('[data-expiry]').forEach((button) => button.onclick = () => { actions.removeExpired(shop, +button.dataset.expiry); draw(); });
      if ($('auditFinish')) $('auditFinish').onclick = actions.resume;
    }
    draw();
  }
  function prices(shop) {
    jobWindow(shop, '');
    function draw() {
      const labels = state.shops[shop.id].job.labels;
      $('jobContent').innerHTML = `<h2>Накладная и ценники</h2><p>Цена на прилавке не совпадает с накладной. Выберите правильную новую этикетку для каждого товара.</p><div class="price-audit">${PRICE_ITEMS.map((item, index) => `<section class="price-row ${labels[index] === item.price ? 'done' : ''}"><div><h3>${item.name}</h3><span>ПО НАКЛАДНОЙ <b>${item.price} ₽/кг</b></span><small>На полке: ${labels[index] ?? item.old} ₽/кг</small></div><div class="price-options">${item.options.map((price) => `<button data-price="${index}" data-value="${price}" ${labels[index] === item.price ? 'disabled' : ''}>${price} ₽</button>`).join('')}</div>${labels[index] === item.price ? '<small>✓ НОВЫЙ ЦЕННИК УСТАНОВЛЕН</small>' : ''}</section>`).join('')}</div><p class="job-hint" role="status">${jobProgress(state, shop.id)}</p>${jobDone(state, shop.id) ? '<button class="primary" id="pricesFinish">ГОТОВО · К ДИРЕКТОРУ</button>' : ''}`;
      document.querySelectorAll('[data-price]').forEach((button) => button.onclick = () => { actions.replacePrice(shop, +button.dataset.price, +button.dataset.value); draw(); });
      if ($('pricesFinish')) $('pricesFinish').onclick = actions.resume;
    }
    draw();
  }
  function shelf(shop) { planogram(shop); }
  function ending() {
    show(
      `<div class="modal"><div class="window"><div class="eyebrow">СМЕНА ОКОНЧЕНА · ВЫ ЭТО ПЕРЕЖИЛИ</div><h2>${state.ending}</h2><p>Точек закрыто: ${state.shops.filter((s) => s.done).length} / ${SHOPS.length}<br>Тележек собрано: ${state.shops.reduce((n, s) => n + s.carts, 0)}<br>Репутация: ${Math.round(state.reputation)} · Стресс: ${Math.round(state.stress)}<br>Конфликтов: ${state.conflicts} · Штрафов: ${state.fines} ₽<br>Время в пути: ${Math.floor(state.time / 60)} мин ${Math.floor(state.time % 60)} сек</p><h2>Премия: ${Math.max(0, state.bonus - state.conflicts * 50)} ₽</h2><p>Региональный: «Спасибо за отчёт. Завтра тот же маршрут».</p><div class="actions"><button class="primary" id="freeRoam">ПРОДОЛЖИТЬ ГУЛЯТЬ ПО ГОРОДУ</button><button class="secondary" id="restart">НАЧАТЬ СНАЧАЛА ↗</button></div></div></div>`,
    );
    $("restart").onclick = actions.restart;
    $("freeRoam").onclick = actions.freeRoam;
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
    parking,
    planogram,
    repair,
    expiry,
    prices,
    ending,
    context(t) {
      $("context").classList.toggle("hidden", !t);
      $("context").firstElementChild.textContent = t;
    },
  };
}
