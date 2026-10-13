import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/app.js';
import { hash } from '../src/context.js';
import { io as connect, Socket } from 'socket.io-client';
function socketEvent(socket:Socket,event:string):Promise<any[]> {
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{socket.off(event,handler);reject(new Error(`Timed out waiting for ${event}`));},5000);
    const handler=(...args:any[])=>{clearTimeout(timer);resolve(args);};socket.once(event,handler);
  });
}

const dir = mkdtempSync(join(tmpdir(), 'together-'));
const system = await createApp({ databasePath: join(dir, 'test.db'), uploadDir: join(dir, 'uploads'), origins: ['http://localhost:4200'] });
const api = request(system.server);
let a: any, b: any, outsider: any;
async function register(name: string) {
  const res = await api.post('/api/auth/register').send({ name, email: `${name}@example.com`, password: 'safe-password-123' });
  assert.equal(res.status, 201, JSON.stringify(res.body)); return res.body;
}
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
before(async () => { await new Promise<void>(resolve => system.server.listen(0, '127.0.0.1', resolve)); });
after(async () => { await new Promise<void>(resolve => system.io.close(() => resolve())); await system.db.close(); rmSync(dir, {recursive:true,force:true}); });

test('registration validates credentials and prevents duplicate email', async () => {
  assert.equal((await api.post('/api/auth/register').send({name:'A', email:'bad', password:'short'})).status,400);
  a = await register('Alice'); b = await register('Bob'); outsider = await register('Chris');
  assert.equal((await api.post('/api/auth/register').send({ name:'Alice',email:'alice@example.com',password:'safe-password-123'})).status,409);
  assert.equal((await api.post('/api/auth/login').send({email:'alice@example.com',password:'wrong'})).status,401);
  assert.equal((await api.get('/api/auth/me').set(auth(a.token))).body.user.name,'Alice');
});

test('single-use invitation admits only one partner and unpaired users cannot read chat', async () => {
  for(const code of ['', '   ']){
    const invalid=await api.post('/api/pair/join').set(auth(b.token)).send({code});
    assert.equal(invalid.status,400);
    assert.equal(invalid.body.error,'Enter your partner’s invitation code or scan their QR.');
  }
  assert.equal((await api.get('/api/messages').set(auth(a.token))).status,403);
  const invite = await api.post('/api/pair/invite').set(auth(a.token)).send({});
  assert.equal(invite.status,201);
  assert.equal((await api.post('/api/pair/join').set(auth(a.token)).send({code:invite.body.code})).status,400);
  const attempts = await Promise.all([b, outsider].map(u => api.post('/api/pair/join').set(auth(u.token)).send({code:invite.body.code})));
  assert.deepEqual(attempts.map(r=>r.status).sort(), [200,409]);
  if (attempts[1].status===200) [b,outsider]=[outsider,b];
  const me = await api.get('/api/auth/me').set(auth(a.token));
  assert.equal(me.body.pair.members.length,2);
  assert.equal((await api.post('/api/pair/invite').set(auth(a.token)).send({})).status,409);
});

let mediaId:string,decisionId:string,planId:string,tripId:string;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');
test('chat persists messages, deduplicates retries, and denies unpaired users', async()=>{
  const input={text:'Only us',client_id:'first-message'};
  const first=await api.post('/api/messages').set(auth(a.token)).send(input);assert.equal(first.status,201);
  const repeat=await api.post('/api/messages').set(auth(a.token)).send(input);assert.equal(repeat.body.id,first.body.id);
  const history=await api.get('/api/messages').set(auth(b.token));assert.equal(history.body.length,1);assert.equal(history.body[0].text,'Only us');
  assert.equal((await api.post('/api/messages').set(auth(a.token)).send({text:'',client_id:'empty'})).status,400);
  assert.equal((await api.get('/api/messages').set(auth(outsider.token))).status,403);
});

