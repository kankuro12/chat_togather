import {test} from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/app.js';
test('hashed build files cache for a year, app shell revalidates, text is gzipped',async()=>{
  const web=mkdtempSync(join(tmpdir(),'together-web-'));
  writeFileSync(join(web,'index.html'),'<!doctype html><title>Together</title>'+'<p>shell</p>'.repeat(200));
  writeFileSync(join(web,'main-AB12CD34.js'),'console.log("app");'.repeat(200));
  writeFileSync(join(web,'firebase-messaging-sw.js'),'self.addEventListener("push",()=>{});'.repeat(50));
  const s=await createApp({databasePath:':memory:',uploadDir:'unused',origins:[],webDir:web});
  try{
    const api=request(s.server);
    const main=await api.get('/main-AB12CD34.js').set('Accept-Encoding','gzip');assert.equal(main.headers['cache-control'],'public, max-age=31536000, immutable');assert.equal(main.headers['content-encoding'],'gzip');
    assert.equal((await api.get('/index.html')).headers['cache-control'],'no-cache');
    assert.equal((await api.get('/firebase-messaging-sw.js')).headers['cache-control'],'no-cache');
    assert.equal((await api.get('/api/health')).headers['cache-control'],'no-store');
  }finally{await new Promise<void>(resolve=>s.io.close(()=>resolve()));await s.db.close();rmSync(web,{recursive:true,force:true});}
});
