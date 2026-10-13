import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import request from 'supertest';
import {createApp} from '../src/app.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');
const webm=Buffer.from('1a45dfa39f4286810142f7810142f2810442f381084282847765626d4287810442858102','hex');

async function couple(){
  const dir=mkdtempSync(join(tmpdir(),'together-chat-features-')),s=await createApp({databasePath:':memory:',uploadDir:dir,origins:[]});
  const api=request(s.server),users:any[]=[];
  for(const name of ['Asha','Bikash','Stranger'])users.push((await api.post('/api/auth/register').send({name,email:name+'@features.test',password:'safe-password-123'})).body);
  const auth=(i:number)=>({Authorization:'Bearer '+users[i].token});const invite=await api.post('/api/pair/invite').set(auth(0));await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code});
  const say=async(i:number,text:string,extra:any={})=>(await api.post('/api/messages').set(auth(i)).send({text,client_id:crypto.randomUUID(),...extra})).body;
  return {s,api,auth,say,users,close:async()=>{await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.db.close();rmSync(dir,{recursive:true,force:true});}};
}

test('reactions: one per person, replaceable, removable, only from the allowed set',async()=>{
  const {api,auth,say,close}=await couple();
  try{
    const m=await say(0,'Dinner?');
    assert.deepEqual((await api.put(`/api/messages/${m.id}/reaction`).set(auth(1)).send({emoji:'❤️'})).body.reactions.map((r:any)=>r.emoji),['❤️']);
    assert.deepEqual((await api.put(`/api/messages/${m.id}/reaction`).set(auth(1)).send({emoji:'😂'})).body.reactions.map((r:any)=>r.emoji),['😂']);
    assert.equal((await api.put(`/api/messages/${m.id}/reaction`).set(auth(0)).send({emoji:'👍'})).body.reactions.length,2);
    assert.equal((await api.put(`/api/messages/${m.id}/reaction`).set(auth(1)).send({emoji:null})).body.reactions.length,1);
    assert.equal((await api.put(`/api/messages/${m.id}/reaction`).set(auth(1)).send({emoji:'💩'})).status,400);
    assert.equal((await api.put(`/api/messages/${m.id}/reaction`).set(auth(2)).send({emoji:'❤️'})).status,403);
  }finally{await close();}
});

test('edit and delete: only your own plain messages; quotes follow the change',async()=>{
  const {api,auth,say,close}=await couple();
  try{
    const m=await say(0,'Meet at 6');const reply=await say(1,'Ok',{reply_to:m.id});
    assert.equal((await api.patch(`/api/messages/${m.id}`).set(auth(1)).send({text:'hacked'})).status,403);
    const edited=(await api.patch(`/api/messages/${m.id}`).set(auth(0)).send({text:'Meet at 7'})).body;assert.equal(edited.text,'Meet at 7');assert.equal(edited.edited,true);
    assert.equal((await api.get(`/api/messages/${reply.id}`).set(auth(1))).body.reply_text,'Meet at 7');
    await api.put(`/api/messages/${m.id}/pin`).set(auth(1)).send({pinned:true});await api.put(`/api/messages/${m.id}/reaction`).set(auth(1)).send({emoji:'❤️'});
    const gone=(await api.delete(`/api/messages/${m.id}`).set(auth(0))).body;assert.equal(gone.deleted,true);assert.equal(gone.text,'');assert.equal(gone.pinned,false);assert.deepEqual(gone.reactions,[]);
    assert.equal((await api.get(`/api/messages/${reply.id}`).set(auth(1))).body.reply_text,'Deleted message');
    assert.equal((await api.patch(`/api/messages/${m.id}`).set(auth(0)).send({text:'back'})).status,410);
    assert.equal((await api.put(`/api/messages/${m.id}/reaction`).set(auth(1)).send({emoji:'❤️'})).status,410);
    const history=(await api.get('/api/messages').set(auth(1))).body;assert.equal(history.find((x:any)=>x.id===m.id).deleted,true);
  }finally{await close();}
});

