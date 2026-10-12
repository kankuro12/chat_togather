import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createConnection} from 'mysql2/promise';
import request from 'supertest';
import {openDatabase} from '../src/db.js';
import {createApp} from '../src/app.js';
import {jobQueue} from '../src/jobs.js';
import {Redis} from 'ioredis';
import {pushHandler} from '../src/push-job.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');

const mysqlUrl=process.env.TEST_MYSQL_URL;
async function fixture(){
  const url=new URL(mysqlUrl!),name='together_test_'+randomUUID().replaceAll('-','');url.pathname='';
  const admin=await createConnection(url.toString());await admin.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');url.pathname='/'+name;
  const uploadDir=mkdtempSync(join(tmpdir(),'together-mysql-uploads-'));
  return {options:{driver:'mysql',url:url.toString()},uploadDir,close:async()=>{assert.match(name,/^together_test_[a-f0-9]{32}$/);await admin.query('DROP DATABASE `'+name+'`');await admin.end();rmSync(uploadDir,{recursive:true,force:true});}};
}

test('MySQL records work with Redis sessions and push queue',{skip:!mysqlUrl||!process.env.TEST_REDIS_URL},async()=>{
  const f=await fixture(),prefix='test-'+randomUUID(),redis=new Redis(process.env.TEST_REDIS_URL!);let s:any;
  try{
    s=await createApp({database:f.options,uploadDir:f.uploadDir,origins:[],storage:{driver:'redis',redisUrl:process.env.TEST_REDIS_URL,prefix}});await s.storage.ready();const api=request(s.server);
    const users:any[]=[];for(const name of ['RedisAlice','RedisBob']){const response=await api.post('/api/auth/register').send({name,email:name+'@example.com',password:'safe-password-123'});assert.equal(response.status,201);users.push(response.body);}
    const auth=(i:number)=>({Authorization:'Bearer '+users[i].token});
    const invite=await api.post('/api/pair/invite').set(auth(0));assert.equal((await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code})).status,200);
    assert.equal((await api.post('/api/notifications/token').set(auth(1)).send({token:'mysql-redis-device-1234567890'})).status,200);
    assert.equal((await api.post('/api/messages').set(auth(0)).send({text:'Mixed storage',client_id:'mixed'})).status,201);
    const sent:string[][]=[];
    assert.equal(await s.storage.queue.runOne({push:pushHandler(s.db,async tokens=>{sent.push(tokens);return [];},s.storage.sessions)}),true);
    assert.deepEqual(sent,[['mysql-redis-device-1234567890']]);assert.equal((await s.db.prepare('SELECT count(*) AS n FROM sessions').get()).n,0);assert.equal((await s.db.prepare('SELECT count(*) AS n FROM jobs').get()).n,0);
    assert.equal((await api.post('/api/auth/logout').set(auth(1))).status,200);assert.equal((await api.get('/api/auth/me').set(auth(1))).status,401);
  }finally{if(s){await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.storage.close();await s.db.close();}const keys=await redis.keys(prefix+':*');if(keys.length)await redis.del(...keys);await redis.quit();await f.close();}
});

test('MySQL transactions isolate concurrent work and roll back partial writes',{skip:!mysqlUrl},async()=>{
  const f=await fixture();let db:any;
  try{
    db=await openDatabase(f.options as any);
    await assert.rejects(db.transaction(async()=>{await db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('rollback','Name','rollback@example.com','hash','2026-10-12T00:00:00.000Z');throw new Error('rollback');}),/rollback/);
    assert.equal(await db.prepare('SELECT id FROM users WHERE id=?').get('rollback'),undefined);
    await Promise.all(['a','b'].map(user=>db.transaction(async()=>{await db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run(user,user,user+'@example.com','hash','2026-10-12T00:00:00.000Z');await new Promise(resolve=>setTimeout(resolve,20));assert.equal((await db.prepare('SELECT id FROM users WHERE id=?').get(user)).id,user);}))); 
    assert.equal((await db.prepare('SELECT count(*) AS n FROM users').get()).n,2);
  }finally{await db?.close();await f.close();}
});

