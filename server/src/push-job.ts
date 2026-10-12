import type {DatabaseSync} from 'node:sqlite';
import {databaseSessions,type Sessions} from './storage.js';
export function pushHandler(db:DatabaseSync,send:(tokens:string[],kind:string,event?:string,call?:{id:string;expires:number;name:string;kind:string})=>Promise<string[]>,sessions:Sessions=databaseSessions(db)){
  return async(payload:{token:string;couple:string;kind:string;message?:string;event?:string},progress:(n:number)=>void|Promise<void>)=>{
    const token=db.prepare('SELECT p.session_hash,p.user_id FROM push_tokens p JOIN memberships m ON m.user_id=p.user_id WHERE p.token=? AND m.couple_id=?').get(payload.token,payload.couple) as any;
    if(!token||(await sessions.get(token.session_hash))?.userId!==token.user_id)return;
    if(payload.kind==='message'){
      if(db.prepare('SELECT 1 FROM chat_reading WHERE session_hash=? AND expires_at>?').get(token.session_hash,Date.now()))return;
      if(payload.message&&db.prepare(`SELECT 1 FROM message_reads r JOIN messages seen ON seen.id=r.message_id JOIN messages target ON target.id=? WHERE r.user_id=? AND (seen.created_at>target.created_at OR (seen.created_at=target.created_at AND seen.id>=target.id))`).get(payload.message,token.user_id))return;
    }
    let call:any;
    if(payload.kind==='call'||payload.kind==='call_cancel'){call=db.prepare('SELECT i.*,u.name FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.id=? AND i.couple_id=? AND i.callee_id=?').get(payload.event||'',payload.couple,token.user_id) as any;if(!call)return;if(payload.kind==='call'&&(call.state!=='ringing'||call.expires_at<=Date.now()))return;}
    await progress(10);const invalid=await send([payload.token],payload.kind,payload.event,call?{id:call.id,expires:call.expires_at,name:call.name,kind:call.kind}:undefined);
    for(const value of invalid)db.prepare('DELETE FROM push_tokens WHERE token=?').run(value);
  };
}