test('message polling returns only recent messages after a known one',async()=>{
  const first=await api.post('/api/messages').set(auth(a.token)).send({text:'poll one',client_id:'poll-1'});
  const second=await api.post('/api/messages').set(auth(b.token)).send({text:'poll two',client_id:'poll-2'});
  const newer=await api.get(`/api/messages?after=${first.body.id}`).set(auth(a.token));assert.equal(newer.status,200);
  assert.ok(newer.body.some((m:any)=>m.id===second.body.id));
  const ids=newer.body.map((m:any)=>m.created_at+m.id);assert.deepEqual(ids,[...ids].sort());
  assert.equal((await api.get(`/api/messages?after=${first.body.id}`).set(auth(outsider.token))).status,403);
});

test('uploads require actual supported media; media is private to pair',async()=>{
  assert.equal((await api.post('/api/media').set(auth(a.token)).attach('file',Buffer.from('fake'),{filename:'dress.png',contentType:'image/png'})).status,400);
  const upload=await api.post('/api/media').set(auth(a.token)).attach('file',png,{filename:'dress.png',contentType:'image/png'});assert.equal(upload.status,201);mediaId=upload.body.id;
  assert.equal((await api.get(`/api/media/${mediaId}`).set(auth(b.token))).status,200);
  assert.equal((await api.get(`/api/media/${mediaId}`)).status,401);
  assert.equal((await api.get(`/api/media/${mediaId}`).set(auth(outsider.token))).status,403);
  const msg=await api.post('/api/messages').set(auth(b.token)).send({text:'Look!',media_id:mediaId,client_id:'media-message'});assert.equal(msg.status,201);
  assert.equal(msg.body.media_mime,'image/png');
});

test('uploads keep a browser-made preview so chats load thumbnails before full media',async()=>{
  const webm=Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d4287810442858102','hex');
  const video=await api.post('/api/media').set(auth(a.token)).attach('file',webm,{filename:'clip.webm',contentType:'video/webm'}).attach('thumb',png,{filename:'clip.png',contentType:'image/png'}).field('duration','12.5').field('width','640').field('height','360');
  assert.equal(video.status,201);assert.equal(video.body.duration,12.5);assert.equal(video.body.width,640);assert.ok(video.body.thumb);
  const thumb=await api.get(`/api/media/${video.body.id}/thumb`).set(auth(b.token));assert.equal(thumb.status,200);assert.equal(thumb.headers['content-type'],'image/png');assert.equal(thumb.headers['cache-control'],'private, max-age=31536000, immutable');assert.equal((await api.get(`/api/media/${video.body.id}`).set(auth(b.token))).headers['cache-control'],'private, no-store');
  assert.equal((await api.get(`/api/media/${video.body.id}/thumb`).set(auth(outsider.token))).status,403);
  assert.equal((await api.get(`/api/media/${mediaId}/thumb`).set(auth(a.token))).status,404);
  const msg=await api.post('/api/messages').set(auth(a.token)).send({text:'',media_id:video.body.id,client_id:'video-preview'});assert.equal(msg.body.media_duration,12.5);assert.ok(msg.body.media_thumb);
  assert.equal((await api.post('/api/media').set(auth(a.token)).attach('file',webm,{filename:'clip.webm',contentType:'video/webm'}).attach('thumb',Buffer.from('fake'),{filename:'t.png',contentType:'image/png'})).status,400);
  assert.equal((await api.post('/api/media').set(auth(a.token)).attach('file',webm,{filename:'clip.webm',contentType:'video/webm'}).field('duration','-1')).status,400);
});

