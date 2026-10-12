import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../src/db.js';
import {jobQueue} from '../src/jobs.js';
test('jobs survive restart, deduplicate, retry, persist progress and recover expired leases',async()=>{
const dir=mkdtempSync(join(tmpdir(),'together-jobs-')),path=join(dir,'jobs.db');let db=await openDatabase(path);
try{
let queue=jobQueue(db);await queue.enqueue('work',{value:7},'same',0);await queue.enqueue('work',{value:8},'same',0);await db.close();db=await openDatabase(path);queue=jobQueue(db);
assert.equal((await db.prepare('SELECT count(*) AS n FROM jobs').get())?.n,1);
await queue.runOne({work:async(payload,progress)=>{assert.equal(payload.value,7);progress(40);throw new Error('private failure');}},100);
let row=await db.prepare('SELECT * FROM jobs').get() as any;assert.equal(row.state,'queued');assert.equal(row.progress,40);assert.equal(row.attempts,1);assert.equal(await queue.runOne({work:async()=>{}},200),false);
await queue.runOne({work:async()=>{}},row.run_at);assert.equal((await db.prepare('SELECT state FROM jobs').get())?.state,'done');
await queue.enqueue('work',{},'crashed',0);await db.prepare("UPDATE jobs SET state='running',lease_until=0,owner='dead',attempts=1 WHERE id='crashed'").run();
await queue.runOne({work:async()=>{}},100);assert.equal((await db.prepare("SELECT state FROM jobs WHERE id='crashed'").get())?.state,'done');
await queue.enqueue('work',{},'fail',0);for(let i=0;i<5;i++){const next=await db.prepare("SELECT run_at FROM jobs WHERE id='fail'").get() as any;await queue.runOne({work:async()=>{throw new Error('failure');}},next.run_at);}
assert.equal((await db.prepare("SELECT state FROM jobs WHERE id='fail'").get())?.state,'failed');
}finally{await db.close();rmSync(dir,{recursive:true,force:true});}
});
test('two connections cannot claim one active job',async()=>{
const dir=mkdtempSync(join(tmpdir(),'together-lease-')),path=join(dir,'jobs.db'),a=await openDatabase(path),b=await openDatabase(path);
try{const qa=jobQueue(a),qb=jobQueue(b);await qa.enqueue('work',{},'one',0);let finish!:()=>void;const active=qa.runOne({work:async()=>new Promise<void>(resolve=>finish=resolve)});assert.equal(await qb.runOne({work:async()=>assert.fail('duplicate claim')}),false);finish();await active;}finally{await a.close();await b.close();rmSync(dir,{recursive:true,force:true});}
});
