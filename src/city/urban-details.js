import * as T from 'three';
import { MAP_BUILDINGS } from './map-buildings.js';
import { WORK_STOPS, LOCAL_POINTS, nearRoad, isReferenceWater } from './reference-layout.js';

/**
 * Runtime procedural asset library for the final city pass.
 * Every entry is original Three.js geometry; no external URL or runtime download.
 */
const CATEGORY_DATA = [
  ['residential', 'Жилые здания', 'apartment-5 apartment-9 corner-section arched-building retail-ground-floor private-house garage garage-row'],
  ['entrances', 'Подъезды и детали домов', 'entry-door intercom entrance-canopy entrance-steps wheelchair-ramp handrail basement-window balcony drainpipe ac-unit roof-vent antenna address-plate'],
  ['pavement', 'Тротуары и дворовые проезды', 'sidewalk-straight sidewalk-corner curb lowered-curb driveway pedestrian-island retaining-wall lawn-fence'],
  ['road-equipment', 'Дорожное оборудование', 'traffic-light pedestrian-signal road-sign direction-sign parking-meter barrier bollards guardrail speed-bump parking-stop traffic-cone temporary-barrier'],
  ['bridge-waterfront', 'Мосты и набережная', 'bridge-pier bridge-abutment bridge-railing approach-fence seawall seawall-turn water-stairs pier shoreline-stones drainage-pipe life-ring'],
  ['vegetation', 'Растительность', 'birch poplar linden maple spruce young-tree mature-tree shrub-round shrub-tall hedge flowerbed flower-planter grass-clump reeds stump fallen-branch'],
  ['yard', 'Дворовое благоустройство', 'bench-wood bench-metal trash-bin recycling-bin waste-containers fenced-bin-area information-board bike-rack clothesline gazebo game-table garden-fence'],
  ['play-sport', 'Детские и спортивные площадки', 'slide swing carousel spring-rider sandbox play-complex pull-up-bars dip-bars outdoor-fitness football-goal basketball-hoop playground-fence'],
  ['public-buildings', 'Общественные здания и заведения', 'pharmacy clinic police-station fire-station school kindergarten post-office pickup-point tire-shop car-wash gas-station'],
  ['store-exterior', 'Внешнее оформление магазинов', 'storefront vitrine automatic-door swing-door vestibule storefront-canopy signboard a-board promo-stand atm cart-shelter bike-parking loading-zone-fence'],
  ['retail-equipment', 'Оборудование торгового зала', 'wall-shelving island-shelving endcap checkout pos-terminal self-checkout anti-theft-gates shopping-baskets fridge-case fridge-cabinet freezer bread-rack produce-counter promo-basket'],
  ['products', 'Товары', 'tea-box cereal-box juice-carton milk-carton water-bottle drink-bottle canned-food bread cookie-pack snack-pack household-chemistry tobacco-carton apple banana tomato potato vegetable-crate'],
  ['warehouse', 'Склад и разгрузка', 'wood-pallet plastic-pallet loaded-pallet empty-pallet shipping-box small-box large-box plastic-crate warehouse-rack cage-trolley hand-truck pallet-jack forklift loading-ramp dock-door dock-bumper stretch-wrap'],
  ['staff-room', 'Служебные помещения магазинов', 'director-desk office-chair computer filing-cabinet staff-lockers break-table microwave kettle water-cooler wall-clock fire-extinguisher first-aid-kit breaker-cabinet cctv-camera'],
  ['merch-tools', 'Рабочие предметы мерчендайзера', 'tablet phone badge handheld-terminal invoice folder pen price-holder price-label-pack barcode-scanner work-bag box-cutter work-gloves repair-tool'],
  ['transport', 'Транспорт', 'compact-car taxi minibus city-bus ambulance garbage-truck tow-truck utility-van bicycle moped'],
  ['characters', 'Персонажи', 'director seller cashier security-guard loader delivery-driver janitor municipal-worker customer elderly-pedestrian parent-with-stroller police-patrol'],
  ['daily-life', 'Предметы повседневной жизни', 'shopping-bag backpack umbrella baby-stroller suitcase coffee-cup newspaper handbag parked-bicycle pigeon cat dog'],
  ['utilities', 'Городские коммуникации', 'electrical-cabinet transformer-hut manhole drain-grate fire-hydrant gas-pipe power-pole overhead-cables ventilation-grille construction-fence rubble-pile waste-skip'],
];

const ARCHETYPE_RULES = [
  [/^(apartment-(5|9)|corner-section|arched-building|retail-ground-floor|private-house|garage|garage-row|pharmacy|clinic|police-station|fire-station|school|kindergarten|post-office|pickup-point|tire-shop|car-wash|gas-station)$/, 'building'],
  [/^(entry-door|intercom|entrance-canopy|entrance-steps|wheelchair-ramp|handrail|basement-window|balcony|drainpipe|ac-unit|roof-vent|antenna|address-plate)$/, 'building-detail'],
  [/^(sidewalk-(straight|corner)|curb|lowered-curb|driveway|pedestrian-island|retaining-wall|lawn-fence)$/, 'pavement'],
  [/^(traffic-light|pedestrian-signal|road-sign|direction-sign|parking-meter|barrier|bollards|guardrail|speed-bump|parking-stop|traffic-cone|temporary-barrier)$/, 'traffic'],
  [/^(bridge-|bridge-pier|bridge-abutment|bridge-railing|approach-fence|seawall|water-stairs|pier$|shoreline-stones|drainage-pipe|life-ring)$/, 'bridge'],
  [/^(birch|poplar|linden|maple|spruce|young-tree|mature-tree)$/, 'tree'],
  [/^(shrub-(round|tall)|hedge|flowerbed|flower-planter|grass-clump|reeds|stump|fallen-branch)$/, 'plant'],
  [/^(bench-|trash-bin|recycling-bin|waste-containers|fenced-bin-area|information-board|bike-rack|clothesline|gazebo|game-table|garden-fence)$/, 'furniture'],
  [/^(slide|swing|carousel|spring-rider|sandbox|play-complex|pull-up-bars|dip-bars|outdoor-fitness|football-goal|basketball-hoop|playground-fence)$/, 'playground'],
  [/^(storefront|vitrine|automatic-door|swing-door|vestibule|storefront-canopy|signboard|a-board|promo-stand|atm$|cart-shelter|bike-parking|loading-zone-fence)$/, 'shopfront'],
  [/^(wall-shelving|island-shelving|endcap|checkout|pos-terminal|self-checkout|anti-theft-gates|shopping-baskets|fridge-case|fridge-cabinet|freezer|bread-rack|produce-counter|promo-basket)$/, 'retail'],
  [/^(tea-box|cereal-box|juice-carton|milk-carton|water-bottle|drink-bottle|canned-food|bread$|cookie-pack|snack-pack|household-chemistry|tobacco-carton|apple|banana|tomato|potato|vegetable-crate)$/, 'product'],
  [/^(wood-pallet|plastic-pallet|loaded-pallet|empty-pallet|shipping-box|small-box|large-box|plastic-crate|warehouse-rack|cage-trolley|hand-truck|pallet-jack|forklift|loading-ramp|dock-door|dock-bumper|stretch-wrap)$/, 'warehouse'],
  [/^(director-desk|office-chair|computer|filing-cabinet|staff-lockers|break-table|microwave|kettle|water-cooler|wall-clock|fire-extinguisher|first-aid-kit|breaker-cabinet|cctv-camera)$/, 'office'],
  [/^(tablet|phone|badge|handheld-terminal|invoice|folder|pen|price-holder|price-label-pack|barcode-scanner|work-bag|box-cutter|work-gloves|repair-tool)$/, 'tool'],
  [/^(compact-car|taxi|minibus|city-bus|ambulance|garbage-truck|tow-truck|utility-van|bicycle|moped)$/, 'vehicle'],
  [/^(director|seller|cashier|security-guard|loader|delivery-driver|janitor|municipal-worker|customer|elderly-pedestrian|parent-with-stroller|police-patrol)$/, 'character'],
  [/^(shopping-bag|backpack|umbrella|baby-stroller|suitcase|coffee-cup|newspaper|handbag|parked-bicycle|pigeon|cat|dog)$/, 'daily'],
  [/^(electrical-cabinet|transformer-hut|manhole|drain-grate|fire-hydrant|gas-pipe|power-pole|overhead-cables|ventilation-grille|construction-fence|rubble-pile|waste-skip)$/, 'utility'],
];

function archetypeFor(id) {
  for (const [pattern, kind] of ARCHETYPE_RULES) if (pattern.test(id)) return kind;
  return 'furniture';
}

export const URBAN_ASSET_CATALOG = Object.freeze(CATEGORY_DATA.flatMap(([category, categoryLabel, ids]) =>
  ids.split(' ').map((id) => Object.freeze({ id, category, categoryLabel, archetype: archetypeFor(id) })),
));

const PALETTE = {
  plaster: '#d8d0bf', cream: '#f1e7d2', concrete: '#9a9d98', asphalt: '#454d52',
  brick: '#a85e4c', brickDark: '#70473f', roof: '#59646a', metal: '#89979b',
  darkMetal: '#34434a', glass: '#8fc2c7', blue: '#477f9b', navy: '#243b4b',
  yellow: '#e8bd58', orange: '#dc8646', red: '#bb554b', green: '#567c57',
  leaf: '#59805b', leafLight: '#7b9a61', leafDark: '#365e45', wood: '#96704e',
  woodLight: '#bc9468', white: '#e8e5dc', black: '#252b2d', produce: '#8b9d50',
  paper: '#eee4c9', package: '#d0b27a', fabric: '#4c6c91', safety: '#edb843',
};

