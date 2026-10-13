import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages,appendMessages} from '../src/app/chat-messages.js';

test('history overlap preserves order and first message without duplicates',()=>{
  const older={id:'a',text:'older'},overlap={id:'b',text:'history'};
  assert.deepEqual(mergeMessages([older,overlap],[{id:'b',text:'latest'},{id:'c',text:'new'}]),[older,overlap,{id:'c',text:'new'}]);
  assert.deepEqual(mergeMessages([],[]),[]);
});

test('new messages append in server order and an empty poll keeps the same list',()=>{
  const a={id:'a',created_at:'2026-01-01T00:00:01.000Z'},c={id:'c',created_at:'2026-01-01T00:00:03.000Z'};
  const current=[a,c];assert.equal(appendMessages(current,[a,c]),current);
  const late={id:'b',created_at:'2026-01-01T00:00:02.000Z'},d={id:'d',created_at:'2026-01-01T00:00:03.000Z'};
  assert.deepEqual(appendMessages(current,[c,late,d]).map(m=>m.id),['a','b','c','d']);
});
