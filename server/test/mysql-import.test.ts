import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {createConnection} from 'mysql2/promise';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {openDatabase} from '../src/db.js';
import {importSQLite} from '../src/sqlite-import.js';

const mysqlUrl=process.env.TEST_MYSQL_URL;
test('SQLite import preserves sessions and source, rejects nonempty target and rolls back invalid rows',{skip:!mysqlUrl},async()=>{
  const url=new URL(mysqlUrl!),name='together_test_'+randomUUID().replaceAll('-','');url.pathname='';
  const admin=await createConnection(url.toString());await admin.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');url.pathname='/'+name;
  const dir=mkdtempSync(join(tmpdir(),'together-import-')),path=join(dir,'source.db');
  const source=await createApp({databasePath:path,uploadDir:join(dir,'uploads'),origins:[]});let target:Awaited<ReturnType<typeof openDatabase>>|undefined;
  try{
    const registered=await request(source.server).post('/api/auth/register').send({name:'Imported',email:'imported@example.com',password:'safe-password-123'});assert.equal(registered.status,201);
    await source.storage.queue.enqueue('work',{value:7},'imported-job',0);
    await source.db.prepare('INSERT INTO users VALUES(?,?,?,?,?)').run('invalid','x'.repeat(500),'invalid@example.com','hash','2026-10-12T00:00:00.000Z');
    target=await openDatabase({driver:'mysql',url:url.toString()});
    await assert.rejects(importSQLite(path,target));
    assert.equal((await target.prepare('SELECT count(*) AS n FROM users').get())?.n,0);
    await source.db.prepare('DELETE FROM users WHERE id=?').run('invalid');
    await new Promise<void>(resolve=>source.io.close(()=>resolve()));await source.db.close();
    const before=readFileSync(path);const counts=await importSQLite(path,target);
    assert.equal(counts.users,1);assert.equal(counts.sessions,1);assert.equal(counts.jobs,1);assert.deepEqual(readFileSync(path),before);
    assert.equal((await target.prepare('SELECT expires_at FROM sessions').get())?.expires_at!>Date.now(),true);
    await assert.rejects(importSQLite(path,target),/must be empty/);
    await target.close();target=undefined;
    const imported=await createApp({database:{driver:'mysql',url:url.toString()},uploadDir:join(dir,'uploads'),origins:[]});
    try{assert.equal((await request(imported.server).get('/api/auth/me').set('Authorization','Bearer '+registered.body.token)).body.user.name,'Imported');}
    finally{await new Promise<void>(resolve=>imported.io.close(()=>resolve()));await imported.storage.close();await imported.db.close();}
  }finally{
    await target?.close();try{await new Promise<void>(resolve=>source.io.close(()=>resolve()));await source.db.close();}catch{}
    assert.match(name,/^together_test_[a-f0-9]{32}$/);await admin.query('DROP DATABASE `'+name+'`');await admin.end();rmSync(dir,{recursive:true,force:true});
  }
});