function createContext() {
  const geometries = new Map(), materials = new Map(), textures = new Set();
  const key = (type, values) => type + ':' + values.map((n) => Number(n).toFixed(4)).join(',');
  function geometry(type, ...values) {
    const k = key(type, values);
    if (!geometries.has(k)) {
      let g;
      if (type === 'box') g = new T.BoxGeometry(...values);
      else if (type === 'cylinder') g = new T.CylinderGeometry(...values);
      else if (type === 'sphere') g = new T.IcosahedronGeometry(...values);
      else if (type === 'cone') g = new T.ConeGeometry(...values);
      else if (type === 'torus') g = new T.TorusGeometry(...values);
      else if (type === 'plane') g = new T.PlaneGeometry(...values);
      else g = new T.BoxGeometry(1, 1, 1);
      geometries.set(k, g);
    }
    return geometries.get(k);
  }
  function material(color, options = {}) {
    const k = [color, options.roughness ?? 0.76, options.metalness ?? 0, options.emissive ?? ''].join('/');
    if (!materials.has(k)) materials.set(k, new T.MeshStandardMaterial({
      color, roughness: options.roughness ?? 0.76, metalness: options.metalness ?? 0,
      emissive: options.emissive ?? '#000000', emissiveIntensity: options.emissiveIntensity ?? 0,
    }));
    return materials.get(k);
  }
  function addMesh(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const mesh = new T.Mesh(geo, mat);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh);
    return mesh;
  }
  function box(parent, w, h, d, x, y, z, color = 'plaster', ry = 0) {
    return addMesh(parent, geometry('box', w, h, d), material(PALETTE[color] || color), x, y, z, 0, ry, 0);
  }
  function cylinder(parent, radiusTop, radiusBottom, height, x, y, z, color = 'metal', radial = 10, rx = 0, rz = 0) {
    return addMesh(parent, geometry('cylinder', radiusTop, radiusBottom, height, radial), material(PALETTE[color] || color, { metalness: color === 'metal' || color === 'darkMetal' ? 0.35 : 0 }), x, y, z, rx, 0, rz);
  }
  function sphere(parent, radius, x, y, z, color = 'leaf', detail = 1) {
    return addMesh(parent, geometry('sphere', radius, detail), material(PALETTE[color] || color), x, y, z);
  }
  function cone(parent, radius, height, x, y, z, color = 'leaf', radial = 7, rz = 0) {
    return addMesh(parent, geometry('cone', radius, height, radial), material(PALETTE[color] || color), x, y, z, 0, 0, rz);
  }
  function torus(parent, radius, tube, x, y, z, color = 'metal', rx = Math.PI / 2) {
    return addMesh(parent, geometry('torus', radius, tube, 6, 20), material(PALETTE[color] || color, { metalness: 0.3 }), x, y, z, rx);
  }
  function textSign(parent, text, w, h, x, y, z, background = '#243b4b', foreground = '#f1e7d2') {
    if (typeof document === 'undefined') {
      box(parent, w, h, 0.08, x, y, z, background);
      return;
    }
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const c = canvas.getContext('2d');
    c.fillStyle = background; c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = foreground; c.font = '700 48px Manrope, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(text).toUpperCase(), 256, 66, 480);
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4; textures.add(texture);
    const mat = new T.MeshStandardMaterial({ map: texture, roughness: 0.7, metalness: 0.04, emissive: background, emissiveIntensity: 0.025 });
    materials.set('sign:' + text + ':' + background, mat);
    const mesh = addMesh(parent, geometry('plane', w, h), mat, x, y, z);
    mesh.userData.urbanTexture = texture;
    return mesh;
  }
  return {
    geometries, materials, textures, geometry, material, addMesh, box, cylinder, sphere, cone, torus, textSign,
    dispose() { for (const g of geometries.values()) g.dispose(); for (const t of textures) t.dispose(); for (const m of new Set(materials.values())) m.dispose(); },
  };
}