test('choices replace prior selection; ratings enforce bounds and option membership',async()=>{
  const input={title:'Which outfit?',mode:'choose',options:[{label:'Dress',media_id:mediaId},{label:'Shirt',media_id:mediaId}]};
  const created=await api.post('/api/decisions').set(auth(a.token)).send(input);assert.equal(created.status,201);decisionId=created.body.id;
  const [first,second]=created.body.options;
  const shared=(await api.get('/api/messages').set(auth(b.token))).body.find((message:any)=>message.decision_id===decisionId);
  assert.equal(shared.choice_event,'shared');
  assert.equal((await api.get('/api/media').set(auth(a.token))).body.some((media:any)=>media.id===mediaId),false);
  assert.equal((await api.post(`/api/decisions/${decisionId}/vote`).set(auth(b.token)).send({option_id:first.id})).status,200);
  const voted=await api.post(`/api/decisions/${decisionId}/vote`).set(auth(b.token)).send({option_id:second.id});assert.equal(voted.body.votes.length,1);assert.equal(voted.body.votes[0].option_id,second.id);
  const chosen=(await api.get('/api/messages').set(auth(a.token))).body.filter((message:any)=>message.decision_id===decisionId&&message.choice_event==='chosen');
  assert.equal(chosen.length,2);assert.equal(chosen.at(-1).media_id,second.media_id);
  await api.post(`/api/decisions/${decisionId}/vote`).set(auth(b.token)).send({option_id:second.id});
  assert.equal((await api.get('/api/messages').set(auth(a.token))).body.filter((message:any)=>message.decision_id===decisionId&&message.choice_event==='chosen').length,2);
  assert.equal((await api.post(`/api/decisions/${decisionId}/vote`).set(auth(b.token)).send({option_id:'foreign'})).status,400);
  const rating=await api.post('/api/decisions').set(auth(a.token)).send({...input,mode:'rate'});
  assert.equal((await api.post(`/api/decisions/${rating.body.id}/vote`).set(auth(b.token)).send({option_id:rating.body.options[0].id,rating:6})).status,400);
  const good=await api.post(`/api/decisions/${rating.body.id}/vote`).set(auth(b.token)).send({option_id:rating.body.options[0].id,rating:5});assert.equal(good.body.votes[0].rating,5);
  assert.equal((await api.post('/api/decisions').set(auth(a.token)).send({...input,options:input.options.slice(0,1)})).status,400);
  const unlabeledInput={title:'No labels',mode:'choose',client_id:'choice-retry',options:input.options.map((option:any)=>({media_id:option.media_id}))};
  const unlabeled=await api.post('/api/decisions').set(auth(a.token)).send(unlabeledInput);assert.equal(unlabeled.status,201);assert.equal(unlabeled.body.options[0].label,'Image 1');
  const repeated=await api.post('/api/decisions').set(auth(a.token)).send(unlabeledInput);assert.equal(repeated.body.id,unlabeled.body.id);
  assert.equal((await api.get('/api/messages').set(auth(a.token))).body.filter((message:any)=>message.decision_id===unlabeled.body.id).length,1);
  const privateUpload=await api.post('/api/media?purpose=choice').set(auth(a.token)).attach('file',png,{filename:'choice.png',contentType:'image/png'});assert.equal(privateUpload.status,201);
  assert.equal((await api.get('/api/media').set(auth(a.token))).body.some((media:any)=>media.id===privateUpload.body.id),false);
});

test('plans validate instants and timezone; time changes clear confirmations',async()=>{
  const input={title:'Date night',notes:'Bring the chosen dress',location:'Cafe',start_at:'2026-11-02T12:00:00.000Z',end_at:'2026-11-02T13:00:00.000Z',timezone:'Asia/Kathmandu',decision_id:decisionId};
  assert.equal((await api.post('/api/plans').set(auth(a.token)).send({...input,timezone:'invalid'})).status,400);
  assert.equal((await api.post('/api/plans').set(auth(a.token)).send({...input,end_at:input.start_at})).status,400);
  const plan=await api.post('/api/plans').set(auth(a.token)).send(input);assert.equal(plan.status,201);planId=plan.body.id;
  const confirmed=await api.post(`/api/plans/${planId}/respond`).set(auth(b.token)).send({response:'yes'});assert.equal(confirmed.body.responses.length,1);
  const updated=await api.patch(`/api/plans/${planId}`).set(auth(a.token)).send({...input,start_at:'2026-11-02T12:30:00.000Z'});assert.equal(updated.status,200);assert.equal(updated.body.responses.length,0);
  assert.equal((await api.patch(`/api/plans/${planId}`).set(auth(b.token)).send({status:'done'})).body.status,'done');
});

