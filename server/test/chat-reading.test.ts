import {jobQueue} from '../src/jobs.js';
import {pushHandler} from '../src/push-job.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {io,Socket} from 'socket.io-client';
import {createApp} from '../src/app.js';
test('unread persists, reads cannot move backwards or cross couples; reading sessions suppress only message push',async()=>{
const sent:any[]=[];const app=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],communication:{sendPush:async(tokens,kind)=>{sent.push({tokens,kind});return [];}}});let socket:Socket|undefined;
try{
await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const api=request(app.server),users:any[]=[];
for(const name of ['reader','sender','outsider'])users.push((await api.post('/api/auth/register').send({name,email:name+'@reading.test',password:'safe-password-123'})).body);
const auth=(n:number)=>({Authorization:'Bearer '+users[n].token}),invite=await api.post('/api/pair/invite').set(auth(0)).send({});
await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code});
const first=(await api.post('/api/messages').set(auth(1)).send({text:'One',client_id:'one'})).body;
assert.equal((await api.get('/api/messages/read-state').set(auth(0))).body.unread,1);
assert.equal((await api.post('/api/messages/read').set(auth(2)).send({message_id:first.id})).status,403);
assert.equal((await api.post('/api/messages/read').set(auth(0)).send({message_id:first.id})).status,200);
assert.equal((await api.get('/api/messages/read-state').set(auth(0))).body.unread,0);
assert.equal((await api.get('/api/messages/read-state').set(auth(1))).body.partner.id,first.id);
await new Promise(r=>setTimeout(r,2));
const next=(await api.post('/api/messages').set(auth(1)).send({text:'Two',client_id:'two'})).body;
await api.post('/api/messages/read').set(auth(0)).send({message_id:next.id});
await api.post('/api/messages/read').set(auth(0)).send({message_id:first.id});
assert.equal((await api.get('/api/messages/read-state').set(auth(1))).body.partner.id,next.id);
await api.post('/api/notifications/token').set(auth(0)).send({token:'reading-device-token-1234567890'});
socket=io('http://127.0.0.1:'+(app.server.address() as any).port,{auth:{token:users[0].token},transports:['websocket']});await new Promise<void>(r=>socket!.once('connect',r));
socket.emit('chat:view',true);await new Promise(r=>setTimeout(r,30));
await api.post('/api/messages').set(auth(1)).send({text:'Reading',client_id:'reading'});
assert.equal(sent.length,0);
const other=(await api.post('/api/auth/login').send({email:'reader@reading.test',password:'safe-password-123'})).body;
await api.post('/api/notifications/token').set({Authorization:'Bearer '+other.token}).send({token:'other-device-token-1234567890'});
await api.post('/api/messages').set(auth(1)).send({text:'Other device',client_id:'other-device'});
while(await jobQueue(app.db).runOne({push:pushHandler(app.db,async(tokens,kind)=>{sent.push({tokens,kind});return [];})})){}
assert.deepEqual(sent.at(-1),{tokens:['other-device-token-1234567890'],kind:'message'});
socket.emit('chat:view',false);await new Promise(r=>setTimeout(r,30));
await api.post('/api/messages').set(auth(1)).send({text:'Away',client_id:'away'});
while(await jobQueue(app.db).runOne({push:pushHandler(app.db,async(tokens,kind)=>{sent.push({tokens,kind});return [];})})){}
assert.equal(sent.length,3);assert.equal(sent[1].tokens.length,1);assert.equal(sent[1].kind,'message');
socket.disconnect();await new Promise(r=>setTimeout(r,30));
await api.post('/api/messages').set(auth(1)).send({text:'Closed',client_id:'closed'});
while(await jobQueue(app.db).runOne({push:pushHandler(app.db,async(tokens,kind)=>{sent.push({tokens,kind});return [];})})){}
assert.equal(sent.length,5);
}finally{socket?.disconnect();await new Promise<void>(r=>app.io.close(()=>r()));app.db.close();}
});