function buildAsset(id, variant, c) {
  const record = URBAN_ASSET_CATALOG.find((item) => item.id === id);
  if (!record) throw new Error('Unknown urban asset: ' + id);
  const g = new T.Group(); g.name = 'urban-' + id + '-v' + variant;
  const { box, cylinder: cy, sphere: sp, cone, torus, textSign } = c;
  const v = Math.max(0, variant | 0);
  const palette = ['blue', 'brick', 'green', 'yellow', 'plaster', 'orange'];
  const accent = palette[v % palette.length];
  const sign = (label, w, h, x, y, z, bg) => textSign(g, label, w, h, x, y, z, bg || PALETTE.navy, PALETTE.cream);
  const post = (x, h, z, color = 'metal', r = 0.045) => cy(g, r, r, h, x, h / 2, z, color, 8);
  const rail = (x1, y1, z1, x2, y2, z2, thickness = 0.055, color = 'metal') => {
    const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1, length = Math.hypot(dx, dy, dz);
    const mesh = box(g, thickness, length, thickness, (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2, color);
    mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(dx, dy, dz).normalize());
  };

  if (record.archetype === 'building') {
    const isHouse = id === 'private-house', isGarage = id.startsWith('garage'), isApartment = id.startsWith('apartment-');
    const w = isGarage ? 4.2 : isHouse ? 5.8 : isApartment ? (id === 'apartment-9' ? 9 : 7.6) : 7.2;
    const h = isGarage ? 2.5 : isHouse ? 3.4 : isApartment ? (id === 'apartment-9' ? 13.5 : 7.7) : 4.3;
    const d = isGarage ? 3.8 : isHouse ? 4.8 : isApartment ? 5.3 : 5.2;
    box(g, w, h, d, 0, h / 2, 0, isHouse ? 'cream' : isGarage ? 'concrete' : 'plaster');
    box(g, w + 0.18, 0.22, d + 0.18, 0, h + 0.08, 0, isHouse ? 'brick' : 'roof');
    if (isHouse) cone(g, w * 0.78, 1.45, 0, h + 0.75, 0, 'brick', 4, Math.PI / 4);
    const floors = isApartment ? (id === 'apartment-9' ? 9 : 5) : isHouse ? 1 : 2;
    const cols = isApartment ? 5 : isHouse ? 2 : 3;
    for (let floor = 0; floor < floors; floor++) for (let col = 0; col < cols; col++) {
      const wx = -w / 2 + (col + 0.5) * w / cols, wy = 0.65 + floor * ((h - 0.8) / floors);
      box(g, Math.max(0.45, w / cols * 0.52), Math.min(1.25, h / floors * 0.55), 0.07, wx, wy, d / 2 + 0.045, floor % 3 === 0 ? 'glass' : 'blue');
      box(g, Math.max(0.5, w / cols * 0.6), 0.06, 0.1, wx, wy - 0.34, d / 2 + 0.09, 'white');
    }
    if (isGarage) {
      box(g, 2.7, 1.65, 0.09, 0, 0.9, d / 2 + 0.07, 'darkMetal');
      for (let y = 0.3; y < 1.8; y += 0.28) box(g, 2.65, 0.045, 0.035, 0, y, d / 2 + 0.13, 'metal');
    } else {
      box(g, 0.95, 2.1, 0.1, -w * 0.27, 1.08, d / 2 + 0.06, 'wood');
      box(g, 0.08, 0.08, 0.06, -w * 0.12, 1.08, d / 2 + 0.13, 'yellow');
    }
    if (id === 'arched-building') {
      box(g, 1.65, 2.9, 0.18, 0, 1.45, d / 2 + 0.08, 'darkMetal');
      torus(g, 0.82, 0.09, 0, 2.85, d / 2 + 0.08, 'brick', 0);
    }
    if (id === 'retail-ground-floor') {
      box(g, w * 0.72, 1.5, 0.08, 0, 1.25, d / 2 + 0.08, 'glass');
      sign('МАГАЗИН', 3.6, 0.65, 0, 2.35, d / 2 + 0.13, PALETTE.navy);
    } else sign(id.replaceAll('-', ' '), Math.min(w - 0.8, 5.4), 0.45, 0, h - 0.42, d / 2 + 0.11, PALETTE.navy);
  } else if (record.archetype === 'building-detail') {
    if (id === 'entry-door') {
      box(g, 1.25, 2.35, 0.16, 0, 1.18, 0, 'darkMetal'); box(g, 1.05, 2.15, 0.06, 0, 1.18, 0.12, 'blue');
      box(g, 0.06, 0.06, 0.07, 0.39, 1.05, 0.18, 'yellow');
    } else if (id === 'intercom') {
      box(g, 0.35, 0.68, 0.09, 0, 0.82, 0, 'darkMetal');
      for (let i = 0; i < 6; i++) cy(g, 0.028, 0.028, 0.018, (i % 2) * 0.12 - 0.06, 1.03 - Math.floor(i / 2) * 0.13, 0.06, i % 3 ? 'metal' : 'yellow', 8, Math.PI / 2);
    } else if (id === 'entrance-canopy') {
      box(g, 2.4, 0.14, 1.2, 0, 2.35, 0.35, 'darkMetal'); box(g, 2.3, 0.055, 1.1, 0, 2.45, 0.35, 'glass');
      for (const x of [-0.95, 0.95]) rail(x, 2.3, 0.55, x, 1.8, 0.9, 0.05, 'metal');
    } else if (id === 'entrance-steps' || id === 'wheelchair-ramp') {
      for (let i = 0; i < 4; i++) box(g, 1.8, id === 'wheelchair-ramp' ? 0.12 : 0.14, 0.38, 0, id === 'wheelchair-ramp' ? 0.15 + i * 0.12 : 0.08 + i * 0.14, i * 0.36, id === 'wheelchair-ramp' ? 'concrete' : 'plaster');
      if (id === 'wheelchair-ramp') for (const x of [-0.85, 0.85]) rail(x, 0.12, 0, x, 0.65, 1.25, 0.045, 'metal');
    } else if (id === 'handrail') {
      for (const x of [-0.8, 0, 0.8]) post(x, 1.0, 0); rail(-0.8, 1, 0, 0.8, 1, 0, 0.055, 'metal');
    } else if (id === 'basement-window') {
      box(g, 1.3, 0.65, 0.12, 0, 0.4, 0, 'concrete'); box(g, 1.02, 0.4, 0.04, 0, 0.4, 0.08, 'glass');
      box(g, 0.05, 0.45, 0.06, 0, 0.4, 0.12, 'metal');
    } else if (id === 'balcony') {
      box(g, 2.2, 0.14, 1.1, 0, 1.0, 0.35, 'concrete');
      for (const x of [-0.95, -0.48, 0, 0.48, 0.95]) post(x, 0.9, 0.35, 'metal', 0.025);
      rail(-1.05, 0.9, 0.35, 1.05, 0.9, 0.35, 0.045, 'white');
    } else if (id === 'drainpipe') {
      cy(g, 0.055, 0.055, 3.2, 0, 1.6, 0, 'darkMetal', 10);
      for (const y of [0.45, 1.4, 2.35]) box(g, 0.18, 0.055, 0.08, 0, y, 0, 'metal');
    } else if (id === 'ac-unit') {
      box(g, 0.85, 0.62, 0.4, 0, 1.3, 0, 'white'); cy(g, 0.21, 0.21, 0.06, 0, 1.3, 0.22, 'metal', 12, Math.PI / 2);
      for (const x of [-0.25, 0.25]) box(g, 0.045, 0.42, 0.03, x, 1.3, 0.23, 'darkMetal');
    } else if (id === 'roof-vent') {
      box(g, 0.65, 0.75, 0.65, 0, 0.42, 0, 'metal'); box(g, 0.9, 0.12, 0.9, 0, 0.83, 0, 'darkMetal');
      for (let i = 0; i < 5; i++) box(g, 0.52, 0.035, 0.035, 0, 0.22 + i * 0.1, 0.34, 'darkMetal');
    } else if (id === 'antenna') {
      post(0, 2.5, 0, 'darkMetal', 0.025); rail(-0.55, 1.9, 0, 0.55, 1.9, 0, 0.035, 'metal');
      rail(-0.35, 2.2, 0, 0.35, 2.2, 0, 0.03, 'metal'); rail(-0.18, 2.45, 0, 0.18, 2.45, 0, 0.025, 'metal');
    } else {
      box(g, 0.8, 0.42, 0.08, 0, 1.0, 0, 'blue'); sign('12', 0.65, 0.28, 0, 1.0, 0.06, PALETTE.blue);
    }
  } else if (record.archetype === 'pavement') {
    if (id === 'sidewalk-corner' || id === 'pedestrian-island') {
      box(g, 2.4, 0.16, 2.4, 0, 0.08, 0, 'concrete');
      if (id === 'pedestrian-island') { box(g, 1.1, 0.18, 0.8, 0, 0.25, 0, 'yellow'); post(0, 0.75, 0, 'white', 0.11); }
    } else if (id === 'retaining-wall') {
      box(g, 4.0, 1.3, 0.5, 0, 0.65, 0, 'concrete'); for (let x = -1.5; x <= 1.5; x += 0.5) box(g, 0.035, 1.15, 0.52, x, 0.65, 0, 'white');
    } else if (id === 'lawn-fence') {
      for (let x = -1.3; x <= 1.3; x += 0.65) post(x, 0.65, 0, 'green', 0.035);
      rail(-1.3, 0.45, 0, 1.3, 0.45, 0, 0.045, 'green');
    } else if (id === 'driveway') {
      box(g, 3.0, 0.08, 2.8, 0, 0.04, 0, 'asphalt'); box(g, 3.2, 0.12, 0.2, 0, 0.07, 1.35, 'concrete');
    } else if (id === 'lowered-curb') {
      box(g, 2.5, 0.09, 0.28, 0, 0.045, 0, 'yellow'); box(g, 2.3, 0.055, 0.35, 0, 0.028, 0.32, 'concrete');
    } else if (id === 'curb') {
      box(g, 2.8, 0.22, 0.28, 0, 0.11, 0, 'white');
    } else {
      box(g, id === 'sidewalk-straight' ? 3.6 : 2.6, 0.12, id === 'sidewalk-straight' ? 1.3 : 2.6, 0, 0.06, 0, 'concrete');
      box(g, 3.6, 0.1, 0.12, 0, 0.05, 0.66, 'white');
    }
  } else if (record.archetype === 'traffic') {
    if (id === 'traffic-light' || id === 'pedestrian-signal') {
      post(0, 3.0, 0, 'darkMetal', 0.075); box(g, 0.48, id === 'pedestrian-signal' ? 0.8 : 1.35, 0.38, 0, id === 'pedestrian-signal' ? 2.25 : 2.1, 0, 'black');
      const ys = id === 'pedestrian-signal' ? [2.25] : [2.52, 2.12, 1.72];
      ys.forEach((y, i) => sphere(g, id === 'pedestrian-signal' ? 0.18 : 0.14, 0, y, 0.21, id === 'pedestrian-signal' ? 'green' : ['red', 'yellow', 'green'][i], 2));
      box(g, 0.8, 0.1, 0.6, 0, 0.05, 0, 'darkMetal');
    } else if (id === 'road-sign' || id === 'direction-sign') {
      post(0, 2.5, 0, 'metal', 0.04); box(g, id === 'direction-sign' ? 1.25 : 0.8, 0.8, 0.08, 0, 2.05, 0, id === 'road-sign' ? 'red' : 'blue');
      if (id === 'direction-sign') sign('ЦЕНТР', 1.1, 0.34, 0, 2.05, 0.05, PALETTE.blue);
      else sphere(g, 0.21, 0, 2.05, 0.055, 'white', 2);
    } else if (id === 'parking-meter') {
      post(0, 1.5, 0, 'darkMetal', 0.055); box(g, 0.42, 0.56, 0.25, 0, 1.18, 0, 'blue'); box(g, 0.25, 0.14, 0.035, 0, 1.28, 0.14, 'yellow');
    } else if (id === 'barrier') {
      post(-1.1, 0.85, 0, 'darkMetal'); post(1.1, 0.85, 0, 'darkMetal'); box(g, 2.5, 0.12, 0.12, 0, 0.83, 0, 'white');
      for (let x = -0.9; x < 1; x += 0.45) box(g, 0.18, 0.14, 0.14, x, 0.83, 0, 'red');
    } else if (id === 'bollards') {
      for (let x = -0.9; x <= 0.9; x += 0.6) { cy(g, 0.12, 0.16, 0.72, x, 0.36, 0, 'yellow', 10); cy(g, 0.12, 0.12, 0.18, x, 0.55, 0, 'darkMetal', 10); }
    } else if (id === 'guardrail' || id === 'temporary-barrier') {
      for (let x = -1.3; x <= 1.3; x += 0.65) post(x, 0.9, 0, 'metal');
      rail(-1.3, 0.72, 0, 1.3, 0.72, 0, 0.1, id === 'temporary-barrier' ? 'orange' : 'metal');
      if (id === 'temporary-barrier') for (let x = -0.9; x <= 0.9; x += 0.6) box(g, 0.2, 0.75, 0.06, x, 0.45, 0.07, 'white');
    } else if (id === 'speed-bump') {
      box(g, 2.8, 0.16, 0.48, 0, 0.08, 0, 'yellow'); for (let x = -1.2; x < 1.2; x += 0.6) box(g, 0.2, 0.17, 0.5, x, 0.085, 0, 'black');
    } else if (id === 'parking-stop') {
      box(g, 1.8, 0.22, 0.3, 0, 0.11, 0, 'yellow'); for (const x of [-0.55, 0.55]) box(g, 0.24, 0.24, 0.32, x, 0.12, 0, 'black');
    } else if (id === 'traffic-cone') {
      cone(g, 0.24, 0.68, 0, 0.39, 0, 'orange', 8); box(g, 0.48, 0.08, 0.48, 0, 0.04, 0, 'white'); box(g, 0.22, 0.08, 0.22, 0, 0.38, 0, 'white');
    } else {
      box(g, 1.3, 0.12, 0.12, 0, 0.65, 0, 'white'); for (let x = -0.5; x <= 0.5; x += 0.5) post(x, 0.7, 0, 'yellow');
    }
  } else if (record.archetype === 'bridge') {
    if (id === 'life-ring') {
      torus(g, 0.42, 0.12, 0, 1.0, 0, 'red', 0); post(0, 1.65, -0.12, 'metal', 0.035); box(g, 0.8, 0.14, 0.12, 0, 1.8, -0.12, 'white');
    } else if (id === 'water-stairs') {
      for (let i = 0; i < 7; i++) box(g, 2.2, 0.12, 0.42, 0, 0.06 + i * 0.12, i * 0.42, 'concrete');
      for (const x of [-1.0, 1.0]) { for (let i = 0; i < 5; i++) post(x, 0.65 + i * 0.12, i * 0.48, 'metal'); rail(x, 0.7, 0, x, 1.4, 2.2, 0.05, 'metal'); }
    } else if (id === 'seawall' || id === 'seawall-turn') {
      box(g, id === 'seawall-turn' ? 2.4 : 4.0, 1.0, 0.6, 0, 0.5, 0, 'concrete');
      for (let x = -1.5; x <= 1.5; x += 0.5) box(g, 0.035, 0.85, 0.62, x, 0.5, 0, 'white');
    } else if (id === 'shoreline-stones') {
      for (let i = 0; i < 9; i++) sp(g, 0.18 + (i % 3) * 0.04, (i % 3) * 0.35 - 0.35, 0.1, Math.floor(i / 3) * 0.35 - 0.35, i % 2 ? 'concrete' : 'white', 1);
    } else if (id === 'drainage-pipe') {
      cy(g, 0.12, 0.12, 2.2, 0, 0.12, 0, 'darkMetal', 12, Math.PI / 2); box(g, 0.25, 0.25, 0.5, 0, 0.12, 0.75, 'concrete');
    } else if (id === 'bridge-pier' || id === 'bridge-abutment') {
      box(g, id === 'bridge-pier' ? 1.3 : 2.4, 2.6, 1.4, 0, 1.3, 0, 'concrete');
      box(g, 2.6, 0.2, 1.6, 0, 2.55, 0, 'white');
    } else {
      box(g, 3.2, 0.18, 0.18, 0, 1.1, 0, 'metal');
      for (let x = -1.5; x <= 1.5; x += 0.5) { post(x, 1.1, 0, 'metal'); box(g, 0.12, 0.12, 0.3, x, 0.06, 0, 'concrete'); }
      rail(-1.5, 0.92, 0, 1.5, 0.92, 0, 0.07, 'metal');
    }
  } else if (record.archetype === 'tree') {
    const height = id === 'spruce' ? 4.8 : id === 'poplar' ? 5.3 : id === 'young-tree' ? 2.6 : 4.0;
    cy(g, 0.13, 0.19, height * 0.55, 0, height * 0.28, 0, id === 'birch' ? 'white' : 'wood', 9);
    if (id === 'birch') for (const y of [0.7, 1.15, 1.65]) box(g, 0.24, 0.055, 0.03, 0, y, 0.15, 'darkMetal');
    if (id === 'spruce' || id === 'poplar') {
      const levels = id === 'spruce' ? 5 : 3;
      for (let i = 0; i < levels; i++) cone(g, id === 'spruce' ? 1.0 - i * 0.14 : 0.72 - i * 0.12, 1.4, 0, height * 0.45 + i * 0.65, 0, i % 2 ? 'leafDark' : 'leaf', 8);
    } else {
      sp(g, id === 'maple' ? 1.7 : 1.5, 0, height * 0.77, 0, id === 'linden' ? 'leafLight' : 'leaf', 2);
      sp(g, 1.0, -0.72, height * 0.72, 0.05, 'leafDark', 1); sp(g, 0.95, 0.7, height * 0.73, -0.08, 'leafLight', 1);
    }
  } else if (record.archetype === 'plant') {
    if (id.startsWith('shrub-')) {
      for (let i = 0; i < 5; i++) sp(g, id === 'shrub-tall' ? 0.62 : 0.46, (i - 2) * 0.42, id === 'shrub-tall' ? 0.9 : 0.55, (i % 2) * 0.18, i % 2 ? 'leafLight' : 'leaf', 1);
    } else if (id === 'hedge') {
      for (let x = -1.5; x <= 1.5; x += 0.5) sp(g, 0.5, x, 0.62, 0, x % 1 ? 'leaf' : 'leafDark', 1);
    } else if (id === 'flowerbed' || id === 'flower-planter') {
      if (id === 'flower-planter') { box(g, 1.5, 0.62, 1.1, 0, 0.31, 0, 'brick'); box(g, 1.3, 0.08, 0.9, 0, 0.65, 0, 'wood'); }
      else box(g, 2.4, 0.16, 1.2, 0, 0.08, 0, 'wood');
      for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 0.55, z = (Math.floor(i / 3) - 1) * 0.32; cy(g, 0.035, 0.035, 0.28, x, 0.82, z, 'green', 6); sp(g, 0.14, x, 0.98, z, ['red', 'yellow', 'orange'][i % 3], 1); }
    } else if (id === 'reeds') {
      for (let i = 0; i < 9; i++) { const x = (i % 3 - 1) * 0.3, z = (Math.floor(i / 3) - 1) * 0.25; cy(g, 0.025, 0.035, 1.2 + (i % 2) * 0.4, x, 0.7, z, 'green', 5, 0, (i % 2 ? 0.1 : -0.1)); }
    } else if (id === 'grass-clump') {
      for (let i = 0; i < 11; i++) cone(g, 0.12, 0.45 + (i % 3) * 0.14, (i % 4 - 1.5) * 0.12, 0.25, (Math.floor(i / 4) - 1) * 0.12, i % 2 ? 'leafLight' : 'leaf', 5, (i % 2) * 0.12);
    } else if (id === 'stump') {
      cy(g, 0.34, 0.4, 0.55, 0, 0.27, 0, 'wood', 9); cy(g, 0.29, 0.29, 0.04, 0, 0.56, 0, 'woodLight', 9);
    } else {
      cy(g, 0.13, 0.18, 2.0, 0, 0.2, 0, 'wood', 8, 0, Math.PI / 2); for (const x of [-0.6, 0.35]) cy(g, 0.07, 0.09, 0.9, x, 0.2, 0, 'woodLight', 7, 0, 0.7);
    }
  } else if (record.archetype === 'furniture') {
    if (id.startsWith('bench-')) {
      box(g, 2.0, 0.16, 0.62, 0, 0.48, 0, id === 'bench-metal' ? 'darkMetal' : 'wood');
      for (const x of [-0.78, 0.78]) { box(g, 0.12, 0.48, 0.48, x, 0.24, 0, 'darkMetal'); box(g, 0.12, 0.78, 0.1, x, 0.78, -0.24, 'darkMetal'); }
      for (let y = 0.72; y <= 1.05; y += 0.16) box(g, 2.0, 0.1, 0.09, 0, y, -0.24, 'woodLight');
    } else if (id === 'trash-bin' || id === 'recycling-bin') {
      box(g, 0.68, 0.92, 0.62, 0, 0.46, 0, id === 'recycling-bin' ? 'blue' : 'green'); box(g, 0.76, 0.12, 0.68, 0, 0.96, 0, 'darkMetal');
      box(g, 0.42, 0.09, 0.06, 0, 0.66, 0.33, 'yellow');
    } else if (id === 'waste-containers' || id === 'fenced-bin-area') {
      for (let x = -1.2; x <= 1.2; x += 0.8) box(g, 0.72, 1.35, 0.8, x, 0.675, 0, 'green');
      box(g, 3.6, 0.12, 0.12, 0, 1.4, -0.55, 'metal'); for (let x = -1.8; x <= 1.8; x += 0.6) post(x, 1.4, -0.55, 'metal', 0.025);
    } else if (id === 'information-board') {
      post(-0.75, 1.9, 0, 'wood'); post(0.75, 1.9, 0, 'wood'); box(g, 1.9, 1.2, 0.12, 0, 1.3, 0, 'wood'); box(g, 1.7, 0.95, 0.05, 0, 1.3, 0.08, 'paper'); sign('ИНФОРМАЦИЯ', 1.55, 0.22, 0, 1.62, 0.12, PALETTE.green);
    } else if (id === 'bike-rack') {
      for (let x = -0.9; x <= 0.9; x += 0.6) { cy(g, 0.035, 0.035, 0.8, x, 0.4, 0, 'metal', 8); torus(g, 0.25, 0.035, x, 0.7, 0, 'metal', 0); }
    } else if (id === 'clothesline') {
      for (const x of [-1.2, 1.2]) post(x, 1.8, 0, 'metal'); rail(-1.2, 1.75, 0, 1.2, 1.75, 0, 0.035, 'white');
      for (let i = 0; i < 4; i++) box(g, 0.35, 0.55, 0.035, -0.8 + i * 0.5, 1.38, 0, ['blue', 'yellow', 'red', 'green'][i]);
    } else if (id === 'gazebo') {
      for (const x of [-1.2, 1.2]) for (const z of [-1.0, 1.0]) post(x, 2.2, z, 'wood');
      box(g, 3.0, 0.14, 2.7, 0, 2.2, 0, 'roof'); cone(g, 2.0, 1.1, 0, 2.85, 0, 'brick', 4, Math.PI / 4);
      box(g, 2.1, 0.15, 0.42, 0, 0.55, 0.55, 'wood'); box(g, 2.1, 0.15, 0.42, 0, 0.55, -0.55, 'wood');
    } else if (id === 'game-table') {
      box(g, 1.25, 0.12, 1.25, 0, 0.95, 0, 'wood'); for (const x of [-0.48, 0.48]) for (const z of [-0.48, 0.48]) post(x, 0.9, z, 'darkMetal');
      box(g, 0.7, 0.02, 0.7, 0, 1.02, 0, 'green');
    } else {
      for (let x = -1.5; x <= 1.5; x += 0.5) post(x, 0.85, 0, 'wood', 0.035); rail(-1.5, 0.72, 0, 1.5, 0.72, 0, 0.06, 'wood');
    }
  } else if (record.archetype === 'playground') {
    if (id === 'slide') {
      box(g, 0.16, 1.8, 0.16, -0.6, 1.0, -0.5, 'yellow'); box(g, 1.4, 0.14, 1.1, 0, 1.9, -0.5, 'blue');
      const chute = box(g, 0.9, 0.09, 2.1, 0.25, 0.9, 0.65, 'orange'); chute.rotation.x = -0.28;
      for (const x of [-0.38, 0.38]) rail(x, 1.4, -0.9, x, 0.95, 0.4, 0.04, 'yellow');
    } else if (id === 'swing') {
      for (const x of [-0.9, 0.9]) rail(x, 0, 0, 0, 2.4, 0, 0.09, 'yellow');
      rail(-1.0, 2.35, 0, 1.0, 2.35, 0, 0.1, 'blue');
      for (const x of [-0.42, 0.42]) { rail(x, 2.25, 0, x, 0.75, 0, 0.025, 'metal'); }
      box(g, 0.85, 0.1, 0.35, 0, 0.72, 0, 'red');
    } else if (id === 'carousel') {
      cy(g, 0.12, 0.18, 1.1, 0, 0.55, 0, 'yellow', 10); cy(g, 1.0, 1.0, 0.12, 0, 1.12, 0, 'blue', 16);
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; box(g, 0.35, 0.18, 0.55, Math.sin(a) * 0.7, 1.25, Math.cos(a) * 0.7, i % 2 ? 'orange' : 'red', a); }
    } else if (id === 'spring-rider') {
      cy(g, 0.06, 0.06, 0.62, 0, 0.32, 0, 'metal', 8, 0, 0.12); box(g, 0.9, 0.25, 0.42, 0, 0.85, 0, 'orange'); sphere(g, 0.24, 0, 1.08, 0, 'yellow', 2); rail(-0.38, 1.0, 0, 0.38, 1.0, 0, 0.045, 'darkMetal');
    } else if (id === 'sandbox') {
      box(g, 2.6, 0.28, 2.2, 0, 0.14, 0, 'wood'); box(g, 2.35, 0.07, 1.95, 0, 0.19, 0, 'yellow');
    } else if (id === 'play-complex') {
      for (const x of [-1.3, 1.3]) for (const z of [-0.7, 0.7]) post(x, 2.2, z, 'blue');
      box(g, 2.9, 0.18, 1.8, 0, 2.0, 0, 'yellow'); cone(g, 1.6, 0.9, 0, 2.6, 0, 'red', 4, Math.PI / 4);
      box(g, 0.8, 0.12, 1.8, -1.2, 1.15, 0.9, 'orange');
    } else if (id === 'football-goal') {
      for (const x of [-1.4, 1.4]) post(x, 2.0, 0, 'white', 0.045); rail(-1.4, 2, 0, 1.4, 2, 0, 0.055, 'white');
      for (let x = -1.3; x <= 1.3; x += 0.3) rail(x, 0.1, -1.0, x, 2, 0, 0.012, 'white');
    } else if (id === 'basketball-hoop') {
      post(0, 3.0, 0, 'darkMetal', 0.07); box(g, 1.2, 0.85, 0.1, 0, 2.5, 0.12, 'white'); torus(g, 0.34, 0.045, 0, 2.15, 0.3, 'orange', 0);
    } else if (id === 'pull-up-bars' || id === 'dip-bars' || id === 'outdoor-fitness') {
      for (const x of [-0.8, 0.8]) post(x, id === 'pull-up-bars' ? 2.2 : 1.3, 0, 'darkMetal');
      rail(-0.8, id === 'pull-up-bars' ? 2.15 : 1.2, 0, 0.8, id === 'pull-up-bars' ? 2.15 : 1.2, 0, 0.08, 'metal');
      if (id === 'outdoor-fitness') { box(g, 0.8, 0.18, 0.6, 0, 0.55, 0, 'blue'); cy(g, 0.09, 0.09, 0.45, 0, 0.28, 0, 'yellow', 8); }
    } else if (id === 'playground-fence') {
      for (let x = -1.6; x <= 1.6; x += 0.4) post(x, 1.0, 0, 'green', 0.03); rail(-1.6, 0.85, 0, 1.6, 0.85, 0, 0.04, 'green');
    } else {
      box(g, 2.5, 0.16, 2.0, 0, 0.08, 0, 'concrete');
    }
  } else if (record.archetype === 'shopfront') {
    if (id === 'atm') {
      box(g, 0.8, 1.7, 0.48, 0, 0.85, 0, 'blue'); box(g, 0.48, 0.35, 0.04, 0, 1.2, 0.25, 'black'); box(g, 0.28, 0.12, 0.04, 0, 0.75, 0.25, 'yellow');
    } else if (id === 'a-board' || id === 'promo-stand') {
      rail(-0.45, 0, 0, -0.25, 1.0, 0, 0.055, 'darkMetal'); rail(0.45, 0, 0, 0.25, 1.0, 0, 0.055, 'darkMetal');
      box(g, 1.0, 0.78, 0.09, 0, 0.75, 0, id === 'a-board' ? 'black' : 'yellow'); sign(id === 'a-board' ? 'АКЦИЯ' : 'СКИДКИ', 0.82, 0.35, 0, 0.78, 0.06, PALETTE.red);
    } else if (id === 'cart-shelter') {
      for (const x of [-1.6, 1.6]) for (const z of [-0.8, 0.8]) post(x, 2.1, z, 'metal');
      box(g, 3.6, 0.14, 2.0, 0, 2.1, 0, 'roof'); rail(-1.6, 1.1, -0.8, 1.6, 1.1, -0.8, 0.035, 'metal');
    } else if (id === 'bike-parking') {
      for (let x = -1.0; x <= 1.0; x += 0.5) { cy(g, 0.035, 0.035, 0.85, x, 0.42, 0, 'metal', 8); torus(g, 0.22, 0.035, x, 0.68, 0, 'metal', 0); }
    } else if (id === 'loading-zone-fence') {
      for (let x = -1.5; x <= 1.5; x += 0.5) post(x, 1.0, 0, 'yellow', 0.04); rail(-1.5, 0.8, 0, 1.5, 0.8, 0, 0.06, 'yellow');
    } else {
      box(g, 6.5, 3.4, 0.45, 0, 1.7, 0, 'plaster'); box(g, 5.7, 1.8, 0.1, 0, 1.7, 0.27, 'glass');
      box(g, 1.0, 2.1, 0.12, -2.3, 1.05, 0.34, 'blue'); box(g, 6.8, 0.16, 1.4, 0, 3.25, 0.3, 'roof');
      sign(id === 'signboard' ? 'МАГАЗИН' : '24 / 7', 3.5, 0.62, 0, 2.75, 0.37, PALETTE.navy);
    }
  } else if (record.archetype === 'retail') {
    if (id.includes('shelving') || id === 'endcap' || id === 'bread-rack' || id === 'produce-counter') {
      const width = id === 'endcap' ? 1.1 : 2.3;
      box(g, width, 0.12, 0.75, 0, 0.08, 0, 'darkMetal');
      for (const x of [-width / 2 + 0.08, width / 2 - 0.08]) box(g, 0.08, 1.8, 0.08, x, 0.98, 0, 'metal');
      for (let level = 0; level < 4; level++) {
        box(g, width, 0.07, 0.8, 0, 0.28 + level * 0.43, 0, 'metal');
        for (let i = 0; i < 4; i++) box(g, 0.34, 0.28, 0.3, -width / 2 + 0.24 + i * 0.52, 0.45 + level * 0.43, 0.04, palette[(i + level + v) % palette.length]);
      }
      if (id === 'produce-counter') for (let i = 0; i < 8; i++) sp(g, 0.16, (i % 4 - 1.5) * 0.4, 0.62, (Math.floor(i / 4) - 0.5) * 0.3, i % 2 ? 'green' : 'red', 1);
    } else if (id === 'checkout' || id === 'self-checkout') {
      box(g, 2.4, 0.95, 0.9, 0, 0.48, 0, 'darkMetal'); box(g, 1.1, 0.04, 0.62, -0.35, 0.98, 0, 'black');
      box(g, 0.48, 0.65, 0.4, 0.75, 1.25, 0, 'blue'); box(g, 0.38, 0.24, 0.05, 0.75, 1.35, 0.23, 'glass');
    } else if (id === 'pos-terminal') {
      box(g, 0.42, 0.26, 0.32, 0, 0.14, 0, 'darkMetal'); box(g, 0.34, 0.26, 0.04, 0, 0.36, 0.15, 'blue');
    } else if (id === 'anti-theft-gates') {
      for (const x of [-0.7, 0.7]) { box(g, 0.18, 1.8, 0.28, x, 0.9, 0, 'white'); box(g, 0.12, 0.4, 0.05, x, 1.3, 0.16, 'blue'); }
    } else if (id === 'shopping-baskets') {
      for (let i = 0; i < 3; i++) { box(g, 0.65, 0.42, 0.48, (i - 1) * 0.48, 0.22, 0, i % 2 ? 'red' : 'blue'); rail((i - 1) * 0.48 - 0.24, 0.43, 0, (i - 1) * 0.48 + 0.24, 0.43, 0, 0.035, 'darkMetal'); }
    } else if (id.startsWith('fridge') || id === 'freezer') {
      box(g, 1.55, 2.1, 0.75, 0, 1.05, 0, 'white'); box(g, 1.35, 1.75, 0.06, 0, 1.05, 0.4, 'glass');
      for (let y = 0.45; y < 1.8; y += 0.38) box(g, 1.28, 0.035, 0.05, 0, y, 0.45, 'metal');
      if (id === 'freezer') box(g, 1.55, 0.28, 0.82, 0, 2.18, 0, 'blue');
    } else if (id === 'promo-basket') {
      box(g, 1.25, 0.55, 0.85, 0, 0.28, 0, 'yellow'); for (let x = -0.5; x <= 0.5; x += 0.25) box(g, 0.035, 0.52, 0.88, x, 0.28, 0, 'orange');
    } else {
      box(g, 1.4, 1.8, 0.7, 0, 0.9, 0, 'darkMetal'); box(g, 1.25, 1.5, 0.06, 0, 0.9, 0.38, 'glass');
    }
  } else if (record.archetype === 'product') {
    if (id === 'water-bottle' || id === 'drink-bottle') {
      cy(g, 0.12, 0.17, 0.55, 0, 0.38, 0, 'glass', 10); cy(g, 0.075, 0.075, 0.2, 0, 0.76, 0, 'glass', 10); cy(g, 0.07, 0.07, 0.08, 0, 0.9, 0, 'blue', 8);
      box(g, 0.22, 0.16, 0.025, 0, 0.42, 0.16, accent);
    } else if (id === 'canned-food') {
      cy(g, 0.16, 0.16, 0.45, 0, 0.225, 0, 'metal', 12); box(g, 0.22, 0.16, 0.025, 0, 0.24, 0.16, accent);
    } else if (id === 'apple' || id === 'tomato' || id === 'banana') {
      if (id === 'banana') { for (let i = 0; i < 3; i++) { const b = cy(g, 0.09, 0.1, 0.52, (i - 1) * 0.12, 0.22, 0, 'yellow', 8, 0, (i - 1) * 0.25); } }
      else { sp(g, id === 'apple' ? 0.24 : 0.22, 0, 0.24, 0, id === 'apple' ? 'red' : 'orange', 2); cy(g, 0.025, 0.025, 0.09, 0, 0.48, 0, 'green', 5); }
    } else if (id === 'bread') {
      sp(g, 0.28, 0, 0.22, 0, 'woodLight', 2); box(g, 0.42, 0.13, 0.04, 0, 0.28, 0.22, 'cream');
    } else if (id === 'potato' || id === 'vegetable-crate') {
      box(g, 0.9, 0.5, 0.65, 0, 0.25, 0, 'wood'); for (let i = 0; i < 6; i++) sp(g, 0.12, (i % 3 - 1) * 0.24, 0.54, (Math.floor(i / 3) - 0.5) * 0.24, id === 'potato' ? 'package' : 'green', 1);
    } else {
      const w = id.includes('carton') ? 0.42 : id.includes('pack') ? 0.48 : 0.55;
      box(g, w, id.includes('box') ? 0.72 : 0.62, 0.38, 0, id.includes('box') ? 0.36 : 0.31, 0, id === 'household-chemistry' ? 'blue' : id === 'tobacco-carton' ? 'darkMetal' : accent);
      box(g, w * 0.68, 0.16, 0.025, 0, 0.38, 0.2, 'white');
      box(g, w * 0.48, 0.035, 0.03, 0, 0.16, 0.205, 'yellow');
    }
  } else if (record.archetype === 'warehouse') {
    if (id.includes('pallet')) {
      box(g, 1.25, 0.12, 1.0, 0, 0.22, 0, id === 'plastic-pallet' ? 'darkMetal' : 'wood');
      for (const x of [-0.45, 0, 0.45]) box(g, 0.16, 0.28, 0.92, x, 0.08, 0, id === 'plastic-pallet' ? 'blue' : 'woodLight');
      if (id === 'loaded-pallet') for (let y = 0; y < 2; y++) for (let x = -0.38; x <= 0.38; x += 0.38) box(g, 0.34, 0.35, 0.38, x, 0.5 + y * 0.36, 0, 'package');
    } else if (id.includes('box') || id === 'plastic-crate') {
      const size = id === 'small-box' ? 0.45 : id === 'large-box' ? 1.0 : 0.72;
      box(g, size, size * 0.8, size, 0, size * 0.4, 0, id === 'plastic-crate' ? 'blue' : 'package');
      for (let y = 0; y < 3; y++) box(g, size * 0.8, 0.025, 0.03, 0, size * 0.2 + y * size * 0.18, size / 2 + 0.02, 'woodLight');
    } else if (id === 'warehouse-rack') {
      for (const x of [-1.2, 1.2]) post(x, 3.2, 0, 'blue', 0.07);
      for (let y = 0.6; y < 3.1; y += 0.8) { box(g, 2.5, 0.09, 0.8, 0, y, 0, 'orange'); for (let x = -0.8; x <= 0.8; x += 0.8) box(g, 0.65, 0.5, 0.6, x, y + 0.28, 0, 'package'); }
    } else if (id === 'forklift') {
      box(g, 1.5, 0.75, 2.2, 0, 0.62, 0, 'yellow'); box(g, 0.9, 1.1, 0.7, 0.15, 1.45, -0.3, 'darkMetal'); box(g, 0.65, 0.08, 0.5, 0.1, 1.55, -0.3, 'glass');
      for (const x of [-0.55, 0.55]) for (const z of [-0.72, 0.72]) cy(g, 0.22, 0.22, 0.18, x, 0.25, z, 'black', 10, Math.PI / 2);
      post(0.72, 1.6, 0.85, 'darkMetal', 0.055); box(g, 0.65, 0.08, 0.9, 1.0, 0.1, 0.85, 'metal');
    } else if (id === 'hand-truck' || id === 'pallet-jack') {
      box(g, 0.55, 0.08, id === 'pallet-jack' ? 1.3 : 0.65, 0, 0.12, 0, 'metal'); rail(0, 0.15, -0.2, 0, 1.5, -0.2, 0.055, 'darkMetal');
      cy(g, 0.16, 0.16, 0.1, -0.3, 0.15, 0.3, 'black', 10, Math.PI / 2); cy(g, 0.16, 0.16, 0.1, 0.3, 0.15, 0.3, 'black', 10, Math.PI / 2);
    } else if (id === 'cage-trolley') {
      box(g, 0.9, 0.12, 1.3, 0, 0.35, 0, 'metal');
      for (const x of [-0.42, 0.42]) { for (const z of [-0.55, 0.55]) post(x, 1.5, z, 'metal', 0.025); }
      for (let y = 0.5; y < 1.5; y += 0.22) rail(-0.42, y, -0.55, 0.42, y, -0.55, 0.025, 'metal');
      for (const x of [-0.3, 0.3]) cy(g, 0.1, 0.1, 0.08, x, 0.1, 0.55, 'black', 8, Math.PI / 2);
    } else if (id === 'loading-ramp') {
      const ramp = box(g, 3.2, 0.25, 2.5, 0, 0.25, 0, 'concrete'); ramp.rotation.x = -0.15;
    } else if (id === 'dock-door') {
      box(g, 2.8, 3.2, 0.2, 0, 1.6, 0, 'darkMetal'); for (let y = 0.3; y < 3.0; y += 0.25) box(g, 2.65, 0.04, 0.04, 0, y, 0.12, 'metal');
    } else if (id === 'dock-bumper') {
      box(g, 0.35, 1.2, 0.25, 0, 0.6, 0, 'black'); box(g, 0.37, 0.12, 0.27, 0, 0.6, 0.14, 'yellow');
    } else if (id === 'stretch-wrap') {
      box(g, 0.95, 1.25, 0.95, 0, 0.75, 0, 'package'); for (let y = 0.25; y < 1.4; y += 0.16) box(g, 1.0, 0.025, 1.0, 0, y, 0, 'glass');
    } else {
      box(g, 1.0, 0.8, 0.9, 0, 0.4, 0, 'package');
    }
  } else if (record.archetype === 'office') {
    if (id === 'director-desk' || id === 'break-table') {
      box(g, id === 'director-desk' ? 1.8 : 1.4, 0.12, 0.9, 0, 0.82, 0, 'wood');
      for (const x of [-0.72, 0.72]) for (const z of [-0.32, 0.32]) post(x, 0.8, z, 'darkMetal');
      if (id === 'director-desk') { box(g, 0.8, 0.55, 0.5, -0.45, 0.47, 0, 'woodLight'); box(g, 0.42, 0.28, 0.06, 0.35, 1.02, -0.2, 'black'); }
    } else if (id === 'office-chair') {
      box(g, 0.65, 0.14, 0.62, 0, 0.58, 0, 'black'); box(g, 0.62, 0.75, 0.12, 0, 0.98, -0.25, 'fabric'); post(0, 0.5, 0, 'metal');
      for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; rail(0, 0.08, 0, Math.sin(a) * 0.42, 0.08, Math.cos(a) * 0.42, 0.035, 'darkMetal'); }
    } else if (id === 'computer') {
      box(g, 0.9, 0.6, 0.12, 0, 1.0, 0, 'black'); box(g, 0.78, 0.46, 0.035, 0, 1.0, 0.08, 'blue'); post(0, 0.28, 0, 'metal'); box(g, 0.8, 0.05, 0.28, 0, 0.62, 0, 'darkMetal');
    } else if (id === 'filing-cabinet' || id === 'staff-lockers' || id === 'breaker-cabinet') {
      const width = id === 'staff-lockers' ? 2.1 : 1.1, height = id === 'staff-lockers' ? 1.9 : 1.8;
      box(g, width, height, 0.6, 0, height / 2, 0, id === 'breaker-cabinet' ? 'yellow' : 'metal');
      const doors = id === 'staff-lockers' ? 3 : id === 'filing-cabinet' ? 4 : 1;
      for (let i = 0; i < doors; i++) { const y = id === 'filing-cabinet' ? 0.28 + i * 0.4 : 0.95; box(g, width / doors - 0.06, id === 'filing-cabinet' ? 0.33 : 1.55, 0.035, -width / 2 + (i + 0.5) * width / doors, y, 0.32, 'white'); }
    } else if (id === 'microwave' || id === 'kettle') {
      if (id === 'microwave') { box(g, 0.8, 0.48, 0.5, 0, 0.25, 0, 'darkMetal'); box(g, 0.48, 0.3, 0.035, -0.08, 0.25, 0.26, 'black'); }
      else { cy(g, 0.22, 0.26, 0.42, 0, 0.21, 0, 'white', 12); box(g, 0.15, 0.1, 0.18, 0.24, 0.3, 0, 'darkMetal'); }
    } else if (id === 'water-cooler') {
      box(g, 0.62, 0.9, 0.62, 0, 0.45, 0, 'white'); cy(g, 0.22, 0.22, 0.62, 0, 1.22, 0, 'glass', 12); box(g, 0.28, 0.22, 0.04, 0, 0.72, 0.33, 'blue');
    } else if (id === 'wall-clock') {
      cy(g, 0.42, 0.42, 0.08, 0, 1.6, 0, 'white', 24, Math.PI / 2); cy(g, 0.025, 0.025, 0.08, 0, 1.6, 0.05, 'black', 8);
      rail(0, 1.6, 0.08, 0, 1.88, 0.08, 0.025, 'black'); rail(0, 1.6, 0.08, 0.2, 1.6, 0.08, 0.025, 'black');
    } else if (id === 'fire-extinguisher') {
      cy(g, 0.15, 0.17, 0.75, 0, 0.42, 0, 'red', 12); box(g, 0.18, 0.12, 0.18, 0, 0.84, 0, 'darkMetal'); rail(0.1, 0.9, 0, 0.32, 1.1, 0, 0.025, 'black');
    } else if (id === 'first-aid-kit') {
      box(g, 0.6, 0.42, 0.22, 0, 0.22, 0, 'white'); box(g, 0.12, 0.3, 0.04, 0, 0.22, 0.13, 'red'); box(g, 0.3, 0.12, 0.04, 0, 0.22, 0.13, 'red');
    } else if (id === 'cctv-camera') {
      box(g, 0.38, 0.22, 0.42, 0, 0.08, 0, 'white'); cy(g, 0.1, 0.1, 0.08, 0, 0.08, 0.23, 'black', 12, Math.PI / 2); rail(-0.2, 0.2, -0.2, 0, 0.42, -0.35, 0.04, 'metal');
    } else {
      box(g, 0.75, 0.08, 0.5, 0, 0.04, 0, 'wood');
    }
  } else if (record.archetype === 'tool') {
    if (id === 'tablet' || id === 'phone' || id === 'handheld-terminal') {
      const w = id === 'phone' ? 0.28 : id === 'tablet' ? 0.72 : 0.42;
      box(g, w, id === 'phone' ? 0.55 : 0.92, 0.07, 0, 0.48, 0, 'black'); box(g, w * 0.82, id === 'phone' ? 0.4 : 0.75, 0.025, 0, 0.49, 0.045, 'blue');
      if (id === 'handheld-terminal') box(g, 0.15, 0.12, 0.05, 0, 0.08, 0.04, 'yellow');
    } else if (id === 'badge') {
      box(g, 0.48, 0.65, 0.05, 0, 0.35, 0, 'white'); box(g, 0.4, 0.14, 0.03, 0, 0.52, 0.04, 'blue'); box(g, 0.22, 0.18, 0.03, 0, 0.28, 0.04, 'yellow');
    } else if (id === 'barcode-scanner') {
      box(g, 0.28, 0.35, 0.35, 0, 0.42, 0, 'darkMetal'); box(g, 0.18, 0.45, 0.15, 0.08, 0.12, 0, 'black'); box(g, 0.18, 0.08, 0.04, 0, 0.5, 0.19, 'red');
    } else if (id === 'work-bag') {
      box(g, 0.95, 0.8, 0.42, 0, 0.4, 0, 'fabric'); rail(-0.28, 0.8, 0, -0.2, 1.1, 0, 0.04, 'darkMetal'); rail(0.28, 0.8, 0, 0.2, 1.1, 0, 0.04, 'darkMetal');
    } else if (id === 'box-cutter' || id === 'repair-tool' || id === 'pen') {
      box(g, id === 'pen' ? 0.06 : 0.16, id === 'repair-tool' ? 0.62 : 0.4, 0.08, 0, 0.2, 0, id === 'box-cutter' ? 'yellow' : 'darkMetal');
      if (id === 'box-cutter') box(g, 0.04, 0.2, 0.04, 0.08, 0.4, 0, 'metal');
    } else if (id === 'work-gloves') {
      for (const x of [-0.2, 0.2]) { box(g, 0.3, 0.35, 0.15, x, 0.18, 0, 'yellow'); for (let i = 0; i < 4; i++) box(g, 0.045, 0.16, 0.05, x - 0.1 + i * 0.065, 0.4, 0, 'yellow'); }
    } else if (id === 'price-holder' || id === 'price-label-pack') {
      box(g, 0.85, 0.15, 0.08, 0, 0.08, 0, 'white'); box(g, 0.75, 0.09, 0.03, 0, 0.1, 0.05, 'red');
    } else if (id === 'invoice' || id === 'folder') {
      box(g, 0.65, 0.04, 0.9, 0, 0.02, 0, id === 'folder' ? 'blue' : 'paper');
      for (let i = 0; i < 4; i++) box(g, 0.42, 0.008, 0.015, 0, 0.04, -0.3 + i * 0.17, 'darkMetal');
    } else {
      box(g, 0.65, 0.05, 0.5, 0, 0.025, 0, 'paper'); for (let i = 0; i < 4; i++) box(g, 0.45, 0.008, 0.01, 0, 0.055, -0.15 + i * 0.09, 'darkMetal');
    }
  } else if (record.archetype === 'vehicle') {
    if (id === 'bicycle' || id === 'moped') {
      torus(g, 0.38, 0.055, -0.65, 0.38, 0, 'black', 0); torus(g, 0.38, 0.055, 0.65, 0.38, 0, 'black', 0);
      rail(-0.65, 0.38, 0, -0.12, 0.78, 0, 0.045, 'metal'); rail(-0.12, 0.78, 0, 0.65, 0.38, 0, 0.045, 'metal');
      rail(-0.12, 0.78, 0, 0.08, 0.42, 0, 0.045, 'metal');
      if (id === 'moped') { box(g, 0.75, 0.3, 0.38, 0.05, 0.65, 0, 'blue'); box(g, 0.5, 0.12, 0.4, 0.18, 0.92, 0, 'black'); }
    } else {
      const bus = id === 'city-bus' || id === 'minibus', truck = id === 'garbage-truck' || id === 'tow-truck' || id === 'utility-van';
      const w = bus ? 2.3 : truck ? 2.1 : 1.85, length = bus ? 6.2 : truck ? 5.0 : 4.1, h = bus ? 2.5 : 1.6;
      box(g, w, h, length, 0, h * 0.6, 0, id === 'taxi' ? 'yellow' : id === 'ambulance' ? 'white' : id === 'garbage-truck' ? 'green' : id === 'police-patrol' ? 'navy' : 'blue');
      box(g, w * 0.82, h * 0.45, length * 0.48, 0, h * 1.0, -length * 0.03, 'glass');
      if (id === 'ambulance') box(g, 0.12, 0.48, length * 0.35, w * 0.51, h * 0.65, 0, 'red');
      if (id === 'garbage-truck') box(g, w * 0.9, h * 0.7, length * 0.42, 0, h * 1.25, -length * 0.24, 'green');
      for (const x of [-w * 0.42, w * 0.42]) for (const z of [-length * 0.34, length * 0.34]) cy(g, 0.32, 0.32, 0.16, x, 0.32, z, 'black', 12, Math.PI / 2);
      box(g, w * 0.35, 0.12, 0.08, 0, h * 0.42, length * 0.51, 'white');
    }
  } else if (record.archetype === 'character') {
    const skin = ['#c58f6c', '#a96f50', '#e0b18b'][v % 3], shirt = ['blue', 'green', 'brick', 'fabric', 'orange'][v % 5];
    cy(g, 0.19, 0.21, 0.65, 0, 1.42, 0, shirt, 10);
    sp(g, 0.18, 0, 1.95, 0, skin, 2); cy(g, 0.1, 0.1, 0.1, 0, 2.13, 0, 'wood', 8);
    for (const x of [-0.13, 0.13]) { cy(g, 0.075, 0.09, 0.65, x, 0.58, 0, 'navy', 8); box(g, 0.18, 0.12, 0.32, x, 0.08, 0.05, 'black'); }
    for (const x of [-0.27, 0.27]) { cy(g, 0.07, 0.08, 0.62, x, 1.4, 0, shirt, 8, 0, x * 0.3); sp(g, 0.085, x, 1.07, 0.04, skin, 1); }
    if (id === 'police-patrol' || id === 'security-guard') { box(g, 0.32, 0.12, 0.3, 0, 2.12, 0, 'navy'); box(g, 0.16, 0.2, 0.03, 0, 1.52, 0.2, 'yellow'); }
    if (id === 'loader' || id === 'municipal-worker') box(g, 0.38, 0.12, 0.32, 0, 1.55, 0.18, 'yellow');
  } else if (record.archetype === 'daily') {
    if (id === 'umbrella') {
      cy(g, 0.035, 0.035, 1.4, 0, 0.7, 0, 'darkMetal', 8); cone(g, 0.8, 0.45, 0, 1.42, 0, accent, 12);
    } else if (id === 'coffee-cup') {
      cy(g, 0.18, 0.14, 0.38, 0, 0.19, 0, 'white', 12); cy(g, 0.19, 0.19, 0.06, 0, 0.4, 0, 'darkMetal', 12);
    } else if (id === 'baby-stroller') {
      box(g, 0.75, 0.75, 0.72, 0, 0.8, 0, 'fabric'); for (const x of [-0.38, 0.38]) cy(g, 0.14, 0.14, 0.09, x, 0.16, 0.28, 'black', 10, Math.PI / 2);
      rail(-0.35, 0.35, 0, -0.65, 1.45, -0.35, 0.04, 'metal');
    } else if (id === 'pigeon' || id === 'cat' || id === 'dog') {
      const animalColor = id === 'pigeon' ? 'metal' : id === 'cat' ? 'wood' : 'package';
      sp(g, id === 'dog' ? 0.34 : 0.24, 0, 0.3, 0, animalColor, 2); sp(g, 0.17, 0, 0.48, 0.18, animalColor, 2);
      if (id === 'cat') { cone(g, 0.08, 0.24, -0.1, 0.68, 0.14, animalColor, 4); cone(g, 0.08, 0.24, 0.1, 0.68, 0.14, animalColor, 4); }
      for (const x of [-0.16, 0.16]) cy(g, 0.045, 0.055, 0.25, x, 0.12, 0, animalColor, 6);
    } else if (id === 'shopping-bag' || id === 'handbag' || id === 'backpack') {
      box(g, id === 'backpack' ? 0.72 : 0.62, id === 'backpack' ? 0.95 : 0.72, 0.32, 0, 0.48, 0, id === 'backpack' ? 'fabric' : accent);
      rail(-0.2, 0.82, 0, -0.14, 1.05, -0.06, 0.035, 'darkMetal'); rail(0.2, 0.82, 0, 0.14, 1.05, -0.06, 0.035, 'darkMetal');
    } else if (id === 'suitcase') {
      box(g, 0.75, 0.82, 0.38, 0, 0.42, 0, 'blue'); rail(-0.15, 0.85, 0, 0.15, 0.85, 0, 0.035, 'darkMetal');
    } else if (id === 'newspaper') {
      box(g, 0.72, 0.035, 0.95, 0, 0.02, 0, 'paper'); box(g, 0.58, 0.012, 0.12, 0, 0.045, 0, 'blue');
    } else if (id === 'parked-bicycle') {
      torus(g, 0.34, 0.045, -0.6, 0.35, 0, 'black', 0); torus(g, 0.34, 0.045, 0.6, 0.35, 0, 'black', 0);
      rail(-0.6, 0.35, 0, -0.1, 0.7, 0, 0.04, 'metal'); rail(-0.1, 0.7, 0, 0.6, 0.35, 0, 0.04, 'metal');
    } else {
      box(g, 0.6, 0.75, 0.3, 0, 0.38, 0, accent); rail(-0.2, 0.76, 0, 0.2, 0.76, 0, 0.04, 'darkMetal');
    }
  } else if (record.archetype === 'utility') {
    if (id === 'manhole' || id === 'drain-grate') {
      cy(g, id === 'manhole' ? 0.62 : 0.5, id === 'manhole' ? 0.62 : 0.5, 0.08, 0, 0.04, 0, 'darkMetal', 20);
      for (let i = -3; i <= 3; i++) box(g, 0.035, 0.02, 0.75, i * 0.12, 0.09, 0, 'metal');
    } else if (id === 'fire-hydrant') {
      cy(g, 0.18, 0.22, 0.65, 0, 0.33, 0, 'red', 10); cy(g, 0.14, 0.14, 0.14, 0, 0.72, 0, 'red', 10);
      for (const x of [-0.2, 0.2]) cy(g, 0.08, 0.08, 0.18, x, 0.42, 0, 'yellow', 8, 0, Math.PI / 2);
    } else if (id === 'power-pole' || id === 'overhead-cables') {
      post(0, 4.4, 0, 'wood', 0.09); rail(-1.2, 3.8, 0, 1.2, 3.8, 0, 0.06, 'wood');
      for (const x of [-0.9, 0, 0.9]) post(x, 0.5, 0, 'metal', 0.035);
      for (const x of [-1.0, 0, 1.0]) torus(g, 0.12, 0.035, x, 3.8, 0, 'white', Math.PI / 2);
    } else if (id === 'gas-pipe') {
      rail(-1.3, 0.8, 0, 1.3, 0.8, 0, 0.1, 'yellow'); for (const x of [-0.9, 0.9]) post(x, 1.0, 0, 'yellow');
    } else if (id === 'transformer-hut') {
      box(g, 2.5, 2.5, 2.2, 0, 1.25, 0, 'green'); box(g, 2.2, 1.5, 0.06, 0, 1.2, 1.14, 'darkMetal');
      for (let y = 0.55; y < 1.9; y += 0.22) box(g, 1.8, 0.035, 0.04, 0, y, 1.18, 'metal');
    } else if (id === 'electrical-cabinet' || id === 'waste-skip') {
      const width = id === 'waste-skip' ? 2.6 : 1.1, height = id === 'waste-skip' ? 1.2 : 1.7;
      box(g, width, height, id === 'waste-skip' ? 1.4 : 0.6, 0, height / 2, 0, id === 'waste-skip' ? 'orange' : 'green');
      if (id === 'electrical-cabinet') box(g, 0.08, 0.45, 0.04, 0.28, 0.95, 0.32, 'yellow');
    } else if (id === 'ventilation-grille') {
      box(g, 1.1, 0.9, 0.12, 0, 0.45, 0, 'concrete'); for (let y = 0.12; y < 0.85; y += 0.12) box(g, 0.9, 0.035, 0.04, 0, y, 0.08, 'darkMetal');
    } else if (id === 'construction-fence') {
      for (let x = -1.5; x <= 1.5; x += 0.5) post(x, 1.5, 0, 'orange', 0.035); rail(-1.5, 1.35, 0, 1.5, 1.35, 0, 0.08, 'yellow');
    } else if (id === 'rubble-pile') {
      for (let i = 0; i < 8; i++) sp(g, 0.2 + (i % 3) * 0.06, (i % 4 - 1.5) * 0.22, 0.12, (Math.floor(i / 4) - 0.5) * 0.3, i % 2 ? 'concrete' : 'brick', 1);
    } else {
      box(g, 1.2, 1.6, 0.7, 0, 0.8, 0, 'green'); box(g, 1.3, 0.12, 0.75, 0, 1.62, 0, 'darkMetal');
    }
  }
  g.userData.assetId = id; g.userData.variant = v; g.userData.archetype = record.archetype;
  return g;
}

