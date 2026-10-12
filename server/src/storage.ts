import type {Database} from './db.js';
import {Redis} from 'ioredis';
import {jobQueue} from './jobs.js';
import {redisQueue} from './redis-jobs.js';

export type StorageOptions={driver?:string;redisUrl?:string;prefix?:string};
export type Session={userId:string;expiresAt:number};
export type Sessions={
  create:(tokenHash:string,userId:string,expiresAt:number)=>void|Promise<void>;
  get:(tokenHash:string)=>Session|undefined|Promise<Session|undefined>;
  delete:(tokenHash:string)=>void|Promise<void>;
};
export function storageOptions(env:NodeJS.ProcessEnv=process.env):StorageOptions{
  return {driver:env.STORAGE_DRIVER||'db',redisUrl:env.REDIS_URL||'redis://127.0.0.1:6379',prefix:env.REDIS_PREFIX||'together'};
}
export function validateStorage(options:StorageOptions){
  if(options.driver!==undefined&&options.driver!=='db'&&options.driver!=='redis')throw new Error('STORAGE_DRIVER must be db or redis.');
}
export function databaseSessions(db:Database):Sessions{
  return {
    create:async(key,user,expires)=>{await db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(key,user,expires);},
    get:async key=>{const row=await db.prepare('SELECT user_id,expires_at FROM sessions WHERE token_hash=? AND expires_at>?').get(key,Date.now());return row?{userId:row.user_id as string,expiresAt:row.expires_at as number}:undefined;},
    delete:async key=>{await db.prepare('DELETE FROM sessions WHERE token_hash=?').run(key);},
  };
}
export function createStorage(db:Database,options:StorageOptions={}){
  validateStorage(options);
  if(options.driver!=='redis')return {sessions:databaseSessions(db),queue:jobQueue(db),ready:async()=>{},close:async()=>{}};
  const prefix=options.prefix||'together';
  const redis=new Redis(options.redisUrl||'redis://127.0.0.1:6379',{lazyConnect:true,maxRetriesPerRequest:1,enableOfflineQueue:false,connectTimeout:5000});
  redis.on('error',()=>console.error('Redis storage connection failed.'));
  const sessions:Sessions={
    create:async(key,userId,expiresAt)=>{await redis.set(prefix+':session:'+key,JSON.stringify({userId,expiresAt}),'PX',Math.max(1,expiresAt-Date.now()));},
    get:async key=>{const value=await redis.get(prefix+':session:'+key);if(!value)return;const session=JSON.parse(value) as Session;return session.expiresAt>Date.now()?session:undefined;},
    delete:async key=>{await redis.del(prefix+':session:'+key);},
  };
  const queue=redisQueue(redis,prefix);
  return {sessions,queue,ready:async()=>{await queue.ready();await redis.ping();},close:async()=>{await queue.close();redis.disconnect();}};
}
export type Storage=ReturnType<typeof createStorage>;
