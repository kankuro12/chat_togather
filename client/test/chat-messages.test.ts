import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages} from '../src/app/chat-messages.js';

test('history overlap preserves order and first message without duplicates',()=>{
  const older={id:'a',text:'older'},overlap={id:'b',text:'history'};
  assert.deepEqual(mergeMessages([older,overlap],[{id:'b',text:'latest'},{id:'c',text:'new'}]),[older,overlap,{id:'c',text:'new'}]);
  assert.deepEqual(mergeMessages([],[]),[]);
});
