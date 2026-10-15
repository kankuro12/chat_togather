import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {pushText} from '../src/push-text.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJ1sAAAAASUVORK5CYII=','base64');
async function couple(){
  const dir=mkdtempSync(join(tmpdir(),'together-connect-')),s=await createApp({databasePath:':memory:',uploadDir:dir,origins:[]});
  const api=request(s.server),users:any[]=[];
  for(const name of ['Asha','Bikash','Stranger'])users.push((await api.post('/api/auth/register').send({name,email:name+'@connect.test',password:'safe-password-123'})).body);
  const auth=(i:number)=>({Authorization:'Bearer '+users[i].token});const invite=await api.post('/api/pair/invite').set(auth(0));await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code});
  const coupleId=(await s.db.prepare('SELECT couple_id FROM memberships WHERE user_id=?').get(users[0].user.id))!.couple_id as string;
  return {s,api,auth,users,coupleId,close:async()=>{await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.db.close();rmSync(dir,{recursive:true,force:true});}};
}
const today=()=>new Date().toISOString().slice(0,10);

test('mood check-in: one per day each, a seven-day strip, only real moods',async()=>{
  const {api,auth,close}=await couple();
  try{
    await api.put('/api/us/mood').set(auth(0)).send({day:today(),mood:'happy',note:'Coffee with you'});
    await api.put('/api/us/mood').set(auth(0)).send({day:today(),mood:'loved',note:''});
    assert.equal((await api.put('/api/us/mood').set(auth(1)).send({day:today(),mood:'angry'})).status,400);
    assert.equal((await api.put('/api/us/mood').set(auth(1)).send({day:'2001-01-01',mood:'calm'})).status,400);
    const mood=(await api.get('/api/us/mood?day='+today()).set(auth(1))).body;assert.equal(mood.partner.mood,'loved');assert.equal(mood.mine,null);assert.equal(mood.week.length,7);assert.equal(mood.week[6].partner,'loved');
    assert.equal((await api.get('/api/us/mood').set(auth(2))).status,403);
  }finally{await close();}
});

test('quizzes, question packs with reveal, and the daily streak',async()=>{
  const {api,auth,close}=await couple();
  try{
    await api.put('/api/us/quizzes/love-language').set(auth(0)).send({scores:{words:4,time:6,touch:3,gifts:1,service:1}});
    assert.equal((await api.put('/api/us/quizzes/zodiac').set(auth(0)).send({scores:{a:1,b:2}})).status,400);
    const quizzes=(await api.get('/api/us/quizzes').set(auth(1))).body;assert.equal(quizzes.partner['love-language'].scores.time,6);assert.deepEqual(quizzes.mine,{});
    let deep=(await api.get('/api/us/packs').set(auth(0))).body.find((p:any)=>p.pack==='deep');assert.equal(deep.current.idx,0);
    await api.post('/api/us/packs/deep/0').set(auth(0)).send({answer:'My answer'});
    deep=(await api.get('/api/us/packs').set(auth(1))).body.find((p:any)=>p.pack==='deep');assert.equal(deep.current.partner_answered,true);assert.equal(deep.history.length,0);
    const after=(await api.post('/api/us/packs/deep/0').set(auth(1)).send({answer:'Mine too'})).body;assert.equal(after.done,1);assert.equal(after.current.idx,1);assert.equal(after.history[0].partner,'My answer');
    assert.equal((await api.post('/api/us/packs/deep/0').set(auth(0)).send({answer:'late'})).status,409);
    assert.equal((await api.get('/api/us/streak?day='+today()).set(auth(0))).body.streak,0);
    for(const i of [0,1])await api.post('/api/us/question?day='+today()).set(auth(i)).send({answer:'yes'});
    assert.equal((await api.get('/api/us/streak?day='+today()).set(auth(1))).body.streak,1);
  }finally{await close();}
});

test('how well do you know me: answer about yourself, partner guesses, scores add up',async()=>{
  const {s,api,auth,coupleId,close}=await couple();
  try{
    const game=(await api.get('/api/us/game').set(auth(0))).body;assert.equal(game.next.options.length,4);
    const round=(await api.post('/api/us/game').set(auth(0)).send({question:game.next.index,answer:2})).body;
    assert.equal((await api.post(`/api/us/game/${round.id}/guess`).set(auth(0)).send({guess:2})).status,400);
    const forBikash=(await api.get('/api/us/game').set(auth(1))).body;assert.equal(forBikash.to_guess.length,1);assert.equal(forBikash.to_guess[0].answer,null);
    assert.deepEqual((await api.post(`/api/us/game/${round.id}/guess`).set(auth(1)).send({guess:2})).body,{correct:true,answer:2});
    assert.equal((await api.post(`/api/us/game/${round.id}/guess`).set(auth(1)).send({guess:1})).status,409);
    assert.deepEqual((await api.get('/api/us/game').set(auth(1))).body.score,{mine:1,mine_total:1,partner:0,partner_total:0});
    assert.deepEqual(await pushText(s.db,coupleId,'game',round.id,true),{title:'Asha',body:'🤔 How well do you know me? Guess my answer.'});
  }finally{await close();}
});

test('journal: gratitude is shared, private entries stay private',async()=>{
  const {api,auth,close}=await couple();
  try{
    await api.post('/api/us/journal').set(auth(0)).send({kind:'gratitude',text:'You made tea'});await api.post('/api/us/journal').set(auth(0)).send({kind:'private',text:'Just for me'});
    assert.deepEqual((await api.get('/api/us/journal').set(auth(1))).body.map((e:any)=>e.text),['You made tea']);
    assert.equal((await api.get('/api/us/journal').set(auth(0))).body.length,2);
    const entry=(await api.get('/api/us/journal').set(auth(1))).body[0];assert.equal((await api.delete('/api/us/journal/'+entry.id).set(auth(1))).status,403);
  }finally{await close();}
});

