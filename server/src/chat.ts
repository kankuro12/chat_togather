import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { Context, HttpError, id, now, type Row } from './context.js';

export function chatRoutes(c:Context,notify?:(couple:string,user:string,kind:string,message?:string)=>Promise<void>){
  const router=Router();router.use(c.authenticated,c.paired);
  router.get('/read-state',async(req,res)=>{
    const own=await c.one('SELECT m.* FROM message_reads r JOIN messages m ON m.id=r.message_id WHERE r.user_id=?',req.identity.id);
    const partner=await c.one('SELECT m.id,m.created_at FROM message_reads r JOIN messages m ON m.id=r.message_id JOIN memberships p ON p.user_id=r.user_id WHERE p.couple_id=? AND p.user_id!=?',req.identity.coupleId,req.identity.id);
    const unread=await c.one(`SELECT count(*) AS n FROM messages WHERE couple_id=? AND user_id!=? ${own?'AND (created_at>? OR (created_at=? AND id>?))':''}`,req.identity.coupleId,req.identity.id,...(own?[own.created_at,own.created_at,own.id]:[]));
    res.json({unread:Number(unread?.n||0),partner:partner||null});
  });
  router.post('/read',async(req,res)=>{
    const input=z.object({message_id:z.uuid()}).parse(req.body);
    const changed=await c.transaction(async()=>{
      const target=await c.owned('messages',input.message_id,req);
      const previous=await c.one('SELECT m.* FROM message_reads r JOIN messages m ON m.id=r.message_id WHERE r.user_id=?',req.identity.id);
      if(previous&&(target.created_at<previous.created_at||(target.created_at===previous.created_at&&target.id<=previous.id)))return false;
      await c.run('INSERT INTO message_reads VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET message_id=excluded.message_id',req.identity.id,target.id);
      return true;
    });
    if(changed)await c.changed(req.identity.coupleId!,'read-state');
    res.json({ok:true});
  });
  const selectMessages='SELECT m.*,u.name AS sender_name,media.mime AS media_mime,mp.duration AS media_duration,mp.width AS media_width,mp.height AS media_height,(mp.thumb_filename IS NOT NULL) AS media_thumb,md.decision_id,md.event AS choice_event,cd.title AS choice_title,cd.mode AS choice_mode,mr.reply_to_id AS reply_to,rm.text AS reply_text,ru.name AS reply_sender_name,rmedia.mime AS reply_media_mime,rmd.decision_id AS reply_decision_id FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN media ON media.id=m.media_id LEFT JOIN media_previews mp ON mp.media_id=m.media_id LEFT JOIN message_decisions md ON md.message_id=m.id LEFT JOIN decisions cd ON cd.id=md.decision_id LEFT JOIN message_replies mr ON mr.message_id=m.id LEFT JOIN messages rm ON rm.id=mr.reply_to_id LEFT JOIN users ru ON ru.id=rm.user_id LEFT JOIN media rmedia ON rmedia.id=rm.media_id LEFT JOIN message_decisions rmd ON rmd.message_id=rm.id';
  async function withChoiceImages(rows:Row[]){
    const choices=[...new Set(rows.filter(row=>row.decision_id).map(row=>row.decision_id as string))];
    if(!choices.length)return rows;
    const images=new Map<string,{id:string;media_id:string}[]>();
    for(const option of await c.all(`SELECT id,decision_id,media_id FROM decision_options WHERE decision_id IN (${choices.map(()=>'?').join(',')}) ORDER BY position`,...choices)){
      const group=images.get(option.decision_id)||[];group.push({id:option.id,media_id:option.media_id});images.set(option.decision_id,group);
    }
    return rows.map(row=>row.decision_id?{...row,choice_images:images.get(row.decision_id)||[]}:row);
  }
  const message=async(resource:string)=>{
    const row=await c.one(`${selectMessages} WHERE m.id=?`,resource);
    return row?(await withChoiceImages([row]))[0]:undefined;
  };
  router.get('/',async(req,res)=>{
    if(typeof req.query.after==='string'){
      // Clients poll only for newer messages; the overlap window catches messages whose transaction committed out of timestamp order.
      const after=await c.owned('messages',req.query.after,req);const since=new Date(Date.parse(after.created_at)-10000).toISOString();
      const rows=await c.all(`${selectMessages} WHERE m.couple_id=? AND m.created_at>=? ORDER BY m.created_at,m.id LIMIT 100`,req.identity.coupleId,since);
      res.json(await withChoiceImages(rows));return;
    }
    const before=typeof req.query.before==='string'?await c.owned('messages',req.query.before,req):null;
    const rows=await c.all(`${selectMessages} WHERE m.couple_id=? ${before?'AND (m.created_at<? OR (m.created_at=? AND m.id<?))':''} ORDER BY m.created_at DESC,m.id DESC LIMIT 100`,...([req.identity.coupleId,...(before?[before.created_at,before.created_at,before.id]:[])]));
    res.json(await withChoiceImages(rows.reverse()));
  });
  router.post('/',rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Sending too quickly. Try again shortly.'}}),async(req,res)=>{
    const input=z.object({text:z.string().trim().max(4000).default(''),media_id:z.uuid().optional(),reply_to:z.uuid().optional(),client_id:z.string().min(1).max(100)}).refine(v=>!!v.text||!!v.media_id,'Write a message or attach media.').parse(req.body);
    if(input.media_id)await c.owned('media',input.media_id,req);
    if(input.reply_to)await c.owned('messages',input.reply_to,req);
    const result=await c.transaction(async()=>{
      const existing=await c.one('SELECT id FROM messages WHERE user_id=? AND client_id=?',req.identity.id,input.client_id);
      if(existing)return {resource:existing.id as string,created:false};
      const resource=id();await c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.text,input.media_id||null,input.client_id,now());
      if(input.reply_to)await c.run('INSERT INTO message_replies VALUES(?,?)',resource,input.reply_to);
      return {resource,created:true};
    });
    await notify?.(req.identity.coupleId!,req.identity.id,'message',result.resource);
    if(result.created)await c.changed(req.identity.coupleId,'messages');
    res.status(result.created?201:200).json(await message(result.resource));
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
    let readingWrite=Promise.resolve();
    socket.on('chat:view',(active:unknown)=>{readingWrite=readingWrite.then(async()=>{try{await c.identity(socket.handshake.auth.token);if(!socket.connected)return;socket.data.chatReading=active===true;socket.data.chatViewedAt=Date.now();await c.run('INSERT INTO chat_reading VALUES(?,?) ON CONFLICT(session_hash) DO UPDATE SET expires_at=excluded.expires_at',socket.data.tokenHash,active===true?Date.now()+45000:0);}catch{socket.disconnect(true);}});});
    socket.on('typing',async(active:unknown)=>{
      try{await c.identity(socket.handshake.auth.token);}catch{socket.disconnect(true);return;}
      if(typeof active!=='boolean'||Date.now()-lastTyping<500)return;lastTyping=Date.now();
      socket.to(room).emit('typing',{user_id:user.id,name:user.name,active});
    });
    const expiry=setTimeout(()=>socket.disconnect(true),Math.max(0,user.expiresAt-Date.now()));expiry.unref();
    socket.on('disconnect',()=>{clearTimeout(expiry);readingWrite=readingWrite.then(async()=>{try{await c.run('DELETE FROM chat_reading WHERE session_hash=?',socket.data.tokenHash);}catch{}});socket.to(room).emit('typing',{user_id:user.id,name:user.name,active:false});presence(user.coupleId);});
  });
}
