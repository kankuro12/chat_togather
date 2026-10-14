import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {jobQueue} from '../src/jobs.js';
import {usJobHandlers} from '../src/us-jobs.js';
import {nextOccurrence,zonedTime,questionFor} from '../src/us.js';
import {pushText} from '../src/push-text.js';

async function couple(){
  const dir=mkdtempSync(join(tmpdir(),'together-us-')),s=await createApp({databasePath:':memory:',uploadDir:dir,origins:[]});
  const api=request(s.server),users:any[]=[];
  for(const name of ['Asha','Bikash','Stranger'])users.push((await api.post('/api/auth/register').send({name,email:name+'@us.test',password:'safe-password-123'})).body);
  const auth=(i:number)=>({Authorization:'Bearer '+users[i].token});const invite=await api.post('/api/pair/invite').set(auth(0));await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code});
  const coupleId=(await s.db.prepare('SELECT couple_id FROM memberships WHERE user_id=?').get(users[0].user.id))!.couple_id as string;
  return {s,api,auth,users,coupleId,close:async()=>{await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.db.close();rmSync(dir,{recursive:true,force:true});}};
}
const today=()=>new Date().toISOString().slice(0,10);

test('date helpers: yearly occurrences, leap days and local morning times',()=>{
  assert.equal(nextOccurrence('2020-06-15','2026-06-15',true),'2026-06-15');
  assert.equal(nextOccurrence('2020-06-15','2026-06-16',true),'2027-06-15');
  assert.equal(nextOccurrence('2020-02-29','2026-01-01',true),'2026-02-28');
  assert.equal(nextOccurrence('2026-01-01','2026-06-01',false),null);
  assert.equal(new Date(zonedTime('2026-10-20',9,'Asia/Kathmandu')).toISOString(),'2026-10-20T03:15:00.000Z');
  assert.equal(new Date(zonedTime('2026-07-01',9,'America/New_York')).toISOString(),'2026-07-01T13:00:00.000Z');
  assert.equal(questionFor('couple-a','2026-10-20'),questionFor('couple-a','2026-10-20'));
  assert.notEqual(questionFor('couple-a','2026-10-20'),questionFor('couple-a','2026-10-21'));
});

test('special dates: one "together" date, yearly reminders that repeat and stop when edited',async()=>{
  const {s,api,auth,coupleId,close}=await couple();
  try{
    const together=await api.post('/api/us/dates').set(auth(0)).send({title:'Our first date',date:'2021-03-14',kind:'together',timezone:'Asia/Kathmandu'});assert.equal(together.status,201);
    assert.equal((await api.post('/api/us/dates').set(auth(1)).send({title:'Again',date:'2022-01-01',kind:'together',timezone:'Asia/Kathmandu'})).status,409);
    assert.equal((await api.post('/api/us/dates').set(auth(1)).send({title:'Bad',date:'2022-13-40',kind:'birthday',timezone:'Asia/Kathmandu'})).status,400);
    assert.equal((await api.post('/api/us/dates').set(auth(1)).send({title:'Bad',date:'2022-01-01',kind:'birthday',timezone:'Mars/Base'})).status,400);
    assert.equal((await api.get('/api/us/dates').set(auth(1))).body[0].creator_name,'Asha');
    assert.equal((await api.get('/api/us/dates').set(auth(2))).status,403);
    // Reminder job for the next occurrence at 09:00 Kathmandu time.
    const job=(await s.db.prepare("SELECT payload,run_at FROM jobs WHERE type='date-reminder'").get())!;const payload=JSON.parse(job.payload);
    assert.equal(new Date(Number(job.run_at)).toISOString().slice(11,16),'03:15');
    await api.post('/api/notifications/token').set(auth(1)).send({token:'bikash-device-token-1234567890'});await api.post('/api/notifications/token').set(auth(0)).send({token:'asha-device-token-12345678901'});
    const queue=jobQueue(s.db);const handlers=usJobHandlers(s.db,queue,async(c,exclude,kind,event)=>{for(const row of await s.db.prepare('SELECT p.token FROM push_tokens p JOIN memberships m ON m.user_id=p.user_id WHERE m.couple_id=? AND p.user_id!=?').all(c,exclude))await queue.enqueue('push',{token:row.token,couple:c,kind,event},'push:'+kind+':'+event+':'+row.token);});
    await handlers['date-reminder'](payload);
    const pushes=await s.db.prepare("SELECT payload FROM jobs WHERE type='push'").all();assert.equal(pushes.length,2,'both partners hear about the date');
    const next=await s.db.prepare("SELECT payload FROM jobs WHERE type='date-reminder' ORDER BY run_at DESC").get();assert.equal(JSON.parse(next!.payload).occurrence,String(Number(payload.occurrence.slice(0,4))+1)+payload.occurrence.slice(4));
    const text=await pushText(s.db,coupleId,'date',`${together.body.id}:${payload.occurrence}`,true);const years=Number(payload.occurrence.slice(0,4))-2021;
    assert.deepEqual(text,{title:'🎉 Today: Our first date',body:`${years} years together`});
    assert.deepEqual(await pushText(s.db,coupleId,'date',`${together.body.id}:${payload.occurrence}`,false),{title:'Together',body:'🎉 You have a special date today'});
    // Editing supersedes old reminders.
    await new Promise(r=>setTimeout(r,5));await api.put('/api/us/dates/'+together.body.id).set(auth(1)).send({title:'First date',date:'2021-03-15',kind:'together',timezone:'Asia/Kathmandu'});
    const before=(await s.db.prepare("SELECT count(*) AS n FROM jobs WHERE type='push'").get())!.n;await handlers['date-reminder'](payload);
    assert.equal((await s.db.prepare("SELECT count(*) AS n FROM jobs WHERE type='push'").get())!.n,before);
    assert.equal((await api.delete('/api/us/dates/'+together.body.id).set(auth(2))).status,403);
    assert.equal((await api.delete('/api/us/dates/'+together.body.id).set(auth(1))).status,200);
  }finally{await close();}
});

