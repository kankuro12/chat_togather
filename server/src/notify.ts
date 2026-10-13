import type {Database} from './db.js';
import type {Sessions} from './storage.js';
import {hash,id} from './context.js';

type Queue={enqueue:(type:string,payload:unknown,key:string,runAt?:number)=>Promise<void>};
/** Queues one push per signed-in device of the couple, skipping `exclude` (usually the person who acted). */
export function notifier(db:Database,sessions:Sessions,queue:Queue){
  return async(couple:string,exclude:string,kind:string,message?:string)=>{
    const rows=await db.prepare('SELECT p.token,p.session_hash,p.user_id FROM push_tokens p JOIN memberships m ON m.user_id=p.user_id WHERE m.couple_id=? AND p.user_id!=?').all(couple,exclude);
    const event=message||id();
    for(const row of rows){const session=await sessions.get(row.session_hash);if(session?.userId!==row.user_id)continue;await queue.enqueue('push',{token:row.token,couple,kind,message,event},'push:'+kind+':'+event+':'+hash(row.token));}
  };
}
