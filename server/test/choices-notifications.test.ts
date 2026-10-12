import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
import {jobQueue} from '../src/jobs.js';
import {pushHandler} from '../src/push-job.js';
import {hash,now} from '../src/context.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');

async function pair(){
  const uploadDir=mkdtempSync(join(tmpdir(),'choice-test-'));const app=await createApp({databasePath:':memory:',uploadDir,origins:[]});const api=request(app.server);
  const alice=(await api.post('/api/auth/register').send({name:'Alice',email:`a-${randomUUID()}@test.invalid`,password:'safe-password-123'})).body;
  const bob=(await api.post('/api/auth/register').send({name:'Bob',email:`b-${randomUUID()}@test.invalid`,password:'safe-password-123'})).body;
  const auth=(u:any)=>({Authorization:'Bearer '+u.token});const invite=await api.post('/api/pair/invite').set(auth(alice)).send({});
  assert.equal((await api.post('/api/pair/join').set(auth(bob)).send({code:invite.body.code})).status,200);
  return {app,api,alice,bob,auth,uploadDir};
}

test('choice push uses decision event and preserves answered events until delivery',async()=>{
  const {app,api,alice,bob,auth,uploadDir}=await pair();
  try{
    const upload=await api.post('/api/media?purpose=choice').set(auth(alice)).attach('file',png,{filename:'choice.png',contentType:'image/png'});assert.equal(upload.status,201);
    await api.post('/api/notifications/token').set(auth(alice)).send({token:'creator-device-token-1234567890'});
    await api.post('/api/notifications/token').set(auth(bob)).send({token:'choice-device-token-1234567890'});
    await app.db.prepare('INSERT INTO chat_reading VALUES(?,?)').run(hash(bob.token),Date.now()+60000);
    const decision=await api.post('/api/decisions').set(auth(alice)).send({title:'Pick',mode:'choose',options:[{label:'One',media_id:upload.body.id},{label:'Two',media_id:upload.body.id}]});assert.equal(decision.status,201);
    const jobs=await app.db.prepare("SELECT payload FROM jobs WHERE type='push'").all() as any[];const payload=jobs.map(row=>JSON.parse(row.payload)).find(value=>value.kind==='choice');
    assert.ok(payload,'choice job must exist');assert.equal(payload.message,decision.body.id);assert.equal(payload.event,decision.body.id);
    const sent:any[]=[];const run=jobQueue(app.db);const handler=pushHandler(app.db,async(tokens,kind,event)=>{sent.push({tokens,kind,event});return [];});
    assert.equal(await run.runOne({push:handler}),true);assert.deepEqual(sent,[{tokens:['choice-device-token-1234567890'],kind:'choice',event:decision.body.id}]);
    await api.post('/api/decisions/'+decision.body.id+'/vote').set(auth(bob)).send({option_id:decision.body.options[0].id});
    const voteJobs=await app.db.prepare("SELECT payload FROM jobs WHERE type='push' AND state='queued'").all() as any[];assert.ok(voteJobs.map(row=>JSON.parse(row.payload)).some(value=>value.kind==='message'),'vote notification must remain a message job');assert.equal(await run.runOne({push:handler}),true);assert.equal(sent.at(-1)?.kind,'message');
    await run.enqueue('push',{token:'choice-device-token-1234567890',couple:decision.body.couple_id,kind:'choice',message:decision.body.id,event:decision.body.id},'answered-choice');
    assert.equal(await run.runOne({push:handler}),true);assert.equal(sent.length,3);
    await run.enqueue('push',{token:'choice-device-token-1234567890',couple:randomUUID(),kind:'choice',message:decision.body.id,event:decision.body.id},'wrong-couple');
    assert.equal(await run.runOne({push:handler}),true);assert.equal(sent.length,3);
    const rated=await api.post('/api/decisions').set(auth(alice)).send({title:'Rate',mode:'rate',options:[{media_id:upload.body.id},{media_id:upload.body.id}]});
    for(const row of await app.db.prepare("SELECT id,payload FROM jobs WHERE type='push' AND state='queued'").all() as any[]){if(JSON.parse(row.payload).kind==='choice'&&JSON.parse(row.payload).event===rated.body.id)await app.db.prepare('DELETE FROM jobs WHERE id=?').run(row.id);}
    await api.post('/api/decisions/'+rated.body.id+'/vote').set(auth(bob)).send({option_id:rated.body.options[0].id,rating:4});assert.equal(await run.runOne({push:handler}),true);
    await api.post('/api/decisions/'+rated.body.id+'/vote').set(auth(bob)).send({option_id:rated.body.options[1].id,rating:5});assert.equal(await run.runOne({push:handler}),true);
    await run.enqueue('push',{token:'choice-device-token-1234567890',couple:rated.body.couple_id,kind:'choice',message:rated.body.id,event:rated.body.id},'rated-choice');
    assert.equal(await run.runOne({push:handler}),true);assert.equal(sent.length,6);
    await api.post('/api/auth/logout').set(auth(bob)).send({});
    await run.enqueue('push',{token:'choice-device-token-1234567890',couple:decision.body.couple_id,kind:'choice',message:decision.body.id,event:decision.body.id},'invalid-session');
    assert.equal(await run.runOne({push:handler}),true);assert.equal(sent.length,6);
  }finally{await new Promise<void>(resolve=>app.io.close(()=>resolve()));await app.storage.close();await app.db.close();rmSync(uploadDir,{recursive:true,force:true});}
});

