import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { Context, HttpError, id, now } from './context.js';

export function chatRoutes(c:Context,notify?:(couple:string,user:string,kind:string,message?:string)=>Promise<void>){
  const router=Router();router.use(c.authenticated,c.paired);
  router.get('/read-state',(req,res)=>{
    const own=c.one('SELECT m.* FROM message_reads r JOIN messages m ON m.id=r.message_id WHERE r.user_id=?',req.identity.id);
    const partner=c.one('SELECT m.id,m.created_at FROM message_reads r JOIN messages m ON m.id=r.message_id JOIN memberships p ON p.user_id=r.user_id WHERE p.couple_id=? AND p.user_id!=?',req.identity.coupleId,req.identity.id);
    const unread=c.one(`SELECT count(*) AS n FROM messages WHERE couple_id=? AND user_id!=? ${own?'AND (created_at>? OR (created_at=? AND id>?))':''}`,req.identity.coupleId,req.identity.id,...(own?[own.created_at,own.created_at,own.id]:[]));
    res.json({unread:Number(unread?.n||0),partner:partner||null});
  });
  router.post('/read',(req,res)=>{
    const input=z.object({message_id:z.uuid()}).parse(req.body),target=c.owned('messages',input.message_id,req);
    const previous=c.one('SELECT m.* FROM message_reads r JOIN messages m ON m.id=r.message_id WHERE r.user_id=?',req.identity.id);
    if(!previous||target.created_at>previous.created_at||(target.created_at===previous.created_at&&target.id>previous.id)){
      c.run('INSERT INTO message_reads VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET message_id=excluded.message_id',req.identity.id,target.id);
      c.changed(req.identity.coupleId!,'read-state');
    }
    res.json({ok:true});
  });
  const message=(resource:string)=>c.one('SELECT m.*,u.name AS sender_name,media.mime AS media_mime,md.decision_id,md.event AS choice_event FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN media ON media.id=m.media_id LEFT JOIN message_decisions md ON md.message_id=m.id WHERE m.id=?',resource);
  router.get('/',(req,res)=>{
    const before=typeof req.query.before==='string'?c.owned('messages',req.query.before,req):null;
    const rows=c.all(`SELECT m.*,u.name AS sender_name,media.mime AS media_mime,md.decision_id,md.event AS choice_event FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN media ON media.id=m.media_id LEFT JOIN message_decisions md ON md.message_id=m.id WHERE m.couple_id=? ${before?'AND (m.created_at<? OR (m.created_at=? AND m.id<?))':''} ORDER BY m.created_at DESC,m.id DESC LIMIT 100`,...([req.identity.coupleId,...(before?[before.created_at,before.created_at,before.id]:[])]));
    res.json(rows.reverse());
  });
  router.post('/',rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Sending too quickly. Try again shortly.'}}),async(req,res)=>{
    const input=z.object({text:z.string().trim().max(4000).default(''),media_id:z.uuid().optional(),client_id:z.string().min(1).max(100)}).refine(v=>!!v.text||!!v.media_id,'Write a message or attach media.').parse(req.body);
    if(input.media_id)c.owned('media',input.media_id,req);
    const existing=c.one('SELECT id FROM messages WHERE user_id=? AND client_id=?',req.identity.id,input.client_id);
    if(existing){await notify?.(req.identity.coupleId!,req.identity.id,'message',existing.id);res.json(message(existing.id));return;}
    const resource=id();c.transaction(()=>{c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.text,input.media_id||null,input.client_id,now());});
    await notify?.(req.identity.coupleId!,req.identity.id,'message',resource);
    c.changed(req.identity.coupleId,'messages');res.status(201).json(message(resource));
  });return router;
}

export function realtime(c:Context,bind?:(socket:import('socket.io').Socket)=>void){
  c.io.use(async(socket,next)=>{
    try{const user=await c.identity(socket.handshake.auth.token);if(!user.coupleId)throw new HttpError(403,'Pair first.');socket.data.user=user;socket.data.tokenHash=user.tokenHash;next();}catch{next(new Error('Sign in and pair before connecting.'));}
  });
  function presence(couple:string){
    const users=[...new Set([...c.io.sockets.sockets.values()].filter(s=>s.data.user?.coupleId===couple).map(s=>s.data.user.id))];
    c.io.to(`couple:${couple}`).emit('presence',users);
  }
  c.io.on('connection',socket=>{
    bind?.(socket);const user=socket.data.user;const room=`couple:${user.coupleId}`;socket.join(room);presence(user.coupleId);
    let lastTyping=0;
    socket.on('chat:view',async(active:unknown)=>{try{await c.identity(socket.handshake.auth.token);socket.data.chatReading=active===true;socket.data.chatViewedAt=Date.now();c.run('INSERT INTO chat_reading VALUES(?,?) ON CONFLICT(session_hash) DO UPDATE SET expires_at=excluded.expires_at',socket.data.tokenHash,active===true?Date.now()+45000:0);}catch{socket.disconnect(true);}});
    socket.on('typing',async(active:unknown)=>{
      try{await c.identity(socket.handshake.auth.token);}catch{socket.disconnect(true);return;}
      if(typeof active!=='boolean'||Date.now()-lastTyping<500)return;lastTyping=Date.now();
      socket.to(room).emit('typing',{user_id:user.id,name:user.name,active});
    });
    const expiry=setTimeout(()=>socket.disconnect(true),Math.max(0,user.expiresAt-Date.now()));expiry.unref();
    socket.on('disconnect',()=>{clearTimeout(expiry);c.run('DELETE FROM chat_reading WHERE session_hash=?',socket.data.tokenHash);socket.to(room).emit('typing',{user_id:user.id,name:user.name,active:false});presence(user.coupleId);});
  });
}
