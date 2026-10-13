import type {Database} from './db.js';
import {databaseSessions,type Sessions} from './storage.js';
import {pushText,type PushText} from './push-text.js';
export function pushHandler(db:Database,send:(tokens:string[],kind:string,event?:string,call?:{id:string;expires:number;name:string;kind:string},text?:PushText)=>Promise<string[]>,sessions:Sessions=databaseSessions(db)){
  const log=(...args:unknown[])=>console.log('[push]',...args);
  return async(payload:{token:string;couple:string;kind:string;message?:string;event?:string},progress:(n:number)=>void|Promise<void>)=>{
    const token=await db.prepare('SELECT p.session_hash,p.user_id FROM push_tokens p JOIN memberships m ON m.user_id=p.user_id WHERE p.token=? AND m.couple_id=?').get(payload.token,payload.couple);
    if(!token){log('skip',payload.kind,'token not registered');return;}
    if((await sessions.get(token.session_hash))?.userId!==token.user_id){log('skip',payload.kind,'session not live');return;}
    let call:any;
    if(payload.kind==='call'||payload.kind==='call_cancel'){call=await db.prepare('SELECT i.*,u.name FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.id=? AND i.couple_id=? AND i.callee_id=?').get(payload.event||'',payload.couple,token.user_id);if(!call){log('skip',payload.kind,'call gone');return;}if(payload.kind==='call'&&(call.state!=='ringing'||call.expires_at<=Date.now())){log('skip',payload.kind,'call not ringing');return;}}
    const previews=!!Number((await db.prepare('SELECT previews FROM notification_settings WHERE user_id=?').get(token.user_id))?.previews);
    const text=call?undefined:await pushText(db,payload.couple,payload.kind,payload.event,previews);
    await progress(10);
    let invalid:string[];
    try{invalid=await send([payload.token],payload.kind,payload.event,call?{id:call.id,expires:call.expires_at,name:call.name,kind:call.kind}:undefined,text);}
    catch(error){const code=error&&typeof error==='object'&&'code' in error?String((error as {code?:unknown}).code):undefined;log('failed',payload.kind,code||'unknown');throw error;}
    log('sent',payload.kind,'invalid='+invalid.length);
    for(const value of invalid)await db.prepare('DELETE FROM push_tokens WHERE token=?').run(value);
  };
}
