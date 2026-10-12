import {Queue,Worker} from 'bullmq';
import type {Redis} from 'ioredis';
import {createHash,randomUUID} from 'node:crypto';
import type {JobHandlers} from './jobs.js';

export function redisQueue(redis:Redis,prefix:string){
  const queue=new Queue('jobs',{connection:redis,prefix});
  let worker:Worker|undefined;
  let workerConnection:Redis|undefined;
  queue.on('error',()=>console.error('Redis queue connection failed.'));
  async function enqueue(type:string,payload:unknown,key:string,runAt=Date.now()){
    // BullMQ reserves colons in IDs; hashing preserves existing deduplication keys.
    await queue.add(type,payload,{jobId:createHash('sha256').update(key).digest('hex'),delay:Math.max(0,runAt-Date.now()),attempts:5,backoff:{type:'exponential',delay:2000},removeOnComplete:false,removeOnFail:false});
  }
  async function runOne(handlers:JobHandlers){
    if(!worker){
      workerConnection=redis.duplicate({maxRetriesPerRequest:null,enableOfflineQueue:true});
      worker=new Worker('jobs',null,{connection:workerConnection,prefix,lockDuration:60000,maxStalledCount:4});
      worker.on('error',()=>console.error('Redis worker connection failed.'));
      await worker.startStalledCheckTimer();
    }
    const owner=randomUUID(),job=await worker.getNextJob(owner,{block:false});
    if(!job)return false;
    const heartbeat=setInterval(()=>{void job.extendLock(owner,60000).catch(()=>console.error('Redis job lease renewal failed.'));},10000);heartbeat.unref();
    try{
      const handler=handlers[job.name];if(!handler)throw new Error('Unknown job type');
      // Serialize progress writes before completing or retrying the job.
      let updates=Promise.resolve();
      const progress=(value:number)=>updates=updates.then(()=>job.updateProgress(Math.max(0,Math.min(100,Math.round(value)))));
      let failed=false;
      try{await handler(job.data,progress);}catch{failed=true;}
      await updates;
      if(failed)throw new Error('Delivery failed');
      await job.updateProgress(100);await job.moveToCompleted(null,owner,false);
    }catch{
      await job.moveToFailed(new Error(job.attemptsMade>=4?'Retry limit reached':'Delivery failed; retry scheduled'),owner,false);
    }finally{clearInterval(heartbeat);}
    return true;
  }
  async function status(){
    const counts=await queue.getJobCounts('waiting','active','delayed','completed','failed');
    const jobs=await queue.getJobs(['waiting','active','delayed','completed','failed'],0,19);
    return {counts:Object.entries(counts).map(([state,count])=>({state,count})),jobs:await Promise.all(jobs.map(async job=>{
      const state=await job.getState();
      return {type:job.name,state:({completed:'done',active:'running',waiting:'queued',delayed:'queued'} as Record<string,string>)[state]||state,attempts:job.attemptsMade,progress:job.progress,error:job.failedReason||null,created_at:job.timestamp,finished_at:job.finishedOn||null};
    }))};
  }
  return {enqueue,runOne,status,ready:async()=>{await queue.waitUntilReady();},close:async()=>{await worker?.close();workerConnection?.disconnect();await queue.close();}};
}