test('MySQL app persists pairing, messages, plans and long push tokens',{skip:!mysqlUrl},async()=>{
  const f=await fixture();let s:any;
  try{
    s=await createApp({database:f.options,uploadDir:f.uploadDir,origins:[]} as any);const api=request(s.server);
    const users:any[]=[];for(const name of ['Alice','Bob']){const response=await api.post('/api/auth/register').send({name,email:name+'@example.com',password:'safe-password-123'});assert.equal(response.status,201);users.push(response.body);}
    const auth=(i:number)=>({Authorization:'Bearer '+users[i].token});
    const invite=await api.post('/api/pair/invite').set(auth(0));assert.equal(invite.status,201);
    assert.equal((await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code})).status,200);
    const longToken='device-'+ 'x'.repeat(4000);
    assert.equal((await api.post('/api/notifications/token').set(auth(1)).send({token:longToken})).status,200);
    assert.equal((await api.post('/api/notifications/token').set(auth(1)).send({token:longToken})).status,200);
    const message=await api.post('/api/messages').set(auth(0)).send({text:'Hello MySQL',client_id:'once'});assert.equal(message.status,201);
    const retries=await Promise.all([0,1].map(()=>api.post('/api/messages').set(auth(0)).send({text:'Concurrent MySQL',client_id:'concurrent'})));
    assert.deepEqual(retries.map(r=>r.status).sort(),[200,201]);assert.equal(retries[0].body.id,retries[1].body.id);
    assert.equal((await api.get('/api/messages').set(auth(1))).body.length,2);
    assert.equal((await api.post('/api/messages/read').set(auth(1)).send({message_id:message.body.id})).status,200);
    const older=await api.post('/api/messages').set(auth(0)).send({text:'Older read target',client_id:'read-older'});assert.equal(older.status,201);
    await new Promise(resolve=>setTimeout(resolve,5));
    const newer=await api.post('/api/messages').set(auth(0)).send({text:'Newest read target',client_id:'read-newer'});assert.equal(newer.status,201);
    for(let round=0;round<4;round++){
      await s.db.prepare('DELETE FROM message_reads WHERE user_id=?').run(users[1].user.id);
      await Promise.all([
        api.post('/api/messages/read').set(auth(1)).send({message_id:older.body.id}),
        api.post('/api/messages/read').set(auth(1)).send({message_id:newer.body.id}),
      ]);
    }
    const readState=await api.get('/api/messages/read-state').set(auth(1));
    const storedRead=await s.db.prepare('SELECT message_id FROM message_reads WHERE user_id=?').get(users[1].user.id) as any;
    assert.ok(readState.body.unread===0||storedRead?.message_id===newer.body.id);
    const plan=await api.post('/api/plans').set(auth(0)).send({title:'Dinner',start_at:'2026-10-15T12:00:00Z',end_at:'2026-10-15T13:00:00Z',timezone:'Asia/Katmandu'});assert.equal(plan.status,201);
    assert.equal((await api.post('/api/plans/'+plan.body.id+'/respond').set(auth(1)).send({response:'yes'})).status,200);
    assert.equal((await api.post('/api/plans/'+plan.body.id+'/respond').set(auth(1)).send({response:'no'})).body.responses[0].response,'no');
    const trip=await api.post('/api/trips').set(auth(0)).send({title:'Trip',destination:'Kathmandu',start_date:'2026-10-15',end_date:'2026-10-16'});assert.equal(trip.status,201);
    assert.equal((await api.post('/api/trips/'+trip.body.id+'/checklist').set(auth(0)).send({title:'First'})).status,201);
    assert.equal((await api.post('/api/trips/'+trip.body.id+'/checklist').set(auth(0)).send({title:'Second'})).status,201);
    assert.deepEqual((await api.get('/api/trips/'+trip.body.id).set(auth(1))).body.checklist.map((i:any)=>i.title),['First','Second']);
    assert.equal((await api.post('/api/auth/logout').set(auth(1))).status,200);
    assert.equal((await api.get('/api/auth/me').set(auth(1))).status,401);
  }finally{if(s){await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.storage.close();await s.db.close();}await f.close();}
});

