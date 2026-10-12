import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app.js';
test('one reverse proxy gives clients separate login budgets and ignores forged earlier hops',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[]});
  try{
    const api=request(s.server);
    for(let i=0;i<40;i++)assert.equal((await api.post('/api/auth/login').set('X-Forwarded-For','198.51.100.10').send({})).status,400);
    assert.equal((await api.post('/api/auth/login').set('X-Forwarded-For','198.51.100.10').send({})).status,429);
    assert.equal((await api.post('/api/auth/login').set('X-Forwarded-For','198.51.100.11').send({})).status,400);
    assert.equal((await api.post('/api/auth/login').set('X-Forwarded-For','203.0.113.99, 198.51.100.10').send({})).status,429);
  }finally{await new Promise<void>(resolve=>s.io.close(()=>resolve()));s.db.close();}
});
test('paired users sharing an IP have separate authenticated request budgets',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[]});
  try{const api=request(s.server),users=[] as any[];for(const name of ['BudgetA','BudgetB'])users.push((await api.post('/api/auth/register').send({name,email:name+'@test.invalid',password:'safe-password-123'})).body);
    const auth=(index:number)=>({Authorization:'Bearer '+users[index].token});const invite=await api.post('/api/pair/invite').set(auth(0)).send({});await api.post('/api/pair/join').set(auth(1)).send({code:invite.body.code});
    for(let i=0;i<160;i++)for(let user=0;user<2;user++)assert.equal((await api.get('/api/plans').set(auth(user))).status,200);
  }finally{s.io.close();s.db.close();}
});
