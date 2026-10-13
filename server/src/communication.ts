import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import type {Socket} from 'socket.io';
import {Context,HttpError,id,hash} from './context.js';
import {notifier} from './notify.js';
export type CommunicationOptions={firebase?:Record<string,string>;vapidKey?:string;iceServers?:{urls:string|string[];username?:string;credential?:string}[];sendPush?:(tokens:string[],kind:string,event?:string,call?:{id:string;expires:number;name:string;kind:string},text?:import('./push-text.js').PushText)=>Promise<string[]>};
export function communication(c:Context,options:CommunicationOptions={}){
  const queue=c.storage.queue;
  const calls=new Map<string,{id:string;kind:'audio'|'video';caller:Socket;callee?:Socket;timer:ReturnType<typeof setTimeout>;ready?:Promise<void>}>();
  const locations=new Map<string,{user_id:string;coupleId:string;socketId:string;expires_at:number;latitude?:number;longitude?:number;accuracy?:number;updated_at?:number;timer:ReturnType<typeof setTimeout>}>();
  async function liveTokens(sql:string,...params:import('./db.js').SQLInputValue[]){
    const rows=await c.all(sql,...params),live=[];
    for(const row of rows){const session=await c.storage.sessions.get(row.session_hash);if(session?.userId===row.user_id)live.push(row);}
    return live;
  }
  const notify=notifier(c.db,c.storage.sessions,queue);
  const router=Router();router.use(c.authenticated,c.paired);
  router.get('/config',(_req,res)=>res.json({firebase:options.firebase||null,vapidKey:options.vapidKey||'',notifications:!!options.sendPush,iceServers:options.iceServers||[{urls:'stun:stun.l.google.com:19302'}]}));
  router.get('/calls/incoming',async(req,res)=>res.json(await c.all("SELECT i.id,i.kind,u.name,i.expires_at FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.callee_id=? AND i.couple_id=? AND i.state='ringing' AND i.expires_at>?",req.identity.id,req.identity.coupleId,Date.now())));
  router.get('/calls/:id',async(req,res)=>{const row=await c.one("SELECT i.*,u.name FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.id=? AND i.callee_id=? AND i.couple_id=? AND i.state='ringing' AND i.expires_at>?",String(req.params.id),req.identity.id,req.identity.coupleId,Date.now());if(!row)throw new HttpError(409,'Call ended.');res.json({id:row.id,kind:row.kind,name:row.name,expires_at:row.expires_at});});
  router.post('/calls/:id/decline',async(req,res)=>{const row=await c.one("SELECT * FROM incoming_calls WHERE id=? AND callee_id=? AND couple_id=? AND state='ringing' AND expires_at>?",String(req.params.id),req.identity.id,req.identity.coupleId,Date.now());if(!row)throw new HttpError(404,'Call unavailable.');const call=calls.get(row.couple_id);if(call?.id===row.id)await end(row.couple_id,'Call declined');else await c.run("UPDATE incoming_calls SET state='ended' WHERE id=? AND callee_id=? AND couple_id=? AND state='ringing' AND expires_at>?",row.id,req.identity.id,req.identity.coupleId,Date.now());res.json({ok:true});});
  const stopLocation=(user:string)=>{const share=locations.get(user);if(!share)return;clearTimeout(share.timer);locations.delete(user);c.io.to(`couple:${share.coupleId}`).emit('location:stopped',{user_id:user});};
  router.get('/locations',(req,res)=>res.json([...locations.values()].filter(value=>value.coupleId===req.identity.coupleId&&value.latitude!==undefined&&value.expires_at>Date.now()).map(({timer,socketId,coupleId,...value})=>value)));
  const notifications=Router();notifications.use(c.authenticated,c.paired,rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait before changing notifications again.'}}));
  notifications.post('/token',async(req,res)=>{const {token}=z.object({token:z.string().min(20).max(4096)}).parse(req.body);for(const row of await c.all('SELECT token,session_hash FROM push_tokens WHERE user_id=?',req.identity.id)){if(!(await c.storage.sessions.get(row.session_hash)))await c.run('DELETE FROM push_tokens WHERE token=?',row.token);}if(Number((await c.one('SELECT count(*) AS n FROM push_tokens WHERE user_id=? AND token!=?',req.identity.id,token))?.n)>=10)throw new HttpError(429,'Too many devices registered. Disable notifications on another device.');await c.run('INSERT INTO push_tokens(token,user_id,session_hash,created_at) VALUES(?,?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,created_at=excluded.created_at',token,req.identity.id,req.identity.tokenHash,Date.now());res.json({ok:true});});
  // Message text stays off the lock screen unless the person opts in.
  notifications.get('/settings',async(req,res)=>res.json({previews:!!Number((await c.one('SELECT previews FROM notification_settings WHERE user_id=?',req.identity.id))?.previews)}));
  notifications.put('/settings',async(req,res)=>{const {previews}=z.object({previews:z.boolean()}).parse(req.body);await c.run('INSERT INTO notification_settings VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET previews=excluded.previews',req.identity.id,previews?1:0);res.json({previews});});
  notifications.delete('/token',async(req,res)=>{await c.run('DELETE FROM push_tokens WHERE session_hash=?',req.identity.tokenHash);res.json({ok:true});});
  const backgroundNotify=(couple:string,user:string,kind:string,event:string)=>{void notify(couple,user,kind,event).catch(()=>console.error('Could not queue call notification.'));};
  const end=async(couple:string,reason:string)=>{const call=calls.get(couple);if(!call)return;clearTimeout(call.timer);calls.delete(couple);if(call.ready)await call.ready;await c.run("UPDATE incoming_calls SET state='ended' WHERE id=?",call.id);backgroundNotify(couple,call.caller.data.user.id,'call_cancel',call.id);c.io.to(`couple:${couple}`).emit('call:ended',{id:call.id,reason});};
  const reportEnd=(promise:Promise<void>)=>{void promise.catch(error=>console.error('Could not end call:',error instanceof Error?error.message:error));};
  function bind(socket:Socket){
    const user=socket.data.user,room=`couple:${user.coupleId}`;let count=0,window=Date.now(),lastLocation=0;
    const on=(name:string,handler:(data:any)=>any)=>socket.on(name,async(data:any,ack?:any)=>{
      try{await c.identity(socket.handshake.auth.token);if(Date.now()-window>60000){window=Date.now();count=0;}if(++count>180)throw new HttpError(429,'Please wait a moment.');const result=await handler(data);if(typeof ack==='function')ack({ok:true,...result});}
      catch(error){if(typeof ack==='function')ack({ok:false,error:error instanceof HttpError?error.message:'Could not complete this action.'});}
    });
    const current=(data:any)=>{const call=calls.get(user.coupleId);if(!call||call.id!==data?.id)throw new HttpError(409,'Call ended.');return call;};
    on('call:start',async data=>{
      const {kind}=z.object({kind:z.enum(['audio','video'])}).parse(data);if(calls.has(user.coupleId))throw new HttpError(409,'A call is already in progress.');
      const partners:Socket[]=[];for(const other of c.io.sockets.sockets.values()){if(other.data.user?.coupleId===user.coupleId&&other.data.user.id!==user.id&&other.connected){try{await c.identity(other.handshake.auth.token);partners.push(other);}catch{}}}
      const recipient=await c.one('SELECT user_id FROM memberships WHERE couple_id=? AND user_id!=?',user.coupleId,user.id);if(!recipient)throw new HttpError(409,'Pair before calling.');
      if(!partners.length&&!(await liveTokens('SELECT token,session_hash,user_id FROM push_tokens WHERE user_id=?',recipient.user_id)).length)throw new HttpError(409,'Your partner is offline and has not enabled call notifications.');
      if(calls.has(user.coupleId))throw new HttpError(409,'A call is already in progress.');
      const call:{id:string;kind:'audio'|'video';caller:Socket;timer:ReturnType<typeof setTimeout>;ready?:Promise<void>}={id:id(),kind,caller:socket,timer:setTimeout(()=>reportEnd(end(user.coupleId,'No answer')),45000)};call.timer.unref();calls.set(user.coupleId,call);call.ready=Promise.resolve(c.run('INSERT INTO incoming_calls VALUES(?,?,?,?,?,?,?)',call.id,user.coupleId,user.id,recipient.user_id,kind,'ringing',Date.now()+45000) as any);try{await call.ready;}catch(error){clearTimeout(call.timer);calls.delete(user.coupleId);throw error;}
      if(calls.get(user.coupleId)!==call||!socket.connected){if(calls.get(user.coupleId)===call)await end(user.coupleId,'Disconnected');throw new HttpError(409,'Call ended.');}
      for(const partner of partners)partner.emit('call:incoming',{id:call.id,kind,name:user.name});await notify(user.coupleId,user.id,'call',call.id);return {id:call.id};
    });
    on('call:accept',async data=>{const call=current(data);if(call.caller.data.user.id===user.id||call.callee)throw new HttpError(409,'Call unavailable.');call.callee=socket;if(call.ready)await call.ready;if(calls.get(user.coupleId)!==call||!socket.connected||call.callee!==socket)throw new HttpError(409,'Call ended.');clearTimeout(call.timer);await c.run("UPDATE incoming_calls SET state='accepted' WHERE id=?",call.id);await notify(user.coupleId,call.caller.data.user.id,'call_cancel',call.id);call.caller.emit('call:accepted',{id:call.id});socket.to(room).emit('call:claimed',{id:call.id});return {};});
    on('call:signal',async data=>{const call=current(data);if(!call.callee||(socket!==call.caller&&socket!==call.callee))throw new HttpError(403,'Call unavailable.');
      const input=z.object({id:z.uuid(),description:z.object({type:z.enum(['offer','answer']),sdp:z.string().max(32000)}).optional(),candidate:z.object({candidate:z.string().max(4096),sdpMid:z.string().nullable().optional(),sdpMLineIndex:z.number().int().min(0).nullable().optional(),usernameFragment:z.string().max(256).nullable().optional()}).optional()}).refine(v=>!!v.description!==!!v.candidate).parse(data);
      const other=socket===call.caller?call.callee:call.caller;try{await c.identity(other.handshake.auth.token);}catch{reportEnd(end(user.coupleId,'Call ended'));throw new HttpError(409,'Call ended.');}if(calls.get(user.coupleId)!==call||!call.callee)throw new HttpError(409,'Call ended.');other.emit('call:signal',input);return {};
    });
    on('call:end',async data=>{const call=current(data);if(socket!==call.caller&&socket!==call.callee&&(!!call.callee||call.caller.data.user.id===user.id))throw new HttpError(403,'Call unavailable.');await end(user.coupleId,call.callee?'Call ended':'Call declined');return {};});
    on('location:start',data=>{const {minutes}=z.object({minutes:z.union([z.literal(15),z.literal(60)])}).parse(data);stopLocation(user.id);lastLocation=0;const timer=setTimeout(()=>stopLocation(user.id),minutes*60000);timer.unref();const expires_at=Math.min(Date.now()+minutes*60000,user.expiresAt);locations.set(user.id,{user_id:user.id,coupleId:user.coupleId,socketId:socket.id,expires_at,timer});return {expires_at};});
    on('location:update',data=>{const share=locations.get(user.id);if(!share||share.socketId!==socket.id||share.expires_at<=Date.now())throw new HttpError(409,'Start location sharing first.');if(Date.now()-lastLocation<3000)return {};
      const position=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0).max(100000)}).parse(data);lastLocation=Date.now();Object.assign(share,position,{updated_at:Date.now()});const {timer,socketId,coupleId,...value}=share;c.io.to(room).emit('location:changed',value);return {};
    });
    on('location:stop',()=>{stopLocation(user.id);return {};});
    socket.on('disconnect',()=>{const call=calls.get(user.coupleId);if(call&&(call.caller===socket||call.callee===socket))reportEnd(end(user.coupleId,'Disconnected'));if(locations.get(user.id)?.socketId===socket.id)stopLocation(user.id);});
  }
  c.io.on('close',()=>{for(const call of calls.values())clearTimeout(call.timer);for(const share of locations.values())clearTimeout(share.timer);});
  return {router,notifications,notify,bind};
}
