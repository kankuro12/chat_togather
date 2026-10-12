import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {Redis} from 'ioredis';
import {Queue,Worker} from 'bullmq';
import {io as connect} from 'socket.io-client';
import {createApp} from '../src/app.js';
import {hash} from '../src/context.js';
import {pushHandler} from '../src/push-job.js';

test('unsupported storage driver is rejected before opening the app',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'together-storage-'));
  try{await assert.rejects(()=>createApp({databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[],storage:{driver:'invalid'}} as any),/STORAGE_DRIVER/);}
  finally{rmSync(dir,{recursive:true,force:true});}
});

const redisUrl=process.env.TEST_REDIS_URL;
test('Redis sessions survive app restart, expire and revoke without SQL session rows',{skip:!redisUrl},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'together-redis-')),prefix='test-'+randomUUID();
  const options={databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[],storage:{driver:'redis',redisUrl,prefix}};
  let system=await createApp(options as any) as any;
  const redis=new Redis(redisUrl!);
  async function close(){await new Promise<void>(resolve=>system.io.close(()=>resolve()));await system.storage?.close();await system.db.close();}
  try{
    assert.ok(system.storage,'app must expose selected storage');await system.storage.ready();
    let api=request(system.server);
    const registered=await api.post('/api/auth/register').send({name:'Redis user',email:'redis@example.com',password:'safe-password-123'});
    assert.equal(registered.status,201);const token=registered.body.token,auth={Authorization:'Bearer '+token};
    assert.equal((await system.db.prepare('SELECT count(*) AS n FROM sessions').get()).n,0);
    assert.equal((await api.get('/api/auth/me').set(auth)).status,200);
    await close();system=await createApp(options as any) as any;await system.storage.ready();api=request(system.server);
    assert.equal((await api.get('/api/auth/me').set(auth)).status,200);
    assert.equal((await api.post('/api/auth/logout').set(auth)).status,200);
    assert.equal((await api.get('/api/auth/me').set(auth)).status,401);
    const login=await api.post('/api/auth/login').send({email:'redis@example.com',password:'safe-password-123'});
    assert.equal(login.status,200);await redis.pexpire(prefix+':session:'+hash(login.body.token),1);
    await new Promise(resolve=>setTimeout(resolve,15));
    assert.equal((await api.get('/api/auth/me').set({Authorization:'Bearer '+login.body.token})).status,401);
  }finally{
    await close();const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);await redis.quit();rmSync(dir,{recursive:true,force:true});
  }
});

test('Redis queue deduplicates, preserves jobs on restart, retries and prevents double claims',{skip:!redisUrl},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'together-redis-jobs-')),prefix='test-'+randomUUID();
  const options={databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[],storage:{driver:'redis',redisUrl,prefix}};
  let system=await createApp(options as any) as any;
  const redis=new Redis(redisUrl!);
  async function close(){await new Promise<void>(resolve=>system.io.close(()=>resolve()));await system.storage?.close();await system.db.close();}
  try{
    assert.ok(system.storage,'app must expose selected storage');await system.storage.ready();
    await system.storage.queue.enqueue('work',{value:7},'same:key',0);
    await system.storage.queue.enqueue('work',{value:8},'same:key',0);
    if(await system.db.prepare("SELECT 1 FROM sqlite_master WHERE name='jobs'").get())assert.equal((await system.db.prepare('SELECT count(*) AS n FROM jobs').get()).n,0);
    await close();system=await createApp(options as any) as any;await system.storage.ready();
    let attempts=0;assert.equal(await system.storage.queue.runOne({work:async(payload:any,progress:any)=>{assert.equal(payload.value,7);await progress(40);attempts++;throw new Error('private failure');}}),true);
    const failed=(await system.storage.queue.status()).jobs[0];assert.equal(failed.progress,40);assert.equal(failed.attempts,1);assert.ok(!JSON.stringify(failed).includes('private failure'));
    assert.equal(await system.storage.queue.runOne({work:async()=>{attempts++;}}),false);
    await new Promise(resolve=>setTimeout(resolve,2100));
    assert.equal(await system.storage.queue.runOne({work:async()=>{attempts++;}}),true);assert.equal(attempts,2);
    assert.equal((await system.storage.queue.status()).jobs[0].state,'done');
    await system.storage.queue.enqueue('work',{},'locked',0);
    let finish!:()=>void;const entered=new Promise<void>(resolve=>{finish=resolve;});let release!:()=>void;
    const active=system.storage.queue.runOne({work:async()=>{finish();await new Promise<void>(resolve=>{release=resolve;});}});
    await entered;
    assert.equal(await system.storage.queue.runOne({work:async()=>assert.fail('duplicate claim')}),false);release();await active;
  }finally{
    await close();const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);await redis.quit();rmSync(dir,{recursive:true,force:true});
  }
});

