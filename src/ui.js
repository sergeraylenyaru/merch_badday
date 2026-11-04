import {createSchematicMap} from './city/map-schematic.js';
import {purchaseCards,playerFigures} from './ui/purchase-cards.js';
import {SUPPLIES} from './city/purchases.js';
import {equipmentIcon} from './ui/equipment-icons.js';
import {wantedFeedback} from './city/gameplay.js';
import {SIDE_JOBS} from './jobs/side-work.js';
import {mapViewport} from './city/map-view.js';
import {MAP,pixel,districtAt,WORK_STOPS,MAP_MARKERS,point,PARK_BRIDGES} from './city/reference-layout.js';
import { BOROUGHS, boroughFor, LOCAL_SHOPS } from './city/layout.js';
import { SHOPS,selectShop } from "./state.js";
import { JOBS, EXPIRY_BATCHES, PRICE_ITEMS, jobDone, jobProgress, isShopUnlocked } from './jobs/catalog.js';
import { PRODUCT_NAMES, planogramWon } from './jobs/match3.js';
import {PACKS,WEAPONS,EVENT_INFO} from './adventure/state.js';
import { poweredContacts, circuitConnected } from './jobs/circuit.js';
export function createUI(state, actions) {
  const root = document.createElement("div");
  document.body.append(root);
  root.innerHTML = `<div class="hud hidden" id="hud"><div class="topline"><div><div class="brand">ПЛОХОЙ ДЕНЬ МЕРЧА<small>ЕЩЁ ОДНА ОБЫЧНАЯ СМЕНА</small></div><div class="objective panel"><div class="eyebrow">РАБОЧИЙ МАРШРУТ <span id="routeCount"></span></div><h2 id="targetName"></h2><p id="targetDesc"></p><div class="progressbar"><i id="routeBar"></i></div><div class="row"><span id="cartCount"></span><span id="distance"></span></div></div></div><div class="clock"><strong id="clock">08:00</strong><p>ДО КОНЦА СМЕНЫ <span id="remaining"></span></p><div class="wanted" id="wanted">☆☆☆☆☆</div><div class="speed" id="speed"></div></div></div><div class="bottomline"><div class="bottomleft"><div class="mapbox panel"><canvas id="minimap" width="300" height="300"></canvas><div class="mapcaption"><span>СЕВЕРНЫЙ РАЙОН</span><span>↑ N</span></div></div><div class="statbox panel"><div class="eyebrow">МЕРЧЕНДАЙЗЕР · СТАЖЁР</div><div class="stat"><span>ЗДОРОВЬЕ</span><div class="meter"><i id="hpBar"></i></div><span id="hp"></span></div><div class="stat"><span>СТРЕСС</span><div class="meter stress"><i id="stressBar"></i></div><span id="stress"></span></div><div class="row" style="font-size:11px;color:#d8c28e" id="money"></div></div></div><div class="controls"><span><b>WASD</b>движение</span><span><b>E</b>действие</span><span><b>R</b>тележка</span><span><b>M</b>планшет</span><span><b>ESC</b>пауза</span></div></div></div><aside class="message-chat panel" aria-label="Последние сообщения"><small>СООБЩЕНИЯ</small><ol id="chatLines"></ol></aside><div class="crosshair hidden" id="crosshair"></div><div class="context hidden" id="context"><span></span></div><div class="toast" id="toast"></div><div id="overlay"></div><div class="loading" id="loading">СОБИРАЕМ ТЕЛЕЖКИ…</div>`;
  const $ = (id) => document.getElementById(id);
  $('wanted').innerHTML=Array.from({length:5},()=>'<span class="wanted-star">☆</span>').join('');
  root.querySelector('#hud').append(root.querySelector('.message-chat'));
  const stats=root.querySelector('.statbox');stats.classList.add('player-status');
  stats.insertAdjacentHTML('afterbegin','<div class="hand-status"><span>СЕЙЧАС В РУКАХ</span><div class="held-item"><i id="handIcon"></i><strong id="handItem">Кулаки</strong></div><small class="weapon-keys">1 Кулаки · 2 Бита · 3 Палка · 4 Вода · 5 Камни · 6 Рогатка · 7 Дубинка</small></div>');
  root.querySelector('.clock').append(stats);
  const mapImage=new Image();mapImage.src=`${import.meta.env.BASE_URL}maps/city-reference.png`;
  const schematicMap=createSchematicMap();
  let toastTimer,
    tab = "Карта", overlayEpoch = 0, currentWorld=null;
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
    const schematic=state.mapMode==='schematic';canvas.dataset.mapMode=schematic?'schematic':'satellite';if(schematic)ctx.drawImage(schematicMap,view.offsetX,view.offsetY,MAP.width*view.zoom,MAP.height*view.zoom);else if(mapImage.complete&&mapImage.naturalWidth)ctx.drawImage(mapImage,view.offsetX,view.offsetY,MAP.width*view.zoom,MAP.height*view.zoom);
    for(const b of PARK_BRIDGES){const a=xy(b.x-Math.cos(b.angle)*(b.length/2+4),b.z-Math.sin(b.angle)*(b.length/2+4)),c=xy(b.x+Math.cos(b.angle)*(b.length/2+4),b.z+Math.sin(b.angle)*(b.length/2+4));ctx.strokeStyle='#e4d0a4';ctx.lineWidth=Math.max(2,b.width/MAP.scale*view.zoom);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(c.x,c.y);ctx.stroke();}
    for(const ride of world?.park?.diagnostics.rides??[]){const p=xy(point(ride.u,ride.v).x,point(ride.u,ride.v).z);ctx.fillStyle='#d86353';ctx.beginPath();ctx.arc(p.x,p.y,mini?3:5,0,Math.PI*2);ctx.fill();}
    const destination=world?.vendors?.target()??world?.sideWork?.target()??world?.adventure?.target()??world?.homeTarget?.()??(state.awaitingShopChoice?null:SHOPS[state.selected]);
    const me=xy(state.position.x,state.position.z);if(destination){const target=xy(destination.x,destination.z);
    ctx.setLineDash([4,5]);ctx.strokeStyle='#ffe18b';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(me.x,me.y);ctx.lineTo(target.x,target.y);ctx.stroke();ctx.setLineDash([]);}
    for(const shop of SHOPS){
      const done=state.shops[shop.id].done,selected=shop.id===state.selected,locked=!isShopUnlocked(state,shop.id);
      if(!schematic&&!done&&!selected&&!locked)continue;
      const location=schematic?shop:point(...MAP_MARKERS[shop.id]),p=xy(location.x,location.z),radius=Math.max(8,17*view.zoom);
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);ctx.strokeStyle=done?'#8be59a':locked?'#859296':'#ffe18b';ctx.lineWidth=selected?3:2;ctx.stroke();
      if(schematic){ctx.fillStyle=done?'#447c5c':locked?'#7e8a8a':selected?'#d5a43c':'#456d85';ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='center';ctx.font=`bold ${Math.max(9,radius*.8)}px Arial`;ctx.fillText(done?'✓':locked?'×':shop.code,p.x,p.y+3);}
      else if(done||locked){ctx.fillStyle=done?'#235a3c':'#34454b';ctx.fill();ctx.fillStyle='#fff';ctx.font=`bold ${Math.max(10,radius)}px Arial`;ctx.textAlign='center';ctx.fillText(done?'✓':'×',p.x,p.y+radius*.4);}
    }
    for(const seller of world?.vendors?.markers()??[]){if(mini&&Math.hypot(seller.x-state.position.x,seller.z-state.position.z)>65)continue;const p=xy(seller.x,seller.z);ctx.beginPath();ctx.arc(p.x,p.y,mini?6:8,0,Math.PI*2);ctx.fillStyle='#497ca0';ctx.fill();ctx.fillStyle='#fff';ctx.font='bold 9px Arial';ctx.textAlign='center';ctx.fillText(seller.id==='dima'?'Д':seller.id==='garage'?'А':'Л',p.x,p.y+3);}
    for(const guard of world?.adventure?.diagnostics.guards??[]){
      if(mini&&Math.hypot(guard.x-state.position.x,guard.z-state.position.z)>55)continue;
      const p=xy(guard.x,guard.z);ctx.fillStyle='#f8d856';ctx.beginPath();ctx.arc(p.x,p.y,mini?5:7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#22333b';ctx.font='bold 10px Arial';ctx.textAlign='center';ctx.fillText('О',p.x,p.y+3.5);
    }
    if(world?.hospital){const p=xy(world.hospital.spawn.x,world.hospital.spawn.z);ctx.fillStyle='#f1e8cc';ctx.beginPath();ctx.arc(p.x,p.y,mini?7:10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#c94b40';ctx.font='bold 18px Arial';ctx.textAlign='center';ctx.fillText('+',p.x,p.y+6);}
    ctx.save();ctx.translate(me.x,me.y);ctx.rotate(-(world?.player.mesh.rotation.y??0)+Math.PI);ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,6);ctx.lineTo(0,3);ctx.lineTo(-6,6);ctx.closePath();ctx.fillStyle='#fff6c8';ctx.fill();ctx.strokeStyle='#102331';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  function update(world, vehicle) {
    currentWorld=world;
    const equipped=state.adventure.equipped==='slingshot'?`Рогатка · ${state.adventure.apples}/30`:state.adventure.equipped==='stone'?`Камни · ${state.adventure.stones}/5`:WEAPONS[state.adventure.equipped]?.name??'Кулаки';
    $("handItem").textContent=vehicle?'За рулём':world?.carts.some(c=>c.gripped)?'Тележка':state.carrying||world?.sideWork?.carrying||state.adventure.events.delivery.carrying?'Груз':equipped;
    const icon=state.adventure.equipped??'fists';if($('handIcon').dataset.icon!==icon){$('handIcon').dataset.icon=icon;$('handIcon').innerHTML=equipmentIcon(icon);}
    $('crosshair').classList.toggle('slingshot',state.adventure.equipped==='slingshot'&&!vehicle);
    const chat=state.messages.slice(-5),signature=JSON.stringify(chat);if($('chatLines').dataset.messages!==signature){$('chatLines').dataset.messages=signature;$('chatLines').replaceChildren(...chat.map(text=>{const li=document.createElement('li');li.textContent=text;li.title=text;return li;}));}
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
    $("targetDesc").textContent = p.done ? 'Визит подтверждён. Выберите следующий магазин в планшете.'
      : !isShopUnlocked(state, s.id) ? `Магазин закрыт. Подтвердите пять визитов: сейчас ${done}/5. Остальные точки доступны.`
        : jobDone(state, s.id) ? 'Работа выполнена. Найдите директора в торговом зале и подтвердите визит.'
          : s.id === 7 && p.job.scannerFound ? 'ТСД найден. Отнесите его управляющему, который обходит торговый зал.'
            : s.id === 4 && state.carrying ? 'Коробка в руках. Отнесите её в голубую приёмку внутри магазина и нажмите E.'
              : s.id===0 ? !p.job.paid ? 'Возьмите свою машину у дома и припаркуйтесь в голубом месте у первого магазина. Паркомат — рядом с разметкой.' : !p.job.assigned ? 'Парковка оплачена. Зайдите к Нине в зал и получите следующее задание.' : 'Восстановите выкладку чая, сока и крупы: подойдите к каждой отмеченной секции в зале и нажмите E. Затем найдите Нину.' : JOBS[s.id].description;
    $("cartCount").textContent = jobProgress(state, s.id);
    const goal = world?.vendors?.target()??world?.sideWork?.target()??world?.adventure?.target()??world?.homeTarget?.()??world?.jobs?.targetFor(s.id) ?? s;
    if(world?.vendors?.target()||world?.sideWork?.target()||world?.adventure?.target()||world?.homeTarget?.()){$('targetName').textContent=goal.label;$('targetDesc').textContent='Подойдите к подсвеченной зоне · E — действие.';}
    $("distance").textContent =
      `${Math.round(Math.hypot(goal.x - state.position.x, goal.z - state.position.z))} М`;
    $("hp").textContent = Math.round(state.health);
    $("stress").textContent = Math.round(state.stress);
    $("hpBar").style.width = `${state.health}%`;
    $("stressBar").style.width = `${state.stress}%`;
    $("money").textContent =
      `${Math.round(state.money)} ₽   ·   Репутация ${Math.round(state.reputation)}`;
    for(const [i,star]of [...$('wanted').children].entries()){const filled=i<Math.ceil(state.wanted);star.textContent=filled?'★':'☆';star.classList.toggle('filled',filled);star.classList.toggle('decaying',filled&&i===Math.ceil(state.wanted)-1);}
    const feedback=wantedFeedback(state);$('wanted').dataset.pulse=feedback.pulse;$('wanted').classList.toggle('parkour-bonus',feedback.parkour);
    if(state.awaitingShopChoice&&!world?.vendors?.target()&&!world?.sideWork?.target()&&!world?.adventure?.target()){$('targetName').textContent='Выберите следующий магазин';$('targetDesc').textContent='Откройте планшет M и выберите задание справа.';$('distance').textContent='—';$('cartCount').textContent='Визит подтверждён';}
    $("speed").textContent = vehicle
      ? `${Math.round(Math.abs(vehicle.speed) * 3.6)} км/ч`
      : "";
    map($("minimap"), world);
    if ($("bigmap")) {
      const canvas=$("bigmap"),rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5);
      const width=Math.round(rect.width*ratio),height=Math.round(rect.height*ratio);
      if(width>0&&height>0&&(canvas.width!==width||canvas.height!==height)){canvas.width=width;canvas.height=height;}
      map(canvas, world);
      $("tabletGoal").textContent=state.awaitingShopChoice&&!world?.vendors?.target()?"Выбери следующий магазин":`${goal.label??s.code+' · '+s.name} · ${Math.round(Math.hypot(goal.x-state.position.x,goal.z-state.position.z))} м`;
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
      `<div class="veil"><div class="intro"><div class="tag">ГОРОДСКАЯ ПЕСОЧНИЦА · ОТКРЫТАЯ БЕТА</div><h1>ПЛОХОЙ ДЕНЬ<br><em>МЕРЧА.</em></h1><p class="subtitle">Девять магазинов. Один мерчендайзер.<br>Ноль причин задерживаться на работе.</p><p>Начни утро у дома, ответь на звонок и отправляйся к первому магазину. Паркуйся, помогай сотрудникам и договаривайся с директорами. В каждой точке своя работа. Или посмотри, насколько плохим может стать этот день.</p><div class="actions"><button class="primary" id="begin">${hasProgress ? "ПРОДОЛЖИТЬ СМЕНУ" : "ВЫЙТИ НА МАРШРУТ"} ↗</button>${hasProgress ? '<button class="secondary" id="newShift" title="Сбросить текущий маршрут и начать с 08:00">НОВАЯ СМЕНА</button>' : ""}<button class="secondary" id="how">КАК ВЫЖИТЬ?</button></div><div class="introfooter"><div><b>09</b>ТОРГОВЫХ ТОЧЕК</div><div><b>25</b>МИНУТ ДО КОНЦА ДНЯ</div><div><b>∞</b>НЕУДАЧНЫХ РЕШЕНИЙ</div></div></div><div class="buildtag">ОТКРЫТАЯ БЕТА / УТРО У ДОМА</div></div>`,
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
    tab = which==='Показатели'?'Снаряжение':which;
    const tabs = ["Маршрут", "Город", "Коллекция", "Снаряжение", "Подработка", "Гараж", "Сообщения", "Фото"];
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
    if (tab === "Фото")
      body = `<p class="message">Необязательный фотоотчёт: встаньте рядом с магазином. Фото сохраняет текущий вид камеры; задания у каждой точки свои.</p><button class="primary" id="takePhoto">СДЕЛАТЬ ФОТО</button><div id="photoResult"></div>`;
    const a=state.adventure;
    if(tab==='Маршрут')body=`<button class="message collection-summary" data-open-collection>Пачки: ${a.cigarettes.length}/${PACKS.length} · посмотреть цвета</button>`+body;
    if(tab==='Коллекция')body=`<h3>Разноцветные пачки · <span id="collectionCount">${a.cigarettes.length}/${PACKS.length}</span></h3><p>Десять цветов спрятаны в городе, ещё десять — на разных крышах. E — подобрать. Первая коллекция даёт 300 ₽, коллекция крыш — 400 ₽.</p><div class="collection-grid">${PACKS.map(p=>`<div class="collection-card ${a.cigarettes.includes(p.id)?'collected':''}" data-pack="${p.id}" style="--pack-color:${p.color}"><i></i><strong>${p.name}${p.rooftop?' · крыша':''}</strong><span>${a.cigarettes.includes(p.id)?'✓ Собрана':'Не найдена'}</span></div>`).join('')}</div>`;
    if(tab==='Подработка'){const w=state.sideWork,a=w?.active;body=`<p>Доски заказов находятся в подсобках магазинов, в глубине зала слева. Подойдите к доске и нажмите E.</p><p>Доставка продуктов — 160 ₽; срочный заказ — 180 ₽ и 100 ₽ за три минуты; возврат тары — 170 ₽. Груз нужно отвезти на машине.</p>${a?`<div class="message"><strong>${SIDE_JOBS[a.type].title}</strong><p>${a.address.label} · ${a.phase==='collect'?'Забрать тару':a.phase==='return'?'Вернуть тару в подсобку':'Передать заказ у подъезда'}${a.type==='express'?` · до доплаты ${Math.max(0,Math.ceil(a.due-state.time))} с`:''}</p><button data-side-work="cancel">Отменить подработку</button></div>`:''}<p>Выполнено: ${w?.completed.length??0} · заработано: ${w?.earned??0} ₽</p>`+(currentWorld?.sideWork?.diagnostics.boards??[]).map(b=>({...b,d:Math.round(Math.hypot(b.x-state.position.x,b.z-state.position.z))})).sort((a,b)=>a.d-b.d).map(b=>`<button class="shoprow" data-side-work="${b.shop}">Подсобка «${SHOPS[b.shop].name}» · ${b.d} м · показать</button>`).join('');}
    if(tab==='Снаряжение')body=`<p>1 — кулаки · 2 — бита · 3 — палка · 4 — вода · 5 — камни · 6 — рогатка · 7 — дубинка. F / ЛКМ — использовать.</p><div class="equipment-grid"><button data-extra="equip" data-value="fists">${equipmentIcon('fists')}<strong>Кулаки</strong><small>${a.equipped===null?'✓ В руках':'1'}</small></button>${Object.entries(WEAPONS).map(([id,w])=>`<button data-extra="equip" data-value="${id}" ${!a.inventory.includes(id)?'disabled':''}>${equipmentIcon(id)}<strong>${w.name}</strong><small>${a.equipped===id?'✓ В руках · ':''}${id==='slingshot'?`${a.apples}/30 яблок`:id==='stone'?`${a.stones}/5`:a.inventory.includes(id)?'Подобрано':'Найдите в городе'}</small></button>`).join('')}</div>`;
    if(tab==='Снаряжение')body=playerFigures(state)+'<h3>Покупки и улучшения</h3><p>Выбери товар — на карте появится продавец. Покупка оплачивается при встрече.</p>'+purchaseCards(state,['energy','boots','gloves','dima'])+'<h3>Оружие</h3>'+body;
    if(tab==='Город')body=Object.entries(EVENT_INFO).map(([id,info])=>{const e=a.events[id];return `<div class="message"><h3>${info.title}</h3><p>${info.text}</p><strong>${({offered:'Можно принять',active:'Выполняется',done:'✓ Выполнено',declined:'Вы отказались',kept:'Деньги оставлены'})[e.status]}</strong>${id==='spill'&&e.status==='active'?`<p>Коробки ${e.boxes.length}/3</p>`:''}${id==='delivery'&&e.status==='active'?`<p>Груз ${e.integrity}% · до срока ${Math.max(0,Math.ceil(e.due-state.time))} с</p>`:''}<div class="actions">${e.status==='offered'?`<button data-extra="start" data-value="${id}">Принять</button><button data-extra="decline" data-value="${id}">Отказаться</button>`:''}${e.status==='active'?`<button data-extra="track" data-value="${id}">Показать цель</button>`:''}${id==='favor'&&e.status==='active'&&e.found?'<button data-extra="keep">Оставить 80 ₽ себе · −5 репутации</button>':''}</div></div>`;}).join('')+`<div class="message"><h3>Отдых во дворе</h3><p>Мяч в парке: три гола — 30 ₽ и −12 стресса. Найдите столик и сыграйте в пары: 20 ₽ и −10 стресса.</p><button data-extra="track" data-value="football">Показать ворота</button></div><div class="message"><h3>Знакомства</h3><p>${state.career.contacts.includes('seller')?'Продавец помнит помощь: кофе у «У дома» 20 ₽.':'Верните кошелёк продавцу, чтобы заслужить доверие.'}</p><button data-extra="guard">Найти ближайшего охранника</button></div>`;
    if(tab==='Город')body+='<div class="message"><h3>Лестницы и крыши</h3><p>У лестницы нажмите Space + E, затем W / S — вверх / вниз. E — отпустить. Выше 6,3 м от земли доступен один двойной прыжок. Красное яблоко на яблоне можно сбить ударом и подобрать: +30 HP, стресс −50.</p><button data-extra="track" data-value="ladder">Показать ближайшую лестницу</button><button data-extra="track" data-value="hospital">Показать больницу</button><button data-extra="track" data-value="billboard">Найти рекламный щит</button><button data-extra="track" data-value="scaffold">Найти строительные леса</button><button data-extra="track" data-value="weapon:slingshot">Рогатка у колеса обозрения</button></div>';
    if(tab==='Город')body+='<div class="message"><h3>Провода и гаражи</h3><p>Провода соединяют столбы на крышах, в том числе через шоссе. Поднимитесь по лестнице; Space + E у столба — зацепиться, E — отпустить. На ящики и баки можно запрыгнуть. Рядом с забором используйте Space + E, чтобы перелезть.</p><button data-extra="track" data-value="wire">Показать ближайший провод</button><button data-extra="track" data-value="garage-yard">Ящики и забор у гаражей</button></div>';
    if(tab==='Гараж')body=`<div class="message">Состояние рабочей машины: ${a.garage.condition}%. Выбери услугу — на карте появится автосервис. Оплата производится на месте.</div>${purchaseCards(state,['repair','engine','suspension','van'])}${state.career.garage.van?'<button data-extra="track" data-value="van">Показать мой фургон</button>':''}`;

    show(
      `<div class="modal tablet-modal"><div class="phone tablet" role="dialog" aria-modal="true" aria-label="Рабочий планшет"><div class="phonebar tabletbar"><span>МЕРЧПЛАНШЕТ · ГОРОДСКОЙ МАРШРУТ</span><button class="close" id="close" aria-label="Закрыть планшет">×</button></div><div class="tablet-layout"><section class="tablet-map" aria-label="Карта города"><div class="tablet-mapbar"><div class="navigator-title"><span>НАВИГАТОР ГОРОДА</span><strong id="tabletGoal"></strong></div><div class="map-modes" role="group" aria-label="Слой карты"><button data-map-mode="schematic" aria-pressed="${state.mapMode==='schematic'}" class="${state.mapMode==='schematic'?'active':''}">Схема</button><button data-map-mode="satellite" aria-pressed="${state.mapMode!=='schematic'}" class="${state.mapMode!=='schematic'?'active':''}">Спутник</button></div></div><div class="tablet-mapstage"><canvas id="bigmap" width="1672" height="941" aria-label="Карта районов и положение игрока"></canvas>${tab!=="Карта"?`<section class="tablet-sheet" aria-label="${tab}"><header><div><small>МЕРЧПЛАНШЕТ</small><h2>${tab}</h2></div><button id="hideSheet" aria-label="Свернуть раздел к карте">×</button></header><div id="phoneBody" tabindex="0">${body}</div></section>`:""}</div><div class="tablet-mapfooter"><span>↑ СЕВЕР · НАЖМИТЕ НА МАГАЗИН, ЧТОБЫ ВЫБРАТЬ ЦЕЛЬ</span><span>M / ESC — ЗАКРЫТЬ</span></div></section><aside class="tablet-sidebar ${state.awaitingShopChoice?'awaiting-choice':''}"><h2 id="nextShopTitle">Выбери следующий магазин</h2><p class="shop-choice-tip">${state.awaitingShopChoice?'Визит завершён. Нажми на магазин ниже, чтобы продолжить.':'Нажми на магазин ниже — на карте появится маршрут.'}</p><div class="tablet-active-tasks">${SUPPLIES[state.supplyTrip?.item]?`<button class="active-task selected" data-task-tab="Снаряжение"><strong>Покупка · ${SUPPLIES[state.supplyTrip.item].name}</strong><small>Продавец отмечен на карте · E на месте</small></button>`:""}${Object.entries(EVENT_INFO).filter(([id])=>state.adventure.events[id].status==='active').map(([id,info])=>`<button data-task-tab="Город" class="active-task"><strong>${info.title}</strong><small>Дополнительное задание</small></button>`).join('')}${[...SHOPS].filter(s=>!state.shops[s.id].done&&isShopUnlocked(state,s.id)).sort((a,b)=>(b.id===state.selected)-(a.id===state.selected)).map(s=>`<button data-shop="${s.id}" class="active-task ${s.id===state.selected&&!state.awaitingShopChoice?"selected":""}"><strong>${s.name}</strong><small>${JOBS[s.id].title}</small><span>${jobProgress(state,s.id)}</span></button>`).join("")||"<p>Все визиты завершены</p>"}${state.sideWork?.active?'<button data-task-tab="Подработка" class="active-task"><strong>Доставка</strong><small>Текущая подработка</small></button>':""}</div></aside></div><footer class="tablet-apps"><nav class="tabs" aria-label="Меню планшета">${tabs.map((t) => `<button data-tab="${t}" class="${t === tab ? "active" : ""}" aria-pressed="${t === tab}">${t}</button>`).join("")}</nav></footer></div></div>`,
    );
    $("bigmap").onclick=(event)=>{
      const canvas=$("bigmap"),rect=canvas.getBoundingClientRect();
      const p=mapViewport(canvas.width,canvas.height,state.position).unproject((event.clientX-rect.left)*canvas.width/rect.width,(event.clientY-rect.top)*canvas.height/rect.height);
      const nearest=SHOPS.map(shop=>({shop,d:Math.min(Math.hypot(pixel(shop.x,shop.z).x-p.u,pixel(shop.x,shop.z).y-p.v),Math.hypot(MAP_MARKERS[shop.id][0]-p.u,MAP_MARKERS[shop.id][1]-p.v))})).sort((a,b)=>a.d-b.d)[0];
      if(nearest?.d<45){if(selectShop(state,nearest.shop.id)){actions.storeChosen?.();phone(tab);}}
    };
    $("close").onclick = actions.resume;
    if($("hideSheet"))$("hideSheet").onclick=()=>phone('Карта');
    document
      .querySelectorAll("[data-tab], [data-task-tab]")
      .forEach((b) => (b.onclick = () => phone(b.dataset.tab&&b.dataset.tab===tab?"Карта":b.dataset.tab??b.dataset.taskTab)));
    document.querySelectorAll("[data-shop]").forEach(
      (b) =>
        (b.onclick = () => {
          if(selectShop(state,+b.dataset.shop)){actions.storeChosen?.();phone("Карта");}
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
    document.querySelectorAll('[data-purchase]').forEach(b=>b.onclick=()=>actions.purchase(b.dataset.purchase));
    document.querySelectorAll('[data-map-mode]').forEach(b=>b.onclick=()=>{state.mapMode=b.dataset.mapMode;actions.mapModeChanged?.();phone(tab);});
    document.querySelectorAll('[data-side-work]').forEach(b=>b.onclick=()=>actions.sideWork(b.dataset.sideWork));
    document.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>actions.adventure(b.dataset.extra,b.dataset.value==='fists'?null:b.dataset.value,tab));
    document.querySelector('[data-open-collection]')?.addEventListener('click',()=>phone('Коллекция'));
  }
  function adventureDialog(title,text,choices){
    show(`<div class="modal"><div class="window"><h2 id="extraTitle"></h2><p id="extraText"></p><div class="dialogueoptions">${choices.map(c=>`<button id="extra-${c.id}" ${c.disabled?'disabled':''}>${c.label}</button>`).join('')}</div></div></div>`);
    $('extraTitle').textContent=title;$('extraText').textContent=text;for(const c of choices)$('extra-'+c.id).onclick=c.run;
  }
  function tableGame(){
    const t=state.adventure.fun.table,deck=['Чай','Сок','Хлеб','Чай','Хлеб','Сок'];
    show(`<div class="modal"><div class="window"><button class="close" id="close">×</button><h2>Найдите три пары</h2><p>${t.won?'Победа! +20 ₽, стресс −10. Награда уже получена.':'Откройте две одинаковые карточки. После ошибки выберите следующую карточку.'}</p><div class="memory-grid">${deck.map((name,i)=>`<button data-memory="${i}" ${t.won||t.matched.includes(i)?'disabled':''}>${t.matched.includes(i)||t.open.includes(i)?name:'?'}</button>`).join('')}</div></div></div>`);
    $('close').onclick=actions.resume;document.querySelectorAll('[data-memory]').forEach(b=>b.onclick=()=>actions.adventure('table',Number(b.dataset.memory)));
  }
  function incomingCall() {
    show(`<div class="modal"><div class="window"><div class="eyebrow">08:00 · ВХОДЯЩИЙ ЗВОНОК</div><h2>Региональный менеджер</h2><p>Вы у своего дома. Рабочая машина ждёт рядом. Менеджер звонит с первым заданием на сегодня.</p><button class="primary" id="answerCall">ОТВЕТИТЬ НА ЗВОНОК</button></div></div>`);
    $('answerCall').onclick=actions.answerCall;
  }
  function employee(person,shop) {
    show(`<div class="modal"><div class="window"><div class="eyebrow">${shop.name} · СОТРУДНИК МАГАЗИНА</div><h2>${person.role}</h2><p id="employeeSpeech"></p><button class="primary" id="employeeClose">СПАСИБО</button></div></div>`);
    $('employeeSpeech').textContent=shop.id===0 ? !state.shops[0].job.paid ? 'Голубое парковочное место перед входом. Паркомат рядом с ним. После оплаты зайдите к Нине.' : !state.shops[0].job.assigned ? 'Нина ждёт в проходе между стеллажами. Она выдаст вам задание на выкладку.' : 'Чай и сок на левой полке, крупа на правой. Подойдите к каждой отмеченной секции и нажмите E. Визит подтверждает только Нина.' : `${JOBS[shop.id].description} После работы обратитесь к управляющему: он подтверждает визиты.`;
    $('employeeClose').onclick=actions.resume;
  }
  function dialogue(shop) {
    const p = state.shops[shop.id];
    show(
      `<div class="modal"><div class="window"><button class="close" id="close">×</button><div class="eyebrow">${shop.name.toUpperCase()} · ОТНОШЕНИЕ ${p.rep}</div><h2>${shop.npc}</h2><p id="speech"></p><div class="dialogueoptions"><button data-choice="polite">Я по рабочему маршруту. Подтвердите визит, пожалуйста.</button><button data-choice="badge">Показать бейдж и пообещать всё сделать.</button><button data-choice="job">Напомните, что нужно сделать и где искать.</button><button data-choice="rude">У меня девять точек! Давайте быстрее.</button></div></div></div>`,
    );
    $("speech").textContent = p.done
      ? "Спасибо, визит уже закрыт. Удачной смены!"
      : !isShopUnlocked(state, shop.id) ? "Мы ещё закрыты. Возвращайтесь после пяти подтверждённых визитов." : jobDone(state, shop.id) ? "Всё сделано? Отлично, можно подтверждать визит." : shop.id===0 && p.job.paid && !p.job.assigned ? 'Спасибо за парковку! Нужна помощь в зале: восстановите выкладку чая, сока и крупы. Нажмите «Напомните, что нужно сделать», чтобы взять задание.' : shop.description;
    if(shop.id===0&&state.career.contacts.includes('seller'))$('speech').textContent='Помню, вы вернули кошелёк. Спасибо! '+$('speech').textContent;
    else if(state.career.loyalty[shop.id]<0)$('speech').textContent='Прошлый конфликт я помню. Давайте сегодня спокойно. '+$('speech').textContent;
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
    jobWindow(shop, `<h2>Парковочный терминал</h2><div class="parking-ticket"><span>${paid ? 'ЧЕК · ОПЛАЧЕНО' : 'ТАРИФ НА СМЕНУ'}</span><strong>40 ₽</strong><p>${paid ? 'Парковка оплачена. Чек сохранён в маршруте.' : car ? `${car.displayName} стоит в голубом месте.` : 'Найдите свободное голубое место перед магазином. Машина должна полностью помещаться в разметке и стоять неподвижно.'}</p></div><p>После оплаты зайдите к Нине в зал: она выдаст новое задание на выкладку. Одной парковки для подтверждения визита недостаточно.</p><button class="primary" id="payParking" ${paid || !car || state.money < 40 ? 'disabled' : ''}>${paid ? 'ПАРКОВКА ОПЛАЧЕНА' : 'ОПЛАТИТЬ 40 ₽'}</button>${!paid && state.money < 40 ? '<p>Не хватает денег. Выполните бесплатное задание в другой точке или верните обычные тележки за бонус.</p>' : ''}`);
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
  function defeatScreen(defeat){
    show(`<div class="failure-screen" role="dialog" aria-modal="true" aria-label="Поражение"><div class="failure-content"><div class="failure-title">ПРОВАЛЕНО</div><p>Городская больница готова принять вас.</p><small>${defeat.policeLevel?'Штраф за задержание':'Медицинская помощь'}: ${defeat.penalty} ₽ · прогресс заданий сохраняется</small><button id="heal" disabled>Хочу вылечиться</button></div></div>`);
    $('hud').classList.add('hidden');$('heal').onclick=actions.heal;
  }
  function updateDefeat(defeat){const screen=document.querySelector('.failure-screen');if(!screen)return;screen.classList.toggle('revealed',defeat.elapsed>=1);screen.classList.toggle('ready',defeat.phase==='ready');$('heal').disabled=defeat.phase!=='ready';}
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
    incomingCall,
    employee,
    adventureDialog,tableGame,
    shelf,
    parking,
    planogram,
    repair,
    expiry,
    prices,
    ending,
    defeatScreen,updateDefeat,
    context(t) {
      $("context").classList.toggle("hidden", !t);
      $("context").firstElementChild.textContent = t;
    },
  };
}
