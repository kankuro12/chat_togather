import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';

test('new phone login requires name setup, persists it, and skips setup on returning login',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],auth:{phoneTestMode:true}});
  try{
    const api=request(s.server);const sent=await api.post('/api/auth/phone/send').send({phone:'9800000033'});
    const session=await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'});const headers={Authorization:'Bearer '+session.body.token};
    assert.equal((await api.get('/api/auth/me').set(headers)).body.user.needsProfile,true);
    assert.equal((await api.post('/api/pair/invite').set(headers).send({})).status,400);
    assert.equal((await api.patch('/api/auth/profile').set(headers).send({name:'   '})).status,400);
    assert.equal((await api.patch('/api/auth/profile').set(headers).send({name:'  Sita  '})).status,200);
    const profile=(await api.get('/api/auth/me').set(headers)).body.user;assert.equal(profile.name,'Sita');assert.equal(profile.needsProfile,false);
    s.db.prepare('DELETE FROM phone_challenges').run();const next=await api.post('/api/auth/phone/send').send({phone:'9800000033'});const returning=await api.post('/api/auth/phone/verify').send({challenge:next.body.challenge,code:'123456'});
    const user=(await api.get('/api/auth/me').set({Authorization:'Bearer '+returning.body.token})).body.user;assert.equal(user.id,profile.id);assert.equal(user.name,'Sita');assert.equal(user.needsProfile,false);
  }finally{s.io.close();s.db.close();}
});

test('Nepal local numbers normalize to +977 and share resend limits with international format',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],auth:{phoneTestMode:true}});
  try{
    const api=request(s.server);
    const sent=await api.post('/api/auth/phone/send').send({phone:'980 000 0011',name:'Nepal user'});
    assert.equal(sent.status,200);
    assert.equal(s.db.prepare('SELECT phone FROM phone_challenges').get()?.phone,'+9779800000011');
    assert.equal((await api.post('/api/auth/phone/send').send({phone:'+9779800000011'})).status,429);
    assert.equal((await api.post('/api/auth/phone/send').send({phone:'+15555551001'})).status,400);
    assert.equal((await api.post('/api/auth/phone/send').send({phone:'980000011'})).status,400);
    const verified=await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'});
    assert.equal(verified.status,200);
    for(let i=0;i<35;i++)assert.equal((await api.get('/api/auth/me').set('Authorization','Bearer '+verified.body.token)).status,200);
    assert.equal((await api.post('/api/auth/logout').set('Authorization','Bearer '+verified.body.token).send({})).status,200);
  }finally{s.io.close();s.db.close();}
});

test('test phone OTP needs a challenge, rejects wrong codes, expires, and is single-use',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],auth:{phoneTestMode:true,fetch:async()=>{throw new Error('Test mode must not call SMS provider');}}});
  try{
    const api=request(s.server),input={phone:'+9779800000099',name:'Test user'};
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:'missing',code:'123456'})).status,400);
    const sent=await api.post('/api/auth/phone/send').send(input);assert.equal(sent.status,200);
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'000000'})).status,400);
    assert.equal(s.db.prepare('SELECT count(*) AS n FROM users').get()?.n,0);
    const verified=await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'});
    assert.equal(verified.status,200);assert.equal(verified.body.user.name,'Test user');
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'})).status,400);
    s.db.prepare('DELETE FROM phone_challenges').run();
    const expired=await api.post('/api/auth/phone/send').send(input);
    s.db.prepare('UPDATE phone_challenges SET expires_at=0').run();
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:expired.body.challenge,code:'123456'})).status,400);
    s.db.prepare('DELETE FROM phone_challenges').run();
    const limited=await api.post('/api/auth/phone/send').send(input);
    for(let i=0;i<5;i++)assert.equal((await api.post('/api/auth/phone/verify').send({challenge:limited.body.challenge,code:'000000'})).status,400);
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:limited.body.challenge,code:'123456'})).status,400);
  }finally{s.io.close();s.db.close();}
});

test('production ignores phone test mode',async()=>{
  const previous=process.env.NODE_ENV;process.env.NODE_ENV='production';
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],auth:{phoneTestMode:true}});
  try{assert.equal((await request(s.server).post('/api/auth/phone/send').send({phone:'+9779800000099'})).status,503);}
  finally{s.io.close();s.db.close();if(previous===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=previous;}
});