test('status: local time and battery, distance only when both share, never coordinates',async()=>{
  const {api,auth,close}=await couple();
  try{
    await api.put('/api/us/status').set(auth(0)).send({timezone:'Asia/Kathmandu',battery:64,charging:true,location:{lat:27.7172,lng:85.324},reunion:'2026-12-24'});
    let status=(await api.get('/api/us/status').set(auth(1))).body;assert.equal(status.partner.battery,64);assert.equal(status.partner.timezone,'Asia/Kathmandu');assert.equal(status.distance_km,null);assert.equal(status.reunion,'2026-12-24');
    await api.put('/api/us/status').set(auth(1)).send({timezone:'Asia/Kathmandu',location:{lat:28.2096,lng:83.9856}});
    status=(await api.get('/api/us/status').set(auth(1))).body;assert.ok(status.distance_km>=140&&status.distance_km<=150,String(status.distance_km));
    assert.equal(JSON.stringify(status).includes('27.7'),false,'no raw coordinates');
    await api.put('/api/us/status').set(auth(0)).send({timezone:'Asia/Kathmandu',location:null});
    assert.equal((await api.get('/api/us/status').set(auth(1))).body.distance_km,null);
    assert.equal((await api.put('/api/us/status').set(auth(0)).send({timezone:'Mars/Base'})).status,400);
  }finally{await close();}
});

test('moments: a drawing for the partner, never shown in Memories',async()=>{
  const {s,api,auth,coupleId,close}=await couple();
  try{
    const media=(await api.post('/api/media?purpose=chat').set(auth(0)).attach('file',png,{filename:'d.png',contentType:'image/png'})).body;
    assert.equal((await api.post('/api/us/moment').set(auth(1)).send({media_id:media.id,kind:'drawing'})).status,400);
    const moment=(await api.post('/api/us/moment').set(auth(0)).send({media_id:media.id,kind:'drawing',caption:'For you'})).body;
    assert.equal((await api.get('/api/us/moment').set(auth(1))).body.from_partner.media_id,media.id);
    assert.equal((await api.get('/api/media').set(auth(1))).body.length,0);
    assert.deepEqual(await pushText(s.db,coupleId,'moment',moment.id,false),{title:'Together',body:'🎨 A drawing for you'});
  }finally{await close();}
});

test('games: refereed moves, hidden picks, wins recorded, rematch swaps who starts',async()=>{
  const {api,auth,users,close}=await couple();
  try{
    const catalog=(await api.get('/api/games').set(auth(0))).body.catalog;assert.deepEqual(catalog.map((g:any)=>g.id),['tic-tac-toe','connect-four','rock-paper-scissors']);
    let game=(await api.post('/api/games').set(auth(0)).send({game:'tic-tac-toe'})).body;assert.equal(game.your_turn,true);
    assert.equal((await api.post('/api/games').set(auth(1)).send({game:'tic-tac-toe'})).body.id,game.id,'one running game per kind');
    assert.equal((await api.post(`/api/games/${game.id}/move`).set(auth(1)).send({move:{cell:0}})).status,400,'not your turn');
    for(const [player,cell] of [[0,0],[1,3],[0,1],[1,4]] as const)game=(await api.post(`/api/games/${game.id}/move`).set(auth(player)).send({move:{cell}})).body;
    assert.equal((await api.post(`/api/games/${game.id}/move`).set(auth(0)).send({move:{cell:3}})).status,400,'square taken');
    game=(await api.post(`/api/games/${game.id}/move`).set(auth(0)).send({move:{cell:2}})).body;assert.equal(game.finished,true);assert.equal(game.winner,users[0].user.id);assert.deepEqual(game.state.line,[0,1,2]);
    const lobby=(await api.get('/api/games').set(auth(1))).body;assert.deepEqual(lobby.catalog[0].record,{wins:0,losses:1,draws:0});
    const rematch=(await api.post(`/api/games/${game.id}/rematch`).set(auth(1))).body;assert.equal(rematch.turn,users[1].user.id);
    // Rock paper scissors keeps the partner's pick secret until both have picked.
    let rps=(await api.post('/api/games').set(auth(0)).send({game:'rock-paper-scissors'})).body;
    await api.post(`/api/games/${rps.id}/move`).set(auth(0)).send({move:{pick:'rock'}});
    const seen=(await api.get(`/api/games/${rps.id}`).set(auth(1))).body;assert.deepEqual(seen.state.picks,{mine:null,partner_picked:true});assert.equal(JSON.stringify(seen.state).includes('"rock"'),false,'the pick itself is not sent');
    rps=(await api.post(`/api/games/${rps.id}/move`).set(auth(1)).send({move:{pick:'scissors'}})).body;assert.equal(rps.state.rounds[0].winner,users[0].user.id);
    // Connect four drops discs to the bottom and rejects full columns.
    let c4=(await api.post('/api/games').set(auth(0)).send({game:'connect-four'})).body;
    for(let i=0;i<6;i++)c4=(await api.post(`/api/games/${c4.id}/move`).set(auth(i%2)).send({move:{column:3}})).body;
    assert.equal((await api.post(`/api/games/${c4.id}/move`).set(auth(0)).send({move:{column:3}})).status,400);
    assert.equal((await api.get('/api/games').set(auth(2))).status,403);
  }finally{await close();}
});
