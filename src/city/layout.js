export const BOROUGHS = [
 { id:'residential', name:'Спальный район', x:-55, active:[0,1,7], color:'#b49d81' },
 { id:'leisure', name:'Парк и развлечения', x:20, active:[2,6,8], color:'#71a88b' },
 { id:'business', name:'Деловой центр', x:95, active:[3,4,5], color:'#7197ae' },
];
export const LOCAL_SHOPS = [
 {name:'Пекарня у подъезда',x:-106,z:-55,district:0}, {name:'Хозяйственный',x:-106,z:95,district:0},
 {name:'Лавка у парка',x:0,z:140,district:1}, {name:'Сувениры',x:35,z:140,district:1},
 {name:'Деловой экспресс',x:145,z:-55,district:2}, {name:'Канцелярия',x:145,z:95,district:2},
];
export const boroughFor = id => BOROUGHS.find(d=>d.active.includes(id));
