import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import request from 'supertest';
import {createApp} from '../src/app.js';

test('chat returns every ordered choice thumbnail, including older choices and message history',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'together-chat-choices-')),s=await createApp({databasePath:':memory:',uploadDir:dir,origins:[]});
  try{
    const api=request(s.server),users:any[]=[];
    for(const name of ['Sender','Recipient','Outsider'])users.push((await api.post('/api/auth/register').send({name,email:name+'@thumbnails.test',password:'safe-password-123'})).body);
    const auth=(i:number)=>({Authorization:'Bearer '+users[i].token});const invite=await api.post('/api/pair/invite').set(auth(0));await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code});
    const couple=(await s.db.prepare('SELECT couple_id FROM memberships WHERE user_id=?').get(users[0].user.id))!.couple_id,media=randomUUID();
    await s.db.prepare('INSERT INTO media VALUES(?,?,?,?,?,?,?)').run(media,couple,users[0].user.id,'choice.png','image/png',10,new Date().toISOString());
    const created=await api.post('/api/decisions').set(auth(0)).send({title:'Six images',mode:'choose',options:Array.from({length:6},(_,i)=>({label:'Image '+(i+1),media_id:media}))});assert.equal(created.status,201);
    const expected=created.body.options.map((option:any)=>({id:option.id,media_id:media}));
    const chat=await api.get('/api/messages').set(auth(1));assert.deepEqual(chat.body[0].choice_images,expected);
    const chosen=await api.post('/api/decisions/'+created.body.id+'/vote').set(auth(1)).send({option_id:created.body.options[5].id});assert.equal(chosen.status,200);
    for(const message of (await api.get('/api/messages').set(auth(1))).body)assert.deepEqual(message.choice_images,expected);
    for(let i=0;i<101;i++)await s.db.prepare('INSERT INTO decisions VALUES(?,?,?,?,?,?)').run(randomUUID(),couple,users[0].user.id,'Newer choice','choose',new Date(Date.now()+1000+i).toISOString());
    assert.ok(!(await api.get('/api/decisions').set(auth(1))).body.some((choice:any)=>choice.id===created.body.id));
    for(let i=0;i<100;i++)await s.db.prepare('INSERT INTO messages VALUES(?,?,?,?,?,?,?)').run(randomUUID(),couple,users[0].user.id,'Later message',null,'later-'+i,new Date(Date.now()+2000+i).toISOString());
    const latest=(await api.get('/api/messages').set(auth(1))).body;assert.equal(latest.length,100);assert.equal(latest[0].choice_images,undefined);
    const history=(await api.get('/api/messages?before='+latest[0].id).set(auth(1))).body;assert.equal(history.length,2);for(const message of history)assert.deepEqual(message.choice_images,expected);
    assert.equal((await api.get('/api/messages').set(auth(2))).status,403);
  }finally{await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.storage.close();await s.db.close();rmSync(dir,{recursive:true,force:true});}
});
