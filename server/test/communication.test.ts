import {jobQueue} from '../src/jobs.js';
import {pushHandler} from '../src/push-job.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {io,Socket} from 'socket.io-client';
import {createApp} from '../src/app.js';
const event=(socket:Socket,name:string)=>new Promise<any>(resolve=>socket.once(name,resolve));
const emit=(socket:Socket,name:string,data:any)=>new Promise<any>(resolve=>socket.timeout(3000).emit(name,data,(_error:any,result:any)=>resolve(result)));
test('calls and live locations stay inside pair; logout removes notification registration',async()=>{
  const deliveries:{tokens:string[];kind:string}[]=[];
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],communication:{sendPush:async(tokens,kind)=>{deliveries.push({tokens,kind});return [];}}});let sockets:Socket[]=[];
  try{
    await new Promise<void>(resolve=>s.server.listen(0,'127.0.0.1',resolve));const api=request(s.server),port=(s.server.address() as any).port;
    const accounts:any[]=[];for(const name of ['caller','partner','outsider'])accounts.push((await api.post('/api/auth/register').send({name,email:name+'@comm.test',password:'password-12345'})).body);
    const headers=(i:number)=>({Authorization:'Bearer '+accounts[i].token});const invitation=await api.post('/api/pair/invite').set(headers(0)).send({});await api.post('/api/pair/join').set(headers(1)).send({code:invitation.body.code});
    assert.equal((await api.get('/api/communication/config').set(headers(2))).status,403);
    for(const account of accounts.slice(0,2)){const socket=io(`http://127.0.0.1:${port}`,{auth:{token:account.token},transports:['websocket'],forceNew:true});sockets.push(socket);await event(socket,'connect');}
    const [a,b]=sockets,incoming=event(b,'call:incoming');const initiated=await emit(a,'call:start',{kind:'audio'});assert.ok(initiated.id);assert.equal((await incoming).id,initiated.id);
    assert.equal((await emit(b,'call:accept',{id:'wrong'})).ok,false);
    const accepted=event(a,'call:accepted');assert.equal((await emit(b,'call:accept',{id:initiated.id})).ok,true);await accepted;
    const signal=event(b,'call:signal');await emit(a,'call:signal',{id:initiated.id,description:{type:'offer',sdp:'test-offer'}});assert.equal((await signal).description.sdp,'test-offer');
    await emit(a,'call:end',{id:initiated.id});
    assert.equal((await emit(a,'location:update',{latitude:27,longitude:85,accuracy:10})).ok,false);
    await emit(a,'location:start',{minutes:15});const location=event(b,'location:changed');await emit(a,'location:update',{latitude:27.7,longitude:85.3,accuracy:10});assert.equal((await location).latitude,27.7);
    assert.equal((await api.get('/api/communication/locations').set(headers(2))).status,403);
    assert.equal((await api.get('/api/communication/locations').set(headers(1))).body.length,1);
    await emit(a,'location:stop',{});assert.equal((await api.get('/api/communication/locations').set(headers(1))).body.length,0);
    await api.post('/api/notifications/token').set(headers(0)).send({token:'dummy-token-12345678901234567890'});
    await api.post('/api/notifications/token').set(headers(1)).send({token:'partner-token-12345678901234567890'});
    await api.post('/api/messages').set(headers(0)).send({text:'Private message',client_id:'push-test'});
    await api.post('/api/messages').set(headers(0)).send({text:'Private message',client_id:'push-test'});
    assert.equal(s.db.prepare('SELECT count(*) AS n FROM jobs').get()?.n,1);
    while(await jobQueue(s.db).runOne({push:pushHandler(s.db,async(tokens,kind)=>{deliveries.push({tokens,kind});return [];})})){}
    assert.deepEqual(deliveries.at(-1),{tokens:['partner-token-12345678901234567890'],kind:'message'});
    const before=deliveries.length,read=(await api.post('/api/messages').set(headers(0)).send({text:'Read before delivery',client_id:'read-later'})).body;
    await api.post('/api/messages/read').set(headers(1)).send({message_id:read.id});
    while(await jobQueue(s.db).runOne({push:pushHandler(s.db,async(tokens,kind)=>{deliveries.push({tokens,kind});return [];})})){}
    assert.equal(deliveries.length,before);
    await api.post('/api/messages').set(headers(0)).send({text:'Revoked before delivery',client_id:'revoked'});
    await api.delete('/api/notifications/token').set(headers(1));
    while(await jobQueue(s.db).runOne({push:pushHandler(s.db,async(tokens,kind)=>{deliveries.push({tokens,kind});return [];})})){}
    assert.equal(deliveries.length,before);
    assert.equal(s.db.prepare('SELECT count(*) AS n FROM push_tokens').get()?.n,1);
    await api.post('/api/auth/logout').set(headers(0)).send({});assert.equal(s.db.prepare('SELECT count(*) AS n FROM push_tokens').get()?.n,0);
  }finally{sockets.forEach(socket=>socket.disconnect());await new Promise<void>(resolve=>s.io.close(()=>resolve()));s.db.close();}
});