test('unconfigured providers fail safely without creating accounts',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[]});
  try {
    const api=request(s.server);
    assert.equal((await api.post('/api/auth/phone/send').send({phone:'+9779800000000',name:'Maya'})).status,503);
    assert.equal((await api.post('/api/auth/oauth/google/start').send({})).status,503);
    assert.equal((await api.post('/api/auth/oauth/facebook/start').send({})).status,503);
    assert.equal(s.db.prepare('SELECT count(*) AS n FROM users').get()?.n,0);
  }finally{s.io.close();s.db.close();}
});

test('phone verification requires a sent, valid code, consumes it, and returns same account on next login',async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],auth:{twilioAccountSid:'ACtest',twilioAuthToken:'test',twilioVerifyServiceSid:'VAtest',fetch:async(url:any,init:any)=>{
    const body=new URLSearchParams(init.body);
    return Response.json(String(url).endsWith('/Verifications')?{sid:'VEtest',status:'pending'}:{status:body.get('Code')==='123456'?'approved':'pending'});
  }}});
  try{
    const api=request(s.server),input={phone:'+9779800000000',name:'Maya'};
    assert.equal((await api.post('/api/auth/phone/verify').send({...input,challenge:'missing',code:'123456'})).status,400);
    assert.equal((await api.post('/api/auth/phone/send').send({phone:'980000000'})).status,400);
    const sent=await api.post('/api/auth/phone/send').send(input);assert.equal(sent.status,200);
    assert.equal((await api.post('/api/auth/phone/send').send(input)).status,429);
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'000000'})).status,400);
    const verified=await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'});assert.equal(verified.status,200);
    assert.equal(verified.body.user.name,'Maya');
    assert.equal((await api.get('/api/auth/me').set('Authorization',`Bearer ${verified.body.token}`)).status,200);
    assert.equal((await api.post('/api/auth/phone/verify').send({challenge:sent.body.challenge,code:'123456'})).status,400);
    s.db.prepare('DELETE FROM phone_challenges').run();
    const again=await api.post('/api/auth/phone/send').send({phone:input.phone});
    const login=await api.post('/api/auth/phone/verify').send({challenge:again.body.challenge,code:'123456'});
    assert.equal(login.body.user.id,verified.body.user.id);
    assert.equal((await api.post('/api/auth/login').send({email:verified.body.user.email,password:'anything'})).status,401);
  }finally{s.io.close();s.db.close();}
});

for(const provider of ['google','facebook'])test(`${provider} binds callback to browser and exchanges one-use ticket`,async()=>{
  const s=createApp({databasePath:':memory:',uploadDir:'unused',origins:[],auth:{publicUrl:'http://localhost:3001',appUrl:'http://localhost:4200',googleClientId:'test',googleClientSecret:'test',facebookClientId:'test',facebookClientSecret:'test',fetch:async(url:any)=>Response.json(new URL(String(url)).pathname.endsWith('/token')||new URL(String(url)).pathname.endsWith('/access_token')?{access_token:'provider-token'}:provider==='google'?{sub:'google-person',name:'Maya',email:'maya@example.com',email_verified:true}:{id:'facebook-person',name:'Maya',email:'maya@example.com'})}});
  try{
    const api=request(s.server),agent=request.agent(s.server);
    const verifier="a".repeat(64);const start=await agent.post(`/api/auth/oauth/${provider}/start`).send({verifier});assert.equal(start.status,200);
    const state=new URL(start.body.url).searchParams.get('state');
    assert.equal((await api.get(`/api/auth/oauth/${provider}/callback?state=${state}&code=ok`)).status,302);
    const callback=await agent.get(`/api/auth/oauth/${provider}/callback?state=${state}&code=ok`);
    const ticket=new URLSearchParams(new URL(callback.headers.location).hash.slice(1)).get('auth_ticket');assert.ok(ticket);
    assert.equal((await api.post('/api/auth/oauth/exchange').send({ticket,verifier:'b'.repeat(64)})).status,400);const session=await api.post('/api/auth/oauth/exchange').send({ticket,verifier});assert.equal(session.status,200);assert.equal(session.body.user.name,'Maya');
    assert.equal((await api.post('/api/auth/oauth/exchange').send({ticket})).status,400);
    const replay=await agent.get(`/api/auth/oauth/${provider}/callback?state=${state}&code=ok`);assert.ok(replay.headers.location.includes('auth_error='));
  }finally{s.io.close();s.db.close();}
});