test('search finds edited text case-insensitively, skips deleted, treats % and _ literally',async()=>{
  const {api,auth,say,close}=await couple();
  try{
    await say(0,'Book the Lakeside cafe');const b=await say(1,'lakeside again?');const d=await say(0,'Lakeside secret');await say(0,'100% sure');await say(1,'100 sure');
    await api.delete(`/api/messages/${d.id}`).set(auth(0));await api.patch(`/api/messages/${b.id}`).set(auth(1)).send({text:'Pokhara again?'});
    assert.deepEqual((await api.get('/api/messages/search?q=LAKESIDE').set(auth(1))).body.map((m:any)=>m.text),['Book the Lakeside cafe']);
    assert.deepEqual((await api.get('/api/messages/search?q=pokhara').set(auth(0))).body.map((m:any)=>m.text),['Pokhara again?']);
    assert.deepEqual((await api.get('/api/messages/search?q='+encodeURIComponent('0%')).set(auth(0))).body.map((m:any)=>m.text),['100% sure']);
    assert.equal((await api.get('/api/messages/search?q=a').set(auth(0))).status,400);
    assert.equal((await api.get('/api/messages/search?q=lakeside').set(auth(2))).status,403);
  }finally{await close();}
});

test('pins list newest first and unpin removes',async()=>{
  const {api,auth,say,close}=await couple();
  try{
    const a=await say(0,'Wifi: tea-garden');const b=await say(1,'Flat 4B');
    await api.put(`/api/messages/${a.id}/pin`).set(auth(1)).send({pinned:true});await new Promise(r=>setTimeout(r,5));await api.put(`/api/messages/${b.id}/pin`).set(auth(0)).send({pinned:true});
    assert.deepEqual((await api.get('/api/messages/pins').set(auth(0))).body.map((m:any)=>m.text),['Flat 4B','Wifi: tea-garden']);
    await api.put(`/api/messages/${b.id}/pin`).set(auth(0)).send({pinned:false});
    assert.deepEqual((await api.get('/api/messages/pins').set(auth(1))).body.map((m:any)=>m.id),[a.id]);
  }finally{await close();}
});

test('view-once photos open exactly once for the recipient and never appear in memories',async()=>{
  const {api,auth,say,close}=await couple();
  try{
    const photo=(await api.post('/api/media').set(auth(0)).attach('file',png,{filename:'p.png',contentType:'image/png'}).attach('thumb',png,{filename:'t.png',contentType:'image/png'})).body;
    const m=await say(0,'',{media_id:photo.id,view_once:true});assert.equal(m.view_once,true);assert.equal(m.viewed,false);
    const seen=(await api.get(`/api/messages/${m.id}`).set(auth(1))).body;assert.equal(seen.media_thumb,0);
    assert.equal((await api.get(`/api/media/${photo.id}`).set(auth(1))).status,403);assert.equal((await api.get(`/api/media/${photo.id}/thumb`).set(auth(1))).status,403);
    assert.equal((await api.get(`/api/media/${photo.id}`).set(auth(0))).status,200);
    assert.ok(!(await api.get('/api/media').set(auth(1))).body.some((x:any)=>x.id===photo.id));
    const open=await api.post(`/api/messages/${m.id}/open`).set(auth(1));assert.equal(open.status,200);assert.equal(open.headers['content-type'],'image/png');
    assert.equal((await api.post(`/api/messages/${m.id}/open`).set(auth(1))).status,410);
    assert.equal((await api.get(`/api/messages/${m.id}`).set(auth(0))).body.viewed,true);
    assert.equal((await api.post(`/api/messages/${m.id}/open`).set(auth(0))).status,200);
    const clip=(await api.post('/api/media').set(auth(0)).attach('file',webm,{filename:'v.webm',contentType:'video/webm'})).body;
    assert.equal((await api.post('/api/messages').set(auth(0)).send({text:'',media_id:clip.id,view_once:true,client_id:'vo-video'})).status,400);
  }finally{await close();}
});

test('voice uploads keep a waveform that comes back with the message',async()=>{
  const {api,auth,say,close}=await couple();
  try{
    const peaks=Array.from({length:32},(_,i)=>(i*7)%101);
    const voice=(await api.post('/api/media').set(auth(0)).attach('file',webm,{filename:'v.webm',contentType:'audio/webm'}).field('duration','4').field('waveform',peaks.join(','))).body;
    const m=await say(0,'',{media_id:voice.id});assert.deepEqual(m.media_waveform,peaks);
    assert.equal((await api.post('/api/media').set(auth(0)).attach('file',webm,{filename:'v.webm',contentType:'audio/webm'}).field('waveform','1,2,999')).status,400);
  }finally{await close();}
});
