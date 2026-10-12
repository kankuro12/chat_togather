import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerPushWorker,activatePushWorker} from '../src/app/push-worker.js';

test('shell startup preserves configured push worker even during concurrent registration',async()=>{
  let registration:any;const scripts:string[]=[];
  const container={getRegistration:async()=>registration,register:async(script:string)=>{scripts.push(script);await Promise.resolve();registration={active:{scriptURL:script},update:async()=>{}};return registration;}} as unknown as ServiceWorkerContainer;
  await Promise.all([registerPushWorker(container,'/firebase-messaging-sw.js?config=firebase'),registerPushWorker(container)]);
  assert.deepEqual(scripts,['/firebase-messaging-sw.js?config=firebase']);
  await activatePushWorker(registration);
});

test('failed worker activation rejects instead of leaving notification toggle stuck',async()=>{
  const worker=new EventTarget() as any;worker.state='installing';worker.postMessage=()=>queueMicrotask(()=>{worker.state='redundant';worker.dispatchEvent(new Event('statechange'));});
  await assert.rejects(activatePushWorker({installing:worker} as ServiceWorkerRegistration),/setup failed/);
});