test('MySQL choice media, voting upsert, and phone OTP single-use work',{skip:!mysqlUrl},async()=>{
  const f=await fixture();let s:any;
  try{
    s=await createApp({database:f.options,uploadDir:f.uploadDir,origins:[],auth:{phoneTestMode:true}} as any);const api=request(s.server);
    const alice=(await api.post('/api/auth/register').send({name:'Alice',email:'choice@example.com',password:'safe-password-123'})).body;
    const bob=(await api.post('/api/auth/register').send({name:'Bob',email:'choice-bob@example.com',password:'safe-password-123'})).body;
    const auth=(token:string)=>({Authorization:'Bearer '+token});
    const invite=await api.post('/api/pair/invite').set(auth(alice.token)).send({});await api.post('/api/pair/join').set(auth(bob.token)).send({code:invite.body.code});
    const upload=await api.post('/api/media?purpose=choice').set(auth(alice.token)).attach('file',png,{filename:'choice.png',contentType:'image/png'});assert.equal(upload.status,201);
    const decision=await api.post('/api/decisions').set(auth(alice.token)).send({title:'Pick one',mode:'choose',options:[{label:'One',media_id:upload.body.id},{label:'Two',media_id:upload.body.id}]});assert.equal(decision.status,201);
    assert.deepEqual((await api.get('/api/messages').set(auth(bob.token))).body[0].choice_images,decision.body.options.map((option:any)=>({id:option.id,media_id:upload.body.id})));
    assert.equal((await api.get('/api/decisions/pending').set(auth(bob.token))).body.count,1);
    const [one,two]=decision.body.options;
    assert.equal((await api.post('/api/decisions/'+decision.body.id+'/vote').set(auth(bob.token)).send({option_id:one.id})).status,200);
    const switched=await api.post('/api/decisions/'+decision.body.id+'/vote').set(auth(bob.token)).send({option_id:two.id});assert.equal(switched.body.votes.length,1);assert.equal(switched.body.votes[0].option_id,two.id);
    assert.equal((await api.get('/api/decisions/pending').set(auth(bob.token))).body.count,0);
    assert.equal((await api.post('/api/decisions/'+decision.body.id+'/vote').set(auth(bob.token)).send({option_id:two.id})).body.votes.length,1);
    const sent=await api.post('/api/auth/phone/send').send({phone:'9800000044',name:'Phone User'});assert.equal(sent.status,200);
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'000000'})).status,400);
    const verified=await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'});assert.equal(verified.status,200);assert.equal(verified.body.user.name,'Phone User');
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'})).status,400);
  }finally{if(s){await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.storage.close();await s.db.close();}await f.close();}
});

test('MySQL Google OAuth enforces PKCE and one-use auth tickets',{skip:!mysqlUrl},async()=>{
  const f=await fixture();let s:any;
  try{
    s=await createApp({database:f.options,uploadDir:f.uploadDir,origins:[],auth:{publicUrl:'http://localhost:3001',appUrl:'http://localhost:4200',googleClientId:'test',googleClientSecret:'test',fetch:async(url:any,init:any)=>{
      const body=new URLSearchParams(init?.body);return Response.json(String(url).endsWith('/token')?{access_token:'provider-token'}:{sub:'mysql-google-person',name:'Maya',email:'maya-mysql@example.com',email_verified:true});
    }}} as any);const agent=request.agent(s.server),api=request(s.server),verifier='a'.repeat(64);
    const start=await agent.post('/api/auth/oauth/google/start').send({verifier});assert.equal(start.status,200);const state=new URL(start.body.url).searchParams.get('state');assert.ok(state);
    const callback=await agent.get('/api/auth/oauth/google/callback?state='+state+'&code=ok');assert.equal(callback.status,302);
    const ticket=new URLSearchParams(new URL(callback.headers.location).hash.slice(1)).get('auth_ticket');assert.ok(ticket);
    assert.equal((await api.post('/api/auth/oauth/exchange').send({ticket,verifier:'b'.repeat(64)})).status,400);
    const exchanged=await api.post('/api/auth/oauth/exchange').send({ticket,verifier});assert.equal(exchanged.status,200);assert.equal(exchanged.body.user.name,'Maya');
    assert.equal((await api.post('/api/auth/oauth/exchange').send({ticket,verifier})).status,400);
  }finally{if(s){await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.storage.close();await s.db.close();}await f.close();}
});

test('MySQL job claims are exclusive and recover expired leases',{skip:!mysqlUrl},async()=>{
  const f=await fixture();let a:any,b:any;
  try{
    a=await openDatabase(f.options as any);b=await openDatabase(f.options as any);const qa=jobQueue(a),qb=jobQueue(b);
    await qa.enqueue('work',{value:7},'same',0);await qb.enqueue('work',{value:8},'same',0);
    let entered!:()=>void,finish!:()=>void;const started=new Promise<void>(resolve=>{entered=resolve;});
    const active=qa.runOne({work:async payload=>{assert.equal(payload.value,7);entered();await new Promise<void>(resolve=>{finish=resolve;});}});
    await started;assert.equal(await qb.runOne({work:async()=>assert.fail('duplicate claim')}),false);finish();await active;
    await qa.enqueue('work',{},'crashed',0);await a.prepare("UPDATE jobs SET state='running',lease_until=0,owner='dead',attempts=1 WHERE id='crashed'").run();
    assert.equal(await qb.runOne({work:async()=>{}}),true);assert.equal((await a.prepare("SELECT state FROM jobs WHERE id='crashed'").get()).state,'done');
  }finally{await a?.close();await b?.close();await f.close();}
});