test('shared lists: add, tick, clear done, delete; strangers cannot touch items',async()=>{
  const {api,auth,close}=await couple();
  try{
    const list=(await api.post('/api/us/lists').set(auth(0)).send({title:'Groceries'})).body;
    for(const title of ['Milk','Eggs','Rice'])await api.post(`/api/us/lists/${list.id}/items`).set(auth(1)).send({title});
    let lists=(await api.get('/api/us/lists').set(auth(0))).body;assert.deepEqual(lists[0].items.map((i:any)=>i.title),['Milk','Eggs','Rice']);
    const eggs=lists[0].items.find((i:any)=>i.title==='Eggs');
    assert.equal((await api.patch('/api/us/items/'+eggs.id).set(auth(2)).send({done:true})).status,403);
    await api.patch('/api/us/items/'+eggs.id).set(auth(0)).send({done:true});
    lists=(await api.get('/api/us/lists').set(auth(1))).body;assert.deepEqual(lists[0].items.map((i:any)=>[i.title,i.done]),[['Milk',false],['Rice',false],['Eggs',true]]);
    await api.post(`/api/us/lists/${list.id}/clear-done`).set(auth(1));assert.equal((await api.get('/api/us/lists').set(auth(0))).body[0].items.length,2);
    await api.delete('/api/us/lists/'+list.id).set(auth(1));assert.deepEqual((await api.get('/api/us/lists').set(auth(0))).body,[]);
  }finally{await close();}
});

test('wishlists: the partner can claim a wish secretly; the wisher never sees claims',async()=>{
  const {api,auth,close}=await couple();
  try{
    await api.post('/api/us/wishes').set(auth(0)).send({title:'Pashmina shawl',link:'https://example.com/shawl',note:'Red please'});
    assert.equal((await api.post('/api/us/wishes').set(auth(0)).send({title:'x',link:'javascript:alert(1)'})).status,400);
    const wish=(await api.get('/api/us/wishes').set(auth(1))).body[0];assert.equal(wish.claimed,false);
    assert.equal((await api.put(`/api/us/wishes/${wish.id}/claim`).set(auth(0)).send({claimed:true})).status,400);
    await api.put(`/api/us/wishes/${wish.id}/claim`).set(auth(1)).send({claimed:true});
    const theirs=(await api.get('/api/us/wishes').set(auth(1))).body[0];assert.equal(theirs.claimed,true);assert.equal(theirs.claimed_by_me,true);
    const mine=(await api.get('/api/us/wishes').set(auth(0))).body[0];assert.equal('claimed' in mine,false);assert.equal('claimed_by' in mine,false);
    assert.equal((await api.delete('/api/us/wishes/'+wish.id).set(auth(1))).status,403);
    assert.equal((await api.delete('/api/us/wishes/'+wish.id).set(auth(0))).status,200);
  }finally{await close();}
});

