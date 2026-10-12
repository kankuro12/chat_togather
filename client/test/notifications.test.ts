import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isChoiceNotification,isCallNotification,notificationDetails,callNotificationDetails} from '../src/app/notification-data.js';

test('reading Chat preserves direct, FCM-wrapped and Android-tagged choice notifications',()=>{
  const delivered=[
    {id:'native',tag:'choice:decision-1'},
    {id:'direct',data:{page:'choices'}},
    {id:'web',data:{FCM_MSG:{data:{kind:'choice'}}}},
    {id:'chat',tag:'message-1',data:{page:'chat',kind:'message'}},
  ];
  assert.deepEqual(delivered.filter(item=>!isChoiceNotification(item)).map(item=>item.id),['chat']);
});

test('each event has distinct stable tag, duplicate retries reuse original notification',()=>{
  assert.equal(notificationDetails({kind:'message',event:'one'}).tag,'chat:one');
  assert.equal(notificationDetails({kind:'message',event:'two'}).tag,'chat:two');
  assert.equal(notificationDetails({kind:'choice',event:'one'}).tag,'choice:one');
  assert.equal(notificationDetails({kind:'choice',event:'one'}).data.page,'choices');
});

test('call alerts preserve actions and expire; chat clearing preserves wrapped calls',()=>{
  const data={kind:'call',call_id:'call-1',call_kind:'video',caller_name:'Partner',expires_at:String(Date.now()+45000)};
  const call=callNotificationDetails(data)!;
  assert.equal(call.title,'Incoming video call');assert.equal(call.options.tag,'call-1');
  assert.deepEqual((call.options as any).actions.map((action:any)=>action.action),['answer','decline']);
  assert.equal(callNotificationDetails({...data,expires_at:'0'}),undefined);
  assert.equal(callNotificationDetails({...data,expires_at:'invalid'}),undefined);
  assert.equal(isCallNotification({data}),true);
  assert.equal(isCallNotification({data:{FCM_MSG:{data:{kind:'call_cancel'}}}}),true);
});