test('trips persist dated itinerary and completion checklist; bounds are enforced',async()=>{
  const trip=await api.post('/api/trips').set(auth(a.token)).send({title:'Our escape',destination:'Pokhara',start_date:'2026-11-01',end_date:'2026-11-04',notes:'Lake days'});assert.equal(trip.status,201);tripId=trip.body.id;
  assert.equal((await api.post(`/api/trips/${tripId}/itinerary`).set(auth(b.token)).send({title:'Boat ride',date:'2026-10-31',time:'10:00',notes:''})).status,400);
  assert.equal((await api.post(`/api/trips/${tripId}/itinerary`).set(auth(b.token)).send({title:'Boat ride',date:'2026-11-02',time:'10:00',notes:''})).status,201);
  const item=await api.post(`/api/trips/${tripId}/checklist`).set(auth(a.token)).send({title:'Camera'});assert.equal(item.status,201);
  assert.equal((await api.patch(`/api/trips/${tripId}/checklist/${item.body.id}`).set(auth(b.token)).send({done:true})).body.done,true);
  const trips=await api.get('/api/trips').set(auth(b.token));assert.equal(trips.body[0].itinerary.length,1);assert.equal(trips.body[0].checklist[0].done,true);
  assert.equal((await api.patch(`/api/trips/${tripId}`).set(auth(a.token)).send({end_date:'2026-11-01'})).status,400);
});

test('second couple cannot read or mutate first couple resources or receive its sockets',async()=>{
  const d=await register('Dana');const invite=await api.post('/api/pair/invite').set(auth(outsider.token)).send({});
  assert.equal((await api.post('/api/pair/join').set(auth(d.token)).send({code:invite.body.code})).status,200);
  assert.deepEqual((await api.get('/api/messages').set(auth(d.token))).body,[]);
  for(const path of [`/api/media/${mediaId}`,`/api/decisions/${decisionId}`,`/api/plans/${planId}`,`/api/trips/${tripId}`]) assert.equal((await api.get(path).set(auth(d.token))).status,404,path);
  assert.equal((await api.post(`/api/decisions/${decisionId}/vote`).set(auth(d.token)).send({option_id:'foreign'})).status,404);
  assert.equal((await api.patch(`/api/plans/${planId}`).set(auth(d.token)).send({status:'done'})).status,404);
  assert.equal((await api.post(`/api/trips/${tripId}/checklist`).set(auth(d.token)).send({title:'spy'})).status,404);
  assert.equal((await api.post('/api/messages').set(auth(d.token)).send({text:'stolen',media_id:mediaId,client_id:'steal'})).status,404);
  const address=system.server.address() as any;const url=`http://127.0.0.1:${address.port}`;
  const partner=connect(url,{auth:{token:b.token},transports:['websocket']});const stranger=connect(url,{auth:{token:d.token},transports:['websocket']});
  try{
    await Promise.all([socketEvent(partner,'connect'),socketEvent(stranger,'connect')]);let leaked=false;stranger.on('changed',()=>{leaked=true;});
    const received=socketEvent(partner,'changed');await api.post('/api/messages').set(auth(a.token)).send({text:'Live hello',client_id:'live-message'});
    assert.equal((await received)[0].area,'messages');await new Promise(resolve=>setTimeout(resolve,100));assert.equal(leaked,false);
    const disconnected=socketEvent(partner,'disconnect');await api.post('/api/auth/logout').set(auth(b.token));await disconnected;
    assert.equal((await api.get('/api/auth/me').set(auth(b.token))).status,401);
    const login=await api.post('/api/auth/login').send({email:b.user.email,password:'safe-password-123'});b.token=login.body.token;
  }finally{partner.disconnect();stranger.disconnect();}
});