test('daily question: same question for both, partner answer revealed only after you answer',async()=>{
  const {s,api,auth,coupleId,close}=await couple();
  try{
    const q=(await api.get('/api/us/question?day='+today()).set(auth(0))).body;assert.equal(q.question,(await api.get('/api/us/question?day='+today()).set(auth(1))).body.question);
    assert.equal((await api.get('/api/us/question?day=2001-01-01').set(auth(0))).status,400);
    await api.post('/api/us/question?day='+today()).set(auth(0)).send({answer:'Your laugh'});
    const forBikash=(await api.get('/api/us/question?day='+today()).set(auth(1))).body;assert.equal(forBikash.partner_answered,true);assert.equal(forBikash.partner,null);
    const answered=(await api.post('/api/us/question?day='+today()).set(auth(1)).send({answer:'Momo night'})).body;assert.equal(answered.partner,'Your laugh');
    assert.equal((await api.get('/api/us/question?day='+today()).set(auth(0))).body.partner,'Momo night');
    const history=(await api.get('/api/us/question/history').set(auth(0))).body;assert.equal(history[0].answers.length,2);assert.equal(history[0].question,q.question);
    assert.deepEqual(await pushText(s.db,coupleId,'question',`${today()}:${(await s.db.prepare("SELECT user_id FROM daily_answers WHERE answer='Your laugh'").get())!.user_id}`,true),{title:'Asha',body:'Answered today’s question. Answer yours to see it.'});
  }finally{await close();}
});

test('love notes stay sealed for the partner until they unlock, then notify',async()=>{
  const {s,api,auth,coupleId,close}=await couple();
  try{
    const unlock=new Date(Date.now()+3600000).toISOString();
    assert.equal((await api.post('/api/us/notes').set(auth(0)).send({text:'Past',unlock_at:new Date(Date.now()-1000).toISOString()})).status,400);
    const note=(await api.post('/api/us/notes').set(auth(0)).send({text:'Open on our anniversary ❤️',unlock_at:unlock})).body;
    assert.deepEqual((await api.get('/api/us/notes').set(auth(1))).body,[],'the partner does not even see a sealed note');
    assert.equal((await api.get('/api/us/notes').set(auth(0))).body[0].text,'Open on our anniversary ❤️');
    const job=(await s.db.prepare("SELECT run_at FROM jobs WHERE type='note-unlock'").get())!;assert.equal(Number(job.run_at),Date.parse(unlock));
    await s.db.prepare('UPDATE love_notes SET unlock_at=? WHERE id=?').run(new Date(Date.now()-1000).toISOString(),note.id);
    assert.equal((await api.get('/api/us/notes').set(auth(1))).body[0].text,'Open on our anniversary ❤️');
    const sent:any[]=[];await usJobHandlers(s.db,jobQueue(s.db),async(c,exclude,kind,event)=>{sent.push({c,exclude,kind,event});})['note-unlock']({couple:coupleId,note_id:note.id});
    assert.equal(sent[0].kind,'note');assert.equal(sent[0].exclude,(await s.db.prepare('SELECT user_id FROM love_notes WHERE id=?').get(note.id))!.user_id);
    assert.equal((await api.delete('/api/us/notes/'+note.id).set(auth(1))).status,403);
  }finally{await close();}
});

test('thinking of you reaches the partner, is rate limited, and keeps privacy on the lock screen',async()=>{
  const {s,api,auth,coupleId,close}=await couple();
  try{
    await api.post('/api/notifications/token').set(auth(1)).send({token:'bikash-device-token-1234567890'});
    assert.equal((await api.post('/api/us/nudge').set(auth(0))).status,201);
    const push=JSON.parse((await s.db.prepare("SELECT payload FROM jobs WHERE type='push'").get())!.payload);assert.equal(push.kind,'nudge');
    assert.deepEqual(await pushText(s.db,coupleId,'nudge',push.event,false),{title:'Together',body:'💗 Someone is thinking of you'});
    assert.deepEqual(await pushText(s.db,coupleId,'nudge',push.event,true),{title:'Asha',body:'💗 Thinking of you'});
    await api.post('/api/us/nudge').set(auth(0));await api.post('/api/us/nudge').set(auth(0));assert.equal((await api.post('/api/us/nudge').set(auth(0))).status,429);
    assert.equal((await api.get('/api/us/nudges').set(auth(1))).body[0].name,'Asha');
  }finally{await close();}
});
