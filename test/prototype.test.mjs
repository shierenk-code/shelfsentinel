import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEvent} from '../public/contract.mjs';
import {occupancy,stockState} from '../public/perception.mjs';
import {createServer} from '../server.mjs';
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
