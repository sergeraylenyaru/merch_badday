// Only simulation time counts: menus and pauses never advance either clock.
export function tickHealth(state, dt) {
 const clock=state.adventure.vitals??={rest:0,strain:0};
 if(state.health<=0||dt<=0)return;
 if(state.stress<20){
  clock.strain=0;clock.rest+=dt;
  const points=Math.floor((clock.rest+1e-8)/5);clock.rest-=points*5;
  state.health=Math.min(100,state.health+points);
 }else if(state.stress>80){
  clock.rest=0;clock.strain+=dt;
  const points=Math.floor((clock.strain+1e-8)/10);clock.strain-=points*10;
  state.health=Math.max(0,state.health-points);
 }else{clock.rest=0;clock.strain=0;}
}
