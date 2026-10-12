import type {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
export function jobQueue(db:DatabaseSync){
  db.exec(`CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,type TEXT NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,run_at INTEGER NOT NULL,lease_until INTEGER,owner TEXT,progress INTEGER NOT NULL DEFAULT 0,error TEXT,created_at INTEGER NOT NULL,finished_at INTEGER);
    CREATE INDEX IF NOT EXISTS jobs_due ON jobs(state,run_at,lease_until);
    CREATE TABLE IF NOT EXISTS chat_reading(session_hash TEXT PRIMARY KEY,expires_at INTEGER NOT NULL);`);
  function enqueue(type:string,payload:unknown,key:string,runAt=Date.now()){
    db.prepare('INSERT OR IGNORE INTO jobs(id,type,payload,run_at,created_at) VALUES(?,?,?,?,?)').run(key,type,JSON.stringify(payload),runAt,Date.now());
  }
  async function runOne(handlers:Record<string,(payload:any,progress:(value:number)=>void)=>Promise<void>>,time=Date.now()){
    db.prepare("UPDATE jobs SET state='failed',error='Retry limit reached',finished_at=? WHERE state='running' AND lease_until<=? AND attempts>=5").run(time,time);
    const started=Date.now(),owner=randomUUID();
    const job=db.prepare(`UPDATE jobs SET state='running',owner=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM jobs WHERE attempts<5 AND ((state='queued' AND run_at<=?) OR (state='running' AND lease_until<=?)) ORDER BY run_at,created_at LIMIT 1) RETURNING *`).get(owner,time+60000,time,time) as any;
    if(!job)return false;
    const heartbeat=setInterval(()=>{db.prepare("UPDATE jobs SET lease_until=? WHERE id=? AND owner=? AND state='running'").run(Date.now()+60000,job.id,owner);},10000);heartbeat.unref();
    try{
      const handler=handlers[job.type];if(!handler)throw new Error('Unknown job type');
      await handler(JSON.parse(job.payload),value=>db.prepare("UPDATE jobs SET progress=? WHERE id=? AND owner=? AND state='running'").run(Math.max(0,Math.min(100,Math.round(value))),job.id,owner));
      db.prepare("UPDATE jobs SET state='done',progress=100,finished_at=?,lease_until=NULL,owner=NULL,error=NULL WHERE id=? AND owner=?").run(Date.now(),job.id,owner);
    }catch{
      db.prepare("UPDATE jobs SET state=?,run_at=?,error=?,finished_at=?,lease_until=NULL,owner=NULL WHERE id=? AND owner=?").run(job.attempts>=5?'failed':'queued',time+(Date.now()-started)+Math.min(300000,1000*2**job.attempts),job.attempts>=5?'Retry limit reached':'Delivery failed; retry scheduled',job.attempts>=5?Date.now():null,job.id,owner);
    }finally{clearInterval(heartbeat);}
    return true;
  }
  return {enqueue,runOne};
}
