import {randomUUID} from 'node:crypto';

// Process memory only. A row contains no image, coordinates, name or biometric data.
export function createVisitStore({ttlMs=120_000,now=()=>Date.now()}={}){
  const active=new Map();
  let opened=0,exited=0,expired=0;
  function sweep(){const time=now();for(const [id,visit] of active)if(time-visit.enteredAtMs>=ttlMs){active.delete(id);expired++;}}
  return {
    open(){sweep();const id=randomUUID(),enteredAtMs=now();active.set(id,{enteredAtMs});opened++;return {visitId:id,enteredAt:new Date(enteredAtMs).toISOString()};},
    close(id){sweep();if(!active.delete(id))return false;exited++;return true;},
    clear(){active.clear();opened=0;exited=0;expired=0;},
    snapshot(){sweep();return {activeCount:active.size,opened,exited,expired,ttlSeconds:Math.round(ttlMs/1000),active:[...active].map(([visitId,visit])=>({visitId,enteredAt:new Date(visit.enteredAtMs).toISOString()}))};}
  };
}