/** Build a standalone reusable model. Call model.userData.dispose() when finished. */
export function createUrbanAsset(id, variant = 0) {
  const context = createContext(), model = buildAsset(id, variant, context);
  model.userData.dispose = () => { context.dispose(); model.removeFromParent(); };
  return model;
}

export function createUrbanDetails(sceneRoot, world, point) {
  const context = createContext(), detailRoot = new T.Group();
  detailRoot.name = 'complete-urban-details'; sceneRoot.add(detailRoot);
  const placed = [], sourceGroups = [], colliders = [];
  const byId = new Map(URBAN_ASSET_CATALOG.map((item) => [item.id, item]));
  function stopClear(u, v, radius = 0) {
    return WORK_STOPS.every((s) => Math.abs(u - s.u) > 50 + radius || Math.abs(v - s.v) > 42 + radius);
  }
  function occupied(u, v, radius = 0) {
    if (u < 22 || u > 1650 || v < 24 || v > 780) return true;
    if (isReferenceWater(u, v) || nearRoad(u, v, 2 + radius * 0.12) || !stopClear(u, v, radius)) return true;
    if (MAP_BUILDINGS.some((b) => Math.hypot(u - b[1], v - b[2]) < Math.max(b[3], b[4]) * 0.5 + radius + 7)) return true;
    if (placed.some((p) => Math.hypot(u - p.u, v - p.v) < p.radius + radius + 3)) return true;
    if (LOCAL_POINTS.some(([x, z]) => Math.hypot(u - x, v - z) < 20 + radius)) return true;
    if (u < 220 && [48, 90, 710, 744].some((row) => Math.abs(v - row) < 16 + radius)) return true;
    return false;
  }
  function add(id, u, v, variant = 0, rotation = 0, options = {}) {
    if (!byId.has(id)) return false;
    const radius = options.radius ?? 5;
    if (!options.force && occupied(u, v, radius)) return false;
    const model = buildAsset(id, variant, context), p = point(u, v);
    model.position.set(p.x, options.y ?? 0.015, p.z); model.rotation.y = rotation;
    model.updateMatrixWorld(true); detailRoot.add(model); sourceGroups.push(model);
    placed.push({ id, u, v, radius, category: byId.get(id).category });
    if (options.solid && world?.box) {
      const width = options.width ?? 7.2, height = options.height ?? 4.3, depth = options.depth ?? 5.2;
      const collider = world.box(p.x, height / 2, p.z, width, height, depth, '#6c7770', true);
      collider.visible = false; colliders.push(collider);
    }
    return true;
  }

  // Residential yards and entrance details; variants share geometry and PBR materials.
  add('entry-door', 112, 247, 0, 0, { force: true, radius: 2 });
  add('intercom', 115, 248, 1, 0, { force: true, radius: 1 });
  add('address-plate', 119, 248, 2, 0, { force: true, radius: 1 });
  add('basement-window', 130, 247, 0, 0, { force: true, radius: 2 });
  add('ac-unit', 141, 247, 1, 0, { force: true, radius: 2 });
  add('private-house', 95, 155, 0, 0, { radius: 17, solid: true, width: 5.8, height: 3.4, depth: 4.8 });
  add('garage', 215, 135, 1, 0, { radius: 14, solid: true, width: 4.2, height: 2.5, depth: 3.8 });
  add('garage-row', 214, 164, 2, 0, { radius: 18, solid: true, width: 8.4, height: 2.5, depth: 3.8 });

  // Four signalised junctions, placed on their sidewalk corners rather than in lanes.
  for (const [u, v, r] of [[225, 316, 0], [253, 316, 1], [225, 356, 2], [253, 356, 0], [486, 319, 1], [514, 319, 0], [1152, 300, 2], [1183, 300, 1], [1374, 316, 0], [1407, 357, 1]]) {
    add(r % 2 ? 'pedestrian-signal' : 'traffic-light', u, v, r, 0, { force: true, radius: 1 });
  }
  for (const [u, v, id, variant] of [
    [214, 305, 'road-sign', 0], [260, 360, 'direction-sign', 1], [477, 303, 'parking-meter', 0],
    [525, 356, 'bollards', 1], [1144, 315, 'road-sign', 2], [1190, 356, 'traffic-cone', 0],
    [1368, 300, 'direction-sign', 0], [1415, 360, 'barrier', 1],
  ]) add(id, u, v, variant, 0, { force: true, radius: 1 });

  // Park furniture, playground equipment, and several silhouettes for each plant family.
  for (const [u, v, variant] of [[150, 215, 0], [320, 210, 1], [370, 540, 0], [720, 455, 1], [910, 420, 0], [1430, 290, 1]]) {
    add(variant ? 'bench-metal' : 'bench-wood', u + 10, v + 12, variant, 0, { radius: 3 });
    add(variant ? 'recycling-bin' : 'trash-bin', u + 14, v + 13, variant, 0, { radius: 2 });
    add('flower-planter', u + 4, v + 15, variant, 0, { radius: 3 });
  }
  for (const [u, v, id, variant] of [
    [340, 235, 'slide', 0], [355, 238, 'swing', 1], [370, 238, 'sandbox', 0],
    [700, 485, 'pull-up-bars', 0], [715, 485, 'dip-bars', 1], [730, 485, 'outdoor-fitness', 2],
    [900, 445, 'basketball-hoop', 0], [925, 445, 'football-goal', 1],
  ]) add(id, u, v, variant, 0, { radius: 4 });
  for (const [u, v, id, variant] of [
    [155, 250, 'birch', 0], [174, 253, 'poplar', 1], [190, 249, 'linden', 2], [205, 254, 'maple', 0],
    [225, 252, 'spruce', 1], [300, 235, 'shrub-round', 0], [312, 238, 'shrub-tall', 1],
    [390, 530, 'hedge', 0], [405, 535, 'flowerbed', 1], [740, 455, 'grass-clump', 0],
    [755, 456, 'reeds', 1], [765, 457, 'stump', 0], [775, 458, 'fallen-branch', 1],
  ]) add(id, u, v, variant, 0, { radius: 2 });

  // Shop exteriors: a-board, ATM, bicycle stands, trolley canopy, and delivery barriers.
  for (const [i, shop] of LOCAL_POINTS.entries()) {
    const offsets = [[-13, 10, 'a-board'], [13, 9, 'atm'], [-10, -12, 'bike-parking'], [14, -12, 'cart-shelter']];
    for (const [dx, dz, id] of offsets) add(id, shop[0] + dx, shop[1] + dz, i % 3, 0, { radius: 3 });
    add('loading-zone-fence', shop[0] + 18, shop[1] + 5, i % 2, 0, { radius: 3 });
  }

  // Loading-yard props and complete staff-room / merchandiser equipment.
  for (const [u, v, variant] of [[172, 124, 0], [300, 575, 1], [550, 645, 2]]) {
    add('wood-pallet', u, v, variant, 0, { radius: 2 }); add('loaded-pallet', u + 4, v, variant, 0, { radius: 3 });
    add('warehouse-rack', u + 9, v + 2, variant, 0, { radius: 4 }); add('forklift', u + 13, v + 5, variant, 0, { radius: 4 });
    add('cage-trolley', u + 4, v + 7, variant, 0, { radius: 2 }); add('hand-truck', u + 7, v + 8, variant, 0, { radius: 2 });
    add('shipping-box', u + 2, v + 10, variant, 0, { radius: 2 }); add('stretch-wrap', u + 6, v + 11, variant, 0, { radius: 2 });
  }
  for (const [u, v, id, variant] of [
    [125, 264, 'director-desk', 0], [129, 264, 'office-chair', 1], [133, 264, 'computer', 0],
    [137, 264, 'filing-cabinet', 1], [141, 264, 'staff-lockers', 2], [145, 264, 'microwave', 0],
    [149, 264, 'kettle', 1], [153, 264, 'water-cooler', 0], [157, 264, 'wall-clock', 1],
    [161, 264, 'fire-extinguisher', 0], [165, 264, 'first-aid-kit', 1], [169, 264, 'cctv-camera', 0],
    [173, 264, 'tablet', 1], [177, 264, 'handheld-terminal', 0], [181, 264, 'barcode-scanner', 2],
    [185, 264, 'badge', 0], [189, 264, 'invoice', 1], [193, 264, 'work-bag', 0], [197, 264, 'box-cutter', 2],
  ]) add(id, u, v, variant, 0, { force: true, radius: 1 });

  // Small public-service buildings are fitted only into clear lots away from the road and mission doors.
  const services = ['pharmacy', 'clinic', 'police-station', 'fire-station', 'school', 'kindergarten', 'post-office', 'pickup-point', 'tire-shop', 'car-wash', 'gas-station'];
  const candidates = [];
  for (let v = 80; v <= 755; v += 21) for (let u = 45; u <= 1620; u += 21) {
    if (!occupied(u, v, 20)) candidates.push({ u, v, score: Math.abs(v - 400) + Math.abs(u - 840) * 0.08 });
  }
  candidates.sort((a, b) => a.score - b.score);
  for (const id of services) {
    const index = candidates.findIndex((p) => !occupied(p.u, p.v, 20));
    if (index < 0) break;
    const p = candidates.splice(index, 1)[0];
    add(id, p.u, p.v, services.indexOf(id) % 3, 0, { radius: 20, solid: true, width: 7.2, height: 4.3, depth: 5.2 });
  }

  // Remaining everyday objects, extra packaging variants, and utility infrastructure.
  for (const [u, v, id, variant] of [
    [168, 280, 'shopping-bag', 0], [173, 280, 'backpack', 1], [178, 280, 'umbrella', 2], [183, 280, 'suitcase', 0],
    [188, 280, 'coffee-cup', 1], [193, 280, 'newspaper', 2], [198, 280, 'parked-bicycle', 0],
    [210, 270, 'pigeon', 0], [215, 270, 'cat', 1], [220, 270, 'dog', 2],
    [170, 300, 'tea-box', 0], [174, 300, 'juice-carton', 1], [178, 300, 'canned-food', 2],
    [182, 300, 'bread', 0], [186, 300, 'apple', 1], [190, 300, 'banana', 2],
    [194, 300, 'household-chemistry', 0], [198, 300, 'tobacco-carton', 1],
    [230, 275, 'electrical-cabinet', 0], [236, 275, 'transformer-hut', 1], [242, 275, 'manhole', 2],
    [248, 275, 'drain-grate', 0], [254, 275, 'fire-hydrant', 1], [260, 275, 'gas-pipe', 2],
    [266, 275, 'power-pole', 0], [272, 275, 'ventilation-grille', 1], [278, 275, 'construction-fence', 2],
    [284, 275, 'rubble-pile', 0], [290, 275, 'waste-skip', 1],
  ]) add(id, u, v, variant, 0, { force: true, radius: 1 });

  // Final instancing pass: preserve model detail while keeping repeated props draw-call efficient.
  const batches = new Map();
  for (const model of sourceGroups) {
    model.updateMatrixWorld(true);
    model.traverse((node) => {
      if (!node.isMesh) return;
      const key = node.geometry.uuid + '/' + (Array.isArray(node.material) ? node.material.map((m) => m.uuid).join(',') : node.material.uuid);
      if (!batches.has(key)) batches.set(key, { geometry: node.geometry, material: node.material, matrices: [] });
      batches.get(key).matrices.push(node.matrixWorld.clone());
    });
    detailRoot.remove(model);
  }
  let instanceCount = 0;
  for (const batch of batches.values()) {
    const mesh = new T.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    mesh.name = 'urban-prop-batch-' + instanceCount;
    batch.matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true;
    detailRoot.add(mesh); instanceCount += batch.matrices.length;
  }

  return {
    root: detailRoot,
    diagnostics: { categories: CATEGORY_DATA.length, catalogModels: URBAN_ASSET_CATALOG.length, placedModels: placed.length, instances: instanceCount, uniqueBatches: batches.size, publicServices: services.length, colliders: colliders.length },
    dispose() { detailRoot.removeFromParent(); context.dispose(); for (const collider of colliders) collider.removeFromParent?.(); },
  };
}
