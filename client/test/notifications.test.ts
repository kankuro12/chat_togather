import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isChoiceNotification} from '../src/app/notification-data.js';

test('reading Chat preserves direct, FCM-wrapped and Android-tagged choice notifications',()=>{
  const delivered=[
    {id:'native',tag:'choice:decision-1'},
    {id:'direct',data:{page:'choices'}},
    {id:'web',data:{FCM_MSG:{data:{kind:'choice'}}}},
    {id:'chat',tag:'message-1',data:{page:'chat',kind:'message'}},
  ];
  assert.deepEqual(delivered.filter(item=>!isChoiceNotification(item)).map(item=>item.id),['chat']);
});