test('pending choice badge tracks choose and rate completion without list or read side effects',async()=>{
  const {app,api,alice,bob,auth,uploadDir}=await pair();
  try{
    const upload=await api.post('/api/media?purpose=choice').set(auth(alice)).attach('file',png,{filename:'choice.png',contentType:'image/png'});assert.equal(upload.status,201);
    const choose=await api.post('/api/decisions').set(auth(alice)).send({title:'Choose',mode:'choose',options:[{media_id:upload.body.id},{media_id:upload.body.id}]});assert.equal(choose.status,201);
    const rate=await api.post('/api/decisions').set(auth(alice)).send({title:'Rate',mode:'rate',options:[{media_id:upload.body.id},{media_id:upload.body.id}]});assert.equal(rate.status,201);
    const own=await api.post('/api/decisions').set(auth(bob)).send({title:'Own',mode:'choose',options:[{media_id:upload.body.id},{media_id:upload.body.id}]});assert.equal(own.status,201);
    const extra=101;const couple=(await app.db.prepare('SELECT couple_id FROM memberships WHERE user_id=?').get(alice.user.id) as any).couple_id;
    for(let i=0;i<extra;i++){
      const decisionId=randomUUID(),optionA=randomUUID(),optionB=randomUUID(),created=now();
      await app.db.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?)').run(decisionId,couple,alice.user.id,'Extra '+i,'choose',created);
      await app.db.prepare('INSERT INTO decision_options VALUES(?,?,?,?,?)').run(optionA,decisionId,'One',upload.body.id,0);
      await app.db.prepare('INSERT INTO decision_options VALUES(?,?,?,?,?)').run(optionB,decisionId,'Two',upload.body.id,1);
    }
    let pending=await api.get('/api/decisions/pending').set(auth(bob));assert.equal(pending.status,200);assert.equal(pending.body.count,103);assert.ok(pending.body.count>100);
    assert.equal((await api.get('/api/decisions').set(auth(bob))).status,200);
    assert.equal((await api.get('/api/decisions/'+choose.body.id).set(auth(bob))).status,200);
    const message=await api.post('/api/messages').set(auth(alice)).send({text:'Read marker',client_id:'pending-read'});await api.post('/api/messages/read').set(auth(bob)).send({message_id:message.body.id});
    pending=await api.get('/api/decisions/pending').set(auth(bob));assert.equal(pending.body.count,103);
    assert.equal((await api.post('/api/decisions/'+choose.body.id+'/vote').set(auth(bob)).send({option_id:choose.body.options[0].id})).status,200);
    pending=await api.get('/api/decisions/pending').set(auth(bob));assert.equal(pending.body.count,102);
    assert.equal((await api.post('/api/decisions/'+rate.body.id+'/vote').set(auth(bob)).send({option_id:rate.body.options[0].id,rating:4})).status,200);
    pending=await api.get('/api/decisions/pending').set(auth(bob));assert.equal(pending.body.count,102);
    await api.post('/api/decisions/'+rate.body.id+'/vote').set(auth(bob)).send({option_id:rate.body.options[1].id,rating:5});
    pending=await api.get('/api/decisions/pending').set(auth(bob));assert.equal(pending.body.count,101);
    assert.equal((await api.get('/api/decisions/pending').set(auth(alice))).body.count,1);
    assert.equal((await api.get('/api/decisions/pending')).status,401);
    const outsider=(await api.post('/api/auth/register').send({name:'Outsider',email:`o-${randomUUID()}@test.invalid`,password:'safe-password-123'})).body;
    assert.equal((await api.get('/api/decisions/pending').set(auth(outsider))).status,403);
  }finally{await new Promise<void>(resolve=>app.io.close(()=>resolve()));await app.storage.close();await app.db.close();rmSync(uploadDir,{recursive:true,force:true});}
});
