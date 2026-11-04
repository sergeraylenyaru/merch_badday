import {SHOPS} from '../state.js';
export const TARGET_COLOR='#ffbd45';
export function navigationTarget(state,world){
 if(state.mapTarget){const target=state.mapTarget;if(target.id==='vendor:dima'){const live=world?.vendors?.markers().find(s=>s.id==='dima');if(live)return {...target,...live,id:target.id};}return target;}
 for(const [layer,source,color]of [['vendors',world?.vendors,'#55b9ee'],['sideWork',world?.sideWork,'#79df9d'],['adventure',world?.adventure,'#c49aff']]){const p=source?.target();if(p)return {...p,id:layer==='vendors'?'vendor:'+p.id:p.id,layer,color};}
 const home=world?.homeTarget?.();if(home)return {...home,id:'home-car',color:TARGET_COLOR,layer:'home'};
 if(state.awaitingShopChoice)return null;
 const shop=SHOPS[state.selected],job=world?.jobs?.targetFor(shop.id);return {...shop,...job,id:'shop:'+shop.id,shop:shop.id,label:job?.label??shop.code+' · '+shop.name,color:TARGET_COLOR,layer:'shops'};
}
