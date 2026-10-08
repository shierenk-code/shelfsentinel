import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent} from '../public/contract.mjs';
import {occupancy,stockState,createStockTracker,localizedMotion} from '../public/perception.mjs';
import {createServer} from '../server.mjs';
import {recordings} from '../public/recordings.mjs';
const event={type:'shelf_status',shelf_id:'shelf-01',timestamp:'2026-10-07T10:00:00.000Z',state:'full',occupancy:100};
test('Every supported operational event passes the contract',()=>{
  for(const e of [event,{...event,type:'stockout_duration',seconds:9},{...event,type:'shelf_interaction',count:1},{...event,type:'congestion',count:2}]){
    if(e.type!=='shelf_status'){delete e.state;delete e.occupancy;}assert.deepEqual(validateEvent(e),{ok:true});
  }
});
test('Privacy boundary rejects forbidden fields without retaining their values',()=>{
  for(const key of ['frame','face_embedding','pixel_coordinates','appearance','customer_id','metadata','__proto__']){
    const input=JSON.parse(JSON.stringify(event));Object.defineProperty(input,key,{value:'SECRET',enumerable:true});
    const result=validateEvent(input);assert.equal(result.ok,false);assert.equal(result.reason,'FORBIDDEN_FIELD');assert.ok(!JSON.stringify(result).includes('SECRET'));
  }
});
test('Invalid shapes, ranges, timestamps, missing fields and nested payloads fail closed',()=>{
  for(const input of [null,[],1,{}, {...event,type:'toString'}, {...event,type:{}},{...event,occupancy:101},{...event,occupancy:NaN},{...event,occupancy:null},{...event,state:{frame:'secret'}},{...event,timestamp:'yesterday'},{...event,shelf_id:'customer-01'}, {...event,type:'shelf_interaction',count:-1}]) assert.equal(validateEvent(input).ok,false);
  const input={...event};delete input.timestamp;assert.equal(validateEvent(input).ok,false);
});
test('Calibration identifies full, partial and empty shelf plus insufficient references',()=>{
  const empty=Array(54).fill(20),full=Array(54).fill(200),partial=[...Array(18).fill(200),...Array(36).fill(20)];
  assert.equal(occupancy(full,empty,full).percent,100);assert.equal(occupancy(empty,empty,full).percent,0);assert.equal(occupancy(partial,empty,full).percent,33);
  assert.equal(stockState(0),'empty');assert.equal(stockState(33),'low');assert.equal(stockState(100),'full');
  assert.throws(()=>occupancy(full,full,full));
});
test('Occlusion withholds a stock judgment while modest lighting change remains readable',()=>{
  const empty=Array(54).fill(20),full=Array(54).fill(200);
  const occluded=[...Array(24).fill(110),...Array(30).fill(200)];
  const blocked=occupancy(occluded,empty,full);
  assert.equal(blocked.reliable,false);assert.equal(blocked.percent,null);
  assert.equal(blocked.tiles.filter(t=>t==='uncertain').length,8);
  const lit=occupancy(Array(54).fill(230),empty,full);
  assert.equal(lit.reliable,true);assert.equal(lit.percent,100);
});
test('Stock state needs three stable observations and uncertainty breaks a pending transition',()=>{
  const tracker=createStockTracker();
  assert.equal(tracker.update('full'),null);
  assert.equal(tracker.update('full'),null);
  assert.equal(tracker.update('full'),'full');
  assert.equal(tracker.update('empty'),'full');
  tracker.uncertain();
  assert.equal(tracker.update('empty'),'full');
  assert.equal(tracker.update('empty'),'full');
  assert.equal(tracker.update('empty'),'empty');
});
test('Interaction proxy ignores changes across most of the shelf',()=>{
  const before=Array(54).fill(20),local=[...before],global=Array(54).fill(100);
  local[0]=100;local[1]=100;local[2]=100;
  assert.equal(localizedMotion(local,before),true);
  assert.equal(localizedMotion(global,before),false);
});
test('Receiver rejects bypasses and stores only approved events and reason-only audits',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const post=body=>fetch(base+'/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await post(event)).status,200);
    assert.equal((await post({...event,face_embedding:['PRIVATE']})).status,422);
    assert.equal((await post({...event,frame:'PRIVATE'.repeat(1000)})).status,413);
    assert.equal((await fetch(base+'/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:'bad'})).status,400);
    assert.equal((await fetch(base+'/api/events',{method:'POST',headers:{'Origin':'https://example.com','Content-Type':'application/json'},body:JSON.stringify(event)})).status,403);
    const state=await (await fetch(base+'/api/dashboard')).json();assert.equal(state.accepted,1);assert.equal(state.blocked,3);assert.equal(state.events.length,1);assert.ok(!JSON.stringify(state).includes('PRIVATE'));
    await fetch(base+'/api/reset',{method:'POST'});const cleared=await (await fetch(base+'/api/dashboard')).json();assert.equal(cleared.accepted,0);assert.equal(cleared.events.length,0);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('Low stock opens a staff task; acknowledgement and replenishment measure response',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const post=body=>fetch(base+'/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await post({...event,state:'low',occupancy:33})).status,200);
    let state=await (await fetch(base+'/api/dashboard')).json();
    assert.equal(state.alert.severity,'low');assert.equal(state.alert.acknowledgedAt,null);
    assert.equal((await fetch(base+'/api/acknowledge',{method:'POST'})).status,200);
    assert.equal((await fetch(base+'/api/acknowledge',{method:'POST'})).status,409);
    assert.equal((await fetch(base+'/api/acknowledge',{method:'POST',body:'PRIVATE'})).status,413);
    assert.equal((await post({...event,state:'empty',occupancy:0})).status,200);
    state=await (await fetch(base+'/api/dashboard')).json();assert.equal(state.alert.severity,'empty');
    assert.equal((await post(event)).status,200);
    state=await (await fetch(base+'/api/dashboard')).json();
    assert.equal(state.alert,null);assert.equal(state.metrics.alertsResolved,1);
    assert.ok(Number.isInteger(state.metrics.lastResponseSeconds));
    assert.ok(!JSON.stringify(state).includes('PRIVATE'));
    assert.equal((await fetch(base+'/api/acknowledge',{method:'POST'})).status,409);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Available local recordings are listed and served by exact name with seeking',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    assert.equal(recordings.length,10);
    const listed=(await (await fetch(base+'/api/recordings')).json()).available;
    assert.ok(Array.isArray(listed));
    for(const item of recordings.filter(entry=>listed.includes(entry.id))){
      const response=await fetch(base+'/recordings/'+item.file,{headers:{Range:'bytes=0-15'}});
      assert.equal(response.status,206,item.file);
      assert.equal(response.headers.get('content-type'),'video/mp4');
      assert.match(response.headers.get('content-range'),/^bytes 0-15\/\d+$/);
      assert.equal((await response.arrayBuffer()).byteLength,16);
    }
    assert.equal((await fetch(base+'/recordings/unknown.mp4')).status,404);
    if(listed.includes('clip-03'))assert.equal((await fetch(base+'/recordings/clip-03.mp4',{headers:{Range:'bytes=999999999-'}})).status,416);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
