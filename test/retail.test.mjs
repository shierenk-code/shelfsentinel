import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneAtPoint,updateTemporaryTracks,shelfRule,visitTransition,safeOutbound} from '../public/retail-core.mjs';
import {validateEvent} from '../public/contract.mjs';
import {createVisitStore} from '../visit-store.mjs';
import {createServer} from '../server.mjs';

test('retail event keeps only approved anonymous fields',()=>{
  const payload=safeOutbound({type:'SHELF_EMPTY',zone:'Shelf A',confidence:.87,value:0,personId:'private',frame:[1,2,3]});
  assert.deepEqual(Object.keys(payload),['type','shelf_id','timestamp','event','zone','confidence','value']);
  assert.deepEqual(validateEvent(payload),{ok:true});
  assert.equal(validateEvent({...payload,personId:'private'}).reason,'FORBIDDEN_FIELD');
});

test('temporary tracks expire and ignore zones take precedence',()=>{
  const zones=[{id:'entrance',type:'entrance',x:0,y:0,w:1,h:1},{id:'ignore',type:'ignore',x:0,y:0,w:.2,h:.2}];
  assert.equal(zoneAtPoint(.1,.1,zones),null);
  const detection={bbox:[200,100,60,100],score:.9};
  const first=updateTemporaryTracks(new Map(),[detection],0,zones,1);
  assert.equal(first.tracks.size,1);
  const second=updateTemporaryTracks(first.tracks,[detection],1,zones,first.nextId);
  assert.equal([...second.tracks.keys()][0],[...first.tracks.keys()][0]);
  const expired=updateTemporaryTracks(second.tracks,[],5,zones,second.nextId);
  assert.equal(expired.tracks.size,0);
});

test('shelf rules follow observed transitions',()=>{
  assert.equal(shelfRule(70,20,25),'SHELF_LOW');
  assert.equal(shelfRule(30,10,25),'SHELF_EMPTY');
  assert.equal(shelfRule(20,60,25),'RESTOCK_DETECTED');
  assert.equal(shelfRule(80,50,25),'PRODUCT_REMOVED');
  assert.equal(shelfRule(80,75,25),null);
});

test('visit transitions require a previously observed track and a matching open record',()=>{
  assert.equal(visitTransition(null,'entrance',false,false),null);
  assert.equal(visitTransition(null,'entrance',true,false),'enter');
  assert.equal(visitTransition('entrance','exit',true,true),'exit');
  assert.equal(visitTransition('entrance','exit',true,false),null);
  assert.equal(visitTransition('exit','entrance',true,true),null);
  assert.equal(visitTransition('exit','entrance',true,false),null);
});

test('temporary visit store deletes on exit and expires missed exits',()=>{
  let time=0;const store=createVisitStore({ttlMs:2000,now:()=>time});
  const first=store.open();assert.equal(store.snapshot().activeCount,1);
  assert.equal(store.close(first.visitId),true);assert.equal(store.snapshot().activeCount,0);
  assert.equal(store.snapshot().exited,1);
  store.open();time=2001;assert.equal(store.snapshot().activeCount,0);assert.equal(store.snapshot().expired,1);
});

test('local visit API stores only anonymous token and rejects extra fields',async()=>{
  const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  try{
    let response=await post('/api/visits/open',{type:'visit_open',person_name:'not allowed'});assert.equal(response.status,422);
    response=await post('/api/visits/open',{type:'visit_open'});assert.equal(response.status,200);
    const opened=await response.json();assert.match(opened.visitId,/^[0-9a-f-]{36}$/);
    const active=await (await fetch(base+'/api/visits')).json();assert.equal(active.activeCount,1);assert.deepEqual(Object.keys(active.active[0]),['visitId','enteredAt']);
    response=await post('/api/visits/close',{type:'visit_close',visitId:opened.visitId});assert.equal(response.status,200);
    const closed=await (await fetch(base+'/api/visits')).json();assert.equal(closed.activeCount,0);assert.equal(closed.exited,1);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
