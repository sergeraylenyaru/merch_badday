import {SHOPS} from '../state.js';
import {isShopUnlocked,JOBS} from '../jobs/catalog.js';
import {PACKS} from '../adventure/state.js';
import {point} from '../city/reference-layout.js';
export const MAP_LAYERS={food:{label:'Еда',symbol:'Е',color:'#e5a45c',hint:'Рестораны и шаурма: здоровье, меньше стресса и −1 звезда'},hideouts:{label:'Укрытие в гаражах',symbol:'★',color:'#65df93',hint:'Остановись на машине: −1 звезда каждую секунду'},shops:{label:'Магазины',symbol:'М',color:'#4b84b6',hint:'Рабочие задания; нажми, чтобы выбрать магазин'},vendors:{label:'Ларьки и сервисы',symbol:'Л',color:'#55b9ee',hint:'Покупки на месте, Дима и автосервис'},guards:{label:'Охрана',symbol:'О',color:'#e9c65e',hint:'Взятка снимает одну звезду розыска'},health:{label:'Больница',symbol:'+',color:'#e66c65',hint:'Медицинская помощь'},leisure:{label:'Парк и берег',symbol:'П',color:'#df956b',hint:'Аттракционы, набережная, причалы и особняк'},parkour:{label:'Паркур',symbol:'↟',color:'#aa8bd3',hint:'Лестницы, провода и опоры у заборов'},collectibles:{label:'Коллекция',symbol:'◆',color:'#d478b4',hint:'Ещё не найденные разноцветные пачки'}};
let cachedWorld,cachedKey,cachedMarkers;
export function mapMarkers(state,world){
 const key=Math.floor(state.time*4)+':'+state.adventure.cigarettes.length+':'+state.shops.map(s=>+s.done).join('');if(cachedWorld===world&&cachedKey===key)return cachedMarkers;
 const list=SHOPS.map(s=>({...s,id:'shop:'+s.id,shop:s.id,layer:'shops',symbol:s.code,label:s.code+' · '+s.name,detail:state.shops[s.id].done?'Визит завершён':!isShopUnlocked(state,s.id)?'Откроется после пяти визитов':JOBS[s.id].title,done:state.shops[s.id].done,locked:!isShopUnlocked(state,s.id)}));
 for(const place of world?.coast?.landmarks??[])list.push({...place,layer:'leisure',symbol:'П',label:place.name,detail:place.detail});
 for(const site of world?.food?.diagnostics.sites??[])list.push({...site.approach,id:'food:'+site.id,layer:'food',symbol:'Е',label:site.name,detail:site.meal+' · '+site.price+' ₽ · здоровье +'+site.health+' · −1 звезда'});
 if(world?.hideout)list.push({...world.hideout.diagnostics,id:'garage-hideout',layer:'hideouts',symbol:'★',label:'Гаражи · скрыть розыск',detail:'На машине в зелёной зоне · −1 звезда в секунду'});
 if(world?.mall)list.push({...world.mall.diagnostics,id:'unfinished-mall',layer:'parkour',symbol:'↟',label:'Недостроенный торговый центр',detail:'Три уровня, балки и лестницы'});
 for(const s of world?.vendors?.markers()??[])list.push({...s,id:'vendor:'+s.id,layer:'vendors',symbol:s.id==='garage'?'А':s.id==='dima'?'Д':'Л',label:s.name,detail:s.id==='dima'?'Договор о сроках у фургона':s.id==='garage'?'Ремонт, улучшения и собственный фургон':'Подойди и нажми E, чтобы купить'});
 for(const [i,g]of (world?.adventure?.diagnostics.guards??[]).entries())list.push({...g,id:'guard:'+i,layer:'guards',symbol:'О',label:'Охрана · '+g.shopName,detail:'Подойди и нажми E · взятка снимает одну звезду'});
 if(world?.hospital)list.push({...world.hospital.spawn,id:'hospital',layer:'health',symbol:'+',label:'Городская больница',detail:'Здесь герой появляется после лечения'});
 for(const r of world?.park?.diagnostics.rides??[])list.push({...point(r.u,r.v),id:'ride:'+r.id,layer:'leisure',symbol:'П',label:r.name??'Аттракцион в парке',detail:'Место отдыха'});
 if(world?.park?.diagnostics.square)list.push({...world.park.diagnostics.square,id:'lenin-square',layer:'leisure',symbol:'П',label:'Площадь Ленина',detail:'Памятник и скамейки в парке'});
 for(const l of world?.parkour?.diagnostics.ladders??[])list.push({...l,id:'ladder:'+l.id,layer:'parkour',symbol:'↟',label:'Лестница на крышу',detail:'Space + E · зацепиться; W / S · лезть'});
 for(const [i,y]of (world?.yards?.yards??[]).entries())list.push({...y.props[0],id:'vault:'+i,layer:'parkour',symbol:'↟',label:'Опора у забора',detail:'Запрыгни на ящик или бак, затем Space + E'});
 for(const item of world?.adventure?.diagnostics.items??[])if(item.kind==='pack'&&item.available)list.push({...item,id:'pack:'+item.id,layer:'collectibles',symbol:'◆',label:'Коллекционная пачка',detail:PACKS[item.id]?.name??'Нажми E рядом с находкой'});
 cachedWorld=world;cachedKey=key;return cachedMarkers=list.map(m=>({...m,color:MAP_LAYERS[m.layer].color}));
}
export function layerControls(state){return `<button id="mapLayersButton" class="map-layers-button" aria-expanded="false">Метки ▾</button><div id="mapLayerPanel" class="map-layer-panel" hidden><strong>Что показать на карте</strong>${Object.entries(MAP_LAYERS).map(([id,l])=>`<label><input type="checkbox" data-map-layer="${id}" ${state.mapLayers[id]?'checked':''}><i style="--marker-color:${l.color}">${l.symbol}</i><span>${l.label}<small>${l.hint}</small></span></label>`).join('')}<p><i class="goal-key"></i> Выбранная цель видна всегда</p></div>`;}
