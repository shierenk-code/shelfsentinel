import test from 'node:test';
import assert from 'node:assert/strict';
import {zoneAtPoint,updateTemporaryTracks,shelfRule,safeOutbound} from '../public/retail-core.mjs';
import {validateEvent} from '../public/contract.mjs';

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