test('Redis auth supports phone login, sockets and push; revoked sessions cannot receive queued push',{skip:!redisUrl},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'together-redis-push-')),prefix='test-'+randomUUID();
  const system=await createApp({databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[],auth:{phoneTestMode:true},storage:{driver:'redis',redisUrl,prefix}});
  const redis=new Redis(redisUrl!),api=request(system.server);let socket:ReturnType<typeof connect>|undefined;
  try{
    await system.storage.ready();await new Promise<void>(resolve=>system.server.listen(0,'127.0.0.1',resolve));
    const a=(await api.post('/api/auth/register').send({name:'Alice',email:'alice@example.com',password:'safe-password-123'})).body;
    const challenge=(await api.post('/api/auth/phone/send').send({phone:'9800000000',name:'Bob'})).body.challenge;
    const phone=await api.post('/api/auth/phone/verify').send({challenge,code:'123456'});assert.equal(phone.status,200);const b=phone.body;
    const aa={Authorization:'Bearer '+a.token},bb={Authorization:'Bearer '+b.token};
    const invite=(await api.post('/api/pair/invite').set(aa)).body;
    assert.equal((await api.post('/api/pair/join').set(bb).send({code:invite.code})).status,200);
    assert.equal((await api.post('/api/notifications/token').set(bb).send({token:'device-token-1234567890'})).status,200);
    const address=system.server.address() as {port:number};
    socket=connect('http://127.0.0.1:'+address.port,{auth:{token:b.token},transports:['websocket'],reconnection:false});
    await new Promise<void>((resolve,reject)=>{socket!.once('connect',resolve);socket!.once('connect_error',reject);});
    assert.equal((await api.post('/api/messages').set(aa).send({text:'Hello',client_id:'redis-message-1'})).status,201);
    const deliveries:string[][]=[];
    const handler=pushHandler(system.db,async tokens=>{deliveries.push(tokens);return [];},system.storage.sessions);
    assert.equal(await system.storage.queue.runOne({push:handler}),true);assert.deepEqual(deliveries,[['device-token-1234567890']]);
    assert.equal((await api.post('/api/messages').set(aa).send({text:'Queued before revoke',client_id:'redis-message-2'})).status,201);
    await system.storage.sessions.delete(hash(b.token));
    assert.equal(await system.storage.queue.runOne({push:handler}),true);assert.equal(deliveries.length,1);
    assert.equal((await api.get('/api/auth/me').set(bb)).status,401);
    const disconnected=new Promise<void>(resolve=>socket!.once('disconnect',()=>resolve()));socket.emit('typing',true);await disconnected;
  }finally{
    socket?.disconnect();await new Promise<void>(resolve=>system.io.close(()=>resolve()));await system.storage.close();await system.db.close();
    const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);await redis.quit();rmSync(dir,{recursive:true,force:true});
  }
});

test('Redis queue recovers expired leases and stops after five failed deliveries',{skip:!redisUrl},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'together-redis-recovery-')),prefix='test-'+randomUUID();
  const system=await createApp({databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[],storage:{driver:'redis',redisUrl,prefix}});
  const redis=new Redis(redisUrl!),connection=redis.duplicate({maxRetriesPerRequest:null});
  const raw=new Queue('jobs',{connection:redis,prefix});
  const crashed=new Worker('jobs',null,{connection,prefix});
  try{
    await system.storage.ready();await system.storage.queue.enqueue('work',{},'crashed',0);
    const job=await crashed.getNextJob('dead',{block:false});assert.ok(job);
    await redis.del(prefix+':jobs:'+job.id+':lock');await redis.sadd(prefix+':jobs:stalled',job.id!);await crashed.close();
    let recovered=false;
    for(let i=0;i<20&&!recovered;i++){recovered=await system.storage.queue.runOne({work:async()=>{}});if(!recovered)await new Promise(resolve=>setTimeout(resolve,100));}
    assert.equal(recovered,true);assert.equal((await system.storage.queue.status()).jobs[0].state,'done');
    await system.storage.queue.enqueue('work',{},'fail',0);let attempts=0;
    for(let i=0;i<5;i++){
      for(const pending of await raw.getJobs(['delayed']))await pending.promote();
      assert.equal(await system.storage.queue.runOne({work:async()=>{attempts++;throw new Error('private failure');}}),true);
    }
    assert.equal(attempts,5);assert.equal((await raw.getJobs(['failed'])).length,1);
    assert.equal(await system.storage.queue.runOne({work:async()=>assert.fail('sixth attempt')}),false);
  }finally{
    await crashed.close();connection.disconnect();await raw.close();await new Promise<void>(resolve=>system.io.close(()=>resolve()));await system.storage.close();await system.db.close();
    const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);await redis.quit();rmSync(dir,{recursive:true,force:true});
  }
});
