import type {Database} from './db.js';
import {databaseSessions,type Sessions} from './storage.js';
import {pendingChoiceCondition} from './choice-state.js';
export function pushHandler(db:Database,send:(tokens:string[],kind:string,event?:string,call?:{id:string;expires:number;name:string;kind:string})=>Promise<string[]>,sessions:Sessions=databaseSessions(db)){
  const log=(...args:unknown[])=>{if(process.env.PUSH_LOG==='true')console.log('[push]',...args);};
  return async(payload:{token:string;couple:string;kind:string;message?:string;event?:string},progress:(n:number)=>void|Promise<void>)=>{
    const token=await db.prepare('SELECT p.session_hash,p.user_id FROM push_tokens p JOIN memberships m ON m.user_id=p.user_id WHERE p.token=? AND m.couple_id=?').get(payload.token,payload.couple);
    if(!token){log('skip',payload.kind,'token not registered');return;}
    if((await sessions.get(token.session_hash))?.userId!==token.user_id){log('skip',payload.kind,'session not live');return;}
    if(payload.kind==='choice'&&!await db.prepare(`SELECT d.id FROM decisions d WHERE d.id=? AND d.couple_id=? AND d.user_id!=? AND ${pendingChoiceCondition}`).get(payload.event||payload.message||'',payload.couple,token.user_id,token.user_id,token.user_id)){log('skip',payload.kind,'choice not pending');return;}
    if(payload.kind==='message'){
      if(await db.prepare('SELECT 1 FROM chat_reading WHERE session_hash=? AND expires_at>?').get(token.session_hash,Date.now())){log('skip',payload.kind,'chat open');return;}
      if(payload.message&&await db.prepare(`SELECT 1 FROM message_reads r JOIN messages seen ON seen.id=r.message_id JOIN messages target ON target.id=? WHERE r.user_id=? AND (seen.created_at>target.created_at OR (seen.created_at=target.created_at AND seen.id>=target.id))`).get(payload.message,token.user_id)){log('skip',payload.kind,'already read');return;}
    }
    let call:any;
    if(payload.kind==='call'||payload.kind==='call_cancel'){call=await db.prepare('SELECT i.*,u.name FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.id=? AND i.couple_id=? AND i.callee_id=?').get(payload.event||'',payload.couple,token.user_id);if(!call){log('skip',payload.kind,'call gone');return;}if(payload.kind==='call'&&(call.state!=='ringing'||call.expires_at<=Date.now())){log('skip',payload.kind,'call not ringing');return;}}
    await progress(10);
    let invalid:string[];
    try{invalid=await send([payload.token],payload.kind,payload.event,call?{id:call.id,expires:call.expires_at,name:call.name,kind:call.kind}:undefined);}
    catch(error){log('failed',payload.kind,error instanceof Error?error.message:error);throw error;}
    log('sent',payload.kind,'invalid='+invalid.length);
    for(const value of invalid)await db.prepare('DELETE FROM push_tokens WHERE token=?').run(value);
  };
}
