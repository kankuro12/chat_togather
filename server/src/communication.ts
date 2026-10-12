import {Router} from 'express';
import {rateLimit} from 'express-rate-limit';
import {z} from 'zod';
import type {Socket} from 'socket.io';
import {Context,HttpError,id,hash} from './context.js';
export type CommunicationOptions={firebase?:Record<string,string>;vapidKey?:string;iceServers?:{urls:string|string[];username?:string;credential?:string}[];sendPush?:(tokens:string[],kind:string,event?:string,call?:{id:string;expires:number;name:string;kind:string})=>Promise<string[]>};
export function communication(c:Context,options:CommunicationOptions={}){
  c.db.exec('CREATE TABLE IF NOT EXISTS push_tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),session_hash TEXT NOT NULL,created_at INTEGER NOT NULL)');
  c.db.exec("CREATE TABLE IF NOT EXISTS incoming_calls(id TEXT PRIMARY KEY,couple_id TEXT NOT NULL,caller_id TEXT NOT NULL,callee_id TEXT NOT NULL,kind TEXT NOT NULL,state TEXT NOT NULL,expires_at INTEGER NOT NULL); UPDATE incoming_calls SET state='ended' WHERE state!='ended';");
  const queue=c.storage.queue;
  const calls=new Map<string,{id:string;kind:'audio'|'video';caller:Socket;callee?:Socket;timer:ReturnType<typeof setTimeout>}>();
  const locations=new Map<string,{user_id:string;coupleId:string;socketId:string;expires_at:number;latitude?:number;longitude?:number;accuracy?:number;updated_at?:number;timer:ReturnType<typeof setTimeout>}>();
  async function liveTokens(sql:string,...params:import('node:sqlite').SQLInputValue[]){
    const rows=c.all(sql,...params),live=[];
    for(const row of rows){const session=await c.storage.sessions.get(row.session_hash);if(session?.userId===row.user_id)live.push(row);}
    return live;
  }
  const notify=async(couple:string,user:string,kind:string,message?:string)=>{
    const readingSessions=new Set([...c.io.sockets.sockets.values()].filter(socket=>socket.data.user?.coupleId===couple&&socket.data.chatReading&&Date.now()-socket.data.chatViewedAt<45000).map(socket=>socket.data.tokenHash));
    const tokens=(await liveTokens('SELECT p.token,p.session_hash,p.user_id FROM push_tokens p JOIN memberships m ON m.user_id=p.user_id WHERE m.couple_id=? AND p.user_id!=?',couple,user)).filter(row=>kind!=='message'||!readingSessions.has(row.session_hash)).map(row=>row.token as string);
    const event=message||id();for(const token of tokens)await queue.enqueue('push',{token,couple,kind,message,event},'push:'+kind+':'+event+':'+hash(token));
  };
  const router=Router();router.use(c.authenticated,c.paired);
  router.get('/config',(_req,res)=>res.json({firebase:options.firebase||null,vapidKey:options.vapidKey||'',notifications:!!options.sendPush,iceServers:options.iceServers||[{urls:'stun:stun.l.google.com:19302'}]}));
  router.get('/calls/incoming',(req,res)=>res.json(c.all("SELECT i.id,i.kind,u.name,i.expires_at FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.callee_id=? AND i.couple_id=? AND i.state='ringing' AND i.expires_at>?",req.identity.id,req.identity.coupleId,Date.now())));
  router.get('/calls/:id',(req,res)=>{const row=c.one("SELECT i.*,u.name FROM incoming_calls i JOIN users u ON u.id=i.caller_id WHERE i.id=? AND i.callee_id=? AND i.couple_id=? AND i.state='ringing' AND i.expires_at>?",String(req.params.id),req.identity.id,req.identity.coupleId,Date.now());if(!row)throw new HttpError(409,'Call ended.');res.json({id:row.id,kind:row.kind,name:row.name,expires_at:row.expires_at});});
  router.post('/calls/:id/decline',(req,res)=>{const row=c.one("SELECT * FROM incoming_calls WHERE id=? AND callee_id=? AND couple_id=? AND state='ringing' AND expires_at>?",String(req.params.id),req.identity.id,req.identity.coupleId,Date.now());if(!row)throw new HttpError(404,'Call unavailable.');end(row.couple_id,'Call declined');res.json({ok:true});});
  const stopLocation=(user:string)=>{const share=locations.get(user);if(!share)return;clearTimeout(share.timer);locations.delete(user);c.io.to(`couple:${share.coupleId}`).emit('location:stopped',{user_id:user});};
  router.get('/locations',(req,res)=>res.json([...locations.values()].filter(value=>value.coupleId===req.identity.coupleId&&value.latitude!==undefined&&value.expires_at>Date.now()).map(({timer,socketId,coupleId,...value})=>value)));
  const notifications=Router();notifications.use(c.authenticated,c.paired,rateLimit({windowMs:60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Please wait before changing notifications again.'}}));
  notifications.post('/token',async(req,res)=>{const {token}=z.object({token:z.string().min(20).max(4096)}).parse(req.body);for(const row of c.all('SELECT token,session_hash FROM push_tokens WHERE user_id=?',req.identity.id)){if(!(await c.storage.sessions.get(row.session_hash)))c.run('DELETE FROM push_tokens WHERE token=?',row.token);}if(Number(c.one('SELECT count(*) AS n FROM push_tokens WHERE user_id=? AND token!=?',req.identity.id,token)?.n)>=10)throw new HttpError(429,'Too many devices registered. Disable notifications on another device.');c.run('INSERT INTO push_tokens VALUES(?,?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,session_hash=excluded.session_hash,created_at=excluded.created_at',token,req.identity.id,req.identity.tokenHash,Date.now());res.json({ok:true});});
  notifications.delete('/token',(req,res)=>{c.run('DELETE FROM push_tokens WHERE session_hash=?',req.identity.tokenHash);res.json({ok:true});});
  const backgroundNotify=(couple:string,user:string,kind:string,event:string)=>{void notify(couple,user,kind,event).catch(()=>console.error('Could not queue call notification.'));};
  const end=(couple:string,reason:string)=>{const call=calls.get(couple);if(!call)return;clearTimeout(call.timer);calls.delete(couple);c.run("UPDATE incoming_calls SET state='ended' WHERE id=?",call.id);backgroundNotify(couple,call.caller.data.user.id,'call_cancel',call.id);c.io.to(`couple:${couple}`).emit('call:ended',{id:call.id,reason});};
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
      const recipient=c.one('SELECT user_id FROM memberships WHERE couple_id=? AND user_id!=?',user.coupleId,user.id);if(!recipient)throw new HttpError(409,'Pair before calling.');
      if(!partners.length&&!(await liveTokens('SELECT token,session_hash,user_id FROM push_tokens WHERE user_id=?',recipient.user_id)).length)throw new HttpError(409,'Your partner is offline and has not enabled call notifications.');
      if(calls.has(user.coupleId))throw new HttpError(409,'A call is already in progress.');
      const call={id:id(),kind,caller:socket,timer:setTimeout(()=>end(user.coupleId,'No answer'),45000)};call.timer.unref();calls.set(user.coupleId,call);c.run('INSERT INTO incoming_calls VALUES(?,?,?,?,?,?,?)',call.id,user.coupleId,user.id,recipient.user_id,kind,'ringing',Date.now()+45000);
      for(const partner of partners)partner.emit('call:incoming',{id:call.id,kind,name:user.name});await notify(user.coupleId,user.id,'call',call.id);return {id:call.id};
    });
    on('call:accept',async data=>{const call=current(data);if(call.caller.data.user.id===user.id||call.callee)throw new HttpError(409,'Call unavailable.');call.callee=socket;clearTimeout(call.timer);c.run("UPDATE incoming_calls SET state='accepted' WHERE id=?",call.id);await notify(user.coupleId,call.caller.data.user.id,'call_cancel',call.id);call.caller.emit('call:accepted',{id:call.id});socket.to(room).emit('call:claimed',{id:call.id});return {};});
    on('call:signal',async data=>{const call=current(data);if(!call.callee||(socket!==call.caller&&socket!==call.callee))throw new HttpError(403,'Call unavailable.');
      const input=z.object({id:z.uuid(),description:z.object({type:z.enum(['offer','answer']),sdp:z.string().max(32000)}).optional(),candidate:z.object({candidate:z.string().max(4096),sdpMid:z.string().nullable().optional(),sdpMLineIndex:z.number().int().min(0).nullable().optional(),usernameFragment:z.string().max(256).nullable().optional()}).optional()}).refine(v=>!!v.description!==!!v.candidate).parse(data);
      const other=socket===call.caller?call.callee:call.caller;try{await c.identity(other.handshake.auth.token);}catch{end(user.coupleId,'Call ended');throw new HttpError(409,'Call ended.');}other.emit('call:signal',input);return {};
    });
    on('call:end',data=>{const call=current(data);if(socket!==call.caller&&socket!==call.callee&&(!!call.callee||call.caller.data.user.id===user.id))throw new HttpError(403,'Call unavailable.');end(user.coupleId,call.callee?'Call ended':'Call declined');return {};});
    on('location:start',data=>{const {minutes}=z.object({minutes:z.union([z.literal(15),z.literal(60)])}).parse(data);stopLocation(user.id);lastLocation=0;const timer=setTimeout(()=>stopLocation(user.id),minutes*60000);timer.unref();const expires_at=Math.min(Date.now()+minutes*60000,user.expiresAt);locations.set(user.id,{user_id:user.id,coupleId:user.coupleId,socketId:socket.id,expires_at,timer});return {expires_at};});
    on('location:update',data=>{const share=locations.get(user.id);if(!share||share.socketId!==socket.id||share.expires_at<=Date.now())throw new HttpError(409,'Start location sharing first.');if(Date.now()-lastLocation<3000)return {};
      const position=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy:z.number().min(0).max(100000)}).parse(data);lastLocation=Date.now();Object.assign(share,position,{updated_at:Date.now()});const {timer,socketId,coupleId,...value}=share;c.io.to(room).emit('location:changed',value);return {};
    });
    on('location:stop',()=>{stopLocation(user.id);return {};});
    socket.on('disconnect',()=>{const call=calls.get(user.coupleId);if(call&&(call.caller===socket||call.callee===socket))end(user.coupleId,'Disconnected');if(locations.get(user.id)?.socketId===socket.id)stopLocation(user.id);});
  }
  c.io.on('close',()=>{for(const call of calls.values())clearTimeout(call.timer);for(const share of locations.values())clearTimeout(share.timer);});
  return {router,notifications,notify,bind};
}
