import type {Database} from './db.js';
import {nextOccurrence,zonedTime} from './us.js';

type Notify=(couple:string,exclude:string,kind:string,message?:string)=>Promise<void>;
type Queue={enqueue:(type:string,payload:unknown,key:string,runAt?:number)=>Promise<void>};
/** Scheduled pushes for the Us tab: special-date mornings (repeating yearly) and love notes unlocking. */
export function usJobHandlers(db:Database,queue:Queue,notify:Notify){
  return {
    'date-reminder':async(payload:{couple:string;date_id:string;occurrence:string;version:string})=>{
      const row=await db.prepare('SELECT * FROM special_dates WHERE id=? AND couple_id=?').get(payload.date_id,payload.couple);
      if(!row||row.updated_at!==payload.version)return;
      await notify(payload.couple,'','date',`${row.id}:${payload.occurrence}`);
      if(!Number(row.yearly))return;
      const following=new Date(Date.parse(payload.occurrence+'T00:00:00Z')+86400000).toISOString().slice(0,10);
      const next=nextOccurrence(row.date,following,true);if(!next)return;
      await queue.enqueue('date-reminder',{...payload,occurrence:next},`date:${row.id}:${next}:${row.updated_at}`,zonedTime(next,9,row.timezone));
    },
    'note-unlock':async(payload:{couple:string;note_id:string})=>{
      const note=await db.prepare('SELECT user_id FROM love_notes WHERE id=? AND couple_id=?').get(payload.note_id,payload.couple);
      if(note)await notify(payload.couple,note.user_id,'note',payload.note_id);
    },
  };
}