test('sessions that expire cannot receive subsequent realtime updates',async()=>{
  const address=system.server.address() as any;const socket=connect(`http://127.0.0.1:${address.port}`,{auth:{token:b.token},transports:['websocket']});
  try{await socketEvent(socket,'connect');let updates=0;socket.on('changed',()=>updates++);
    await system.db.prepare('UPDATE sessions SET expires_at=0 WHERE token_hash=?').run(hash(b.token));
    await api.post('/api/messages').set(auth(a.token)).send({text:'After expiry',client_id:'after-expiry'});
    await new Promise(resolve=>setTimeout(resolve,100));assert.equal(updates,0);assert.equal(socket.connected,false);
  }finally{socket.disconnect();}
});

test('plan timestamps normalize precision before ordering',async()=>{
  const created=await api.post('/api/plans').set(auth(a.token)).send({title:'One millisecond',start_at:'2026-11-02T12:00:00Z',end_at:'2026-11-02T12:00:00.001Z',timezone:'UTC'});
  assert.equal(created.status,201);assert.equal(created.body.start_at,'2026-11-02T12:00:00.000Z');
});

test('database persists across application instances',async()=>{
  const second=await createApp({databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[]});
  await new Promise<void>(resolve=>second.server.listen(0,'127.0.0.1',resolve));
  try{const history=await request(second.server).get('/api/messages').set(auth(a.token));assert.equal(history.status,200);assert.ok(history.body.some((m:any)=>m.text==='Only us'));assert.equal((await request(second.server).get('/api/trips').set(auth(a.token))).body[0].title,'Our escape');}
  finally{await new Promise<void>(resolve=>second.io.close(()=>resolve()));await second.db.close();}
});

test('production serves web app while keeping authenticated APIs private',async()=>{
  const production=await createApp({databasePath:join(dir,'test.db'),uploadDir:join(dir,'uploads'),origins:[],webDir:join(import.meta.dirname,'../../client/www')});
  await new Promise<void>(resolve=>production.server.listen(0,'127.0.0.1',resolve));
  try{const web=await request(production.server).get('/');assert.equal(web.status,200);assert.match(web.text,/<app-root>/);assert.ok(web.headers['content-security-policy'].includes('blob:'));
    const privateApi=await request(production.server).get('/api/messages');assert.equal(privateApi.status,401);assert.equal(privateApi.headers['cache-control'],'no-store');
  }finally{await new Promise<void>(resolve=>production.io.close(()=>resolve()));await production.db.close();}
});

test('concurrent identical message retries return one persisted message',async()=>{
  const input={text:'Retry me',client_id:'concurrent-retry'};
  const results=await Promise.all([api.post('/api/messages').set(auth(a.token)).send(input),api.post('/api/messages').set(auth(a.token)).send(input)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,201]);assert.equal(results[0].body.id,results[1].body.id);
  assert.equal((await system.db.prepare('SELECT COUNT(*) AS n FROM messages WHERE client_id=?').get(input.client_id))?.n,1);
});

test('socket disconnects at session expiry without waiting for new content',async()=>{
  const login=await api.post('/api/auth/login').send({email:b.user.email,password:'safe-password-123'});
  await system.db.prepare('UPDATE sessions SET expires_at=? WHERE token_hash=?').run(Date.now()+800,hash(login.body.token));
  const address=system.server.address() as any,socket=connect(`http://127.0.0.1:${address.port}`,{auth:{token:login.body.token},transports:['websocket']});
  try{await socketEvent(socket,'connect');const disconnected=socketEvent(socket,'disconnect');await Promise.race([disconnected,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Socket did not expire on time.')),1800))]);assert.equal(socket.connected,false);}
  finally{socket.disconnect();}
});
