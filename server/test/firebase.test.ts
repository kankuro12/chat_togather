import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildPushMessage} from '../src/firebase.js';

test('push payload keeps web data-only and tags each event',()=>{
  const message=buildPushMessage(['device'],'choice','decision-1');
  assert.deepEqual(message.data,{page:'choices',kind:'choice',event:'decision-1'});
  assert.equal(message.webpush?.headers?.Urgency,'high');
  assert.equal(message.webpush?.notification,undefined);
  assert.equal(message.android?.priority,'high');
  assert.equal(message.android?.notification?.tag,'choice:decision-1');
});

test('call cancel carries data without an alert',()=>{
  const message=buildPushMessage(['device'],'call_cancel','call-1',{id:'call-1',expires:Date.now()+30000,name:'Alice',kind:'audio'});
  assert.equal(message.data?.call_id,'call-1');
  assert.equal(message.android?.notification,undefined);
  assert.equal(message.webpush?.headers?.Urgency,'high');
  assert.equal((message.apns?.payload as {aps:{sound?:string}}).aps.sound,undefined);
  assert.equal(message.apns?.payload?.aps.contentAvailable,true);
  assert.equal(message.apns?.headers?.['apns-push-type'],'background');
});

test('Android incoming calls stay data-only and iOS ordinary events have alerts',()=>{
  const call=buildPushMessage(['device'],'call','call-1',{id:'call-1',expires:Date.now()+30000,name:'Alice',kind:'audio'});
  assert.equal(call.android?.notification,undefined);
  assert.ok(call.android?.ttl);
  const message=buildPushMessage(['device'],'message','message-1');
  assert.deepEqual(message.apns?.payload?.aps.alert,{title:'Together',body:'New message from your partner.'});
});

test('thinking-of-you pushes are data-only on Android so the app can show its own popup',()=>{
  const message=buildPushMessage(['device'],'nudge','nudge-1',undefined,{title:'Asha',body:'💗 Thinking of you'});
  assert.equal(message.android?.notification,undefined);assert.equal(message.android?.priority,'high');
  assert.equal(message.data?.kind,'nudge');assert.equal(message.data?.title,'Asha');assert.equal(message.data?.page,'us');
});
