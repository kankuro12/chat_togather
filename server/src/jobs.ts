import type {Database,Row} from './db.js';
import {randomUUID} from 'node:crypto';
export type JobHandlers=Record<string,(payload:any,progress:(value:number)=>void|Promise<void>)=>Promise<void>>;
export function jobQueue(db:Database){
  async function enqueue(type:string,payload:unknown,key:string,runAt=Date.now()){
    await db.prepare('INSERT OR IGNORE INTO jobs(id,type,payload,run_at,created_at) VALUES(?,?,?,?,?)').run(key,type,JSON.stringify(payload),runAt,Date.now());
  }
  async function runOne(handlers:JobHandlers,time=Date.now()){
    await db.prepare("UPDATE jobs SET state='failed',error='Retry limit reached',finished_at=? WHERE state='running' AND lease_until<=? AND attempts>=5").run(time,time);
    const started=Date.now(),owner=randomUUID();
    const job:Row|undefined=db.driver==='mysql'?await db.transaction(async()=>{
      const row=await db.prepare("SELECT * FROM jobs WHERE attempts<5 AND ((state='queued' AND run_at<=?) OR (state='running' AND lease_until<=?)) ORDER BY run_at,created_at LIMIT 1 FOR UPDATE").get(time,time);
      if(!row)return;
      await db.prepare("UPDATE jobs SET state='running',owner=?,lease_until=?,attempts=attempts+1 WHERE id=?").run(owner,time+60000,row.id);
      return {...row,attempts:row.attempts+1};
    }):await db.prepare(`UPDATE jobs SET state='running',owner=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE attempts<5 AND ((state='queued' AND run_at<=?) OR (state='running' AND lease_until<=?)) ORDER BY run_at,created_at LIMIT 1) RETURNING *`).get(owner,time+60000,time,time);
    if(!job)return false;
    const heartbeat=setInterval(()=>{void db.prepare("UPDATE jobs SET lease_until=? WHERE id=? AND owner=? AND state='running'").run(Date.now()+60000,job.id,owner).catch(()=>console.error('Database job lease renewal failed.'));},10000);heartbeat.unref();
    try{
      const handler=handlers[job.type];if(!handler)throw new Error('Unknown job type');
      let updates=Promise.resolve();const progress=(value:number)=>updates=updates.then(async()=>{await db.prepare("UPDATE jobs SET progress=? WHERE id=? AND owner=? AND state='running'").run(Math.max(0,Math.min(100,Math.round(value))),job.id,owner);});
      let failed=false;try{await handler(JSON.parse(job.payload),progress);}catch{failed=true;}
      await updates;if(failed)throw new Error('Delivery failed');
      await db.prepare("UPDATE jobs SET state='done',progress=100,finished_at=?,lease_until=NULL,owner=NULL,error=NULL WHERE id=? AND owner=?").run(Date.now(),job.id,owner);
    }catch{
      await db.prepare("UPDATE jobs SET state=?,run_at=?,error=?,finished_at=?,lease_until=NULL,owner=NULL WHERE id=? AND owner=?").run(job.attempts>=5?'failed':'queued',time+(Date.now()-started)+Math.min(300000,1000*2**job.attempts),job.attempts>=5?'Retry limit reached':'Delivery failed; retry scheduled',job.attempts>=5?Date.now():null,job.id,owner);
    }finally{clearInterval(heartbeat);}
    return true;
  }
  const status=async()=>({counts:await db.prepare('SELECT state,count(*) AS count FROM jobs GROUP BY state').all(),jobs:await db.prepare('SELECT type,state,attempts,progress,error,created_at,finished_at FROM jobs ORDER BY created_at DESC LIMIT 20').all()});
  return {enqueue,runOne,status};
}
