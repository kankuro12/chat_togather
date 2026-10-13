import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { resolve } from 'node:path';
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
  const ids=(values:string[])=>values.map(()=>'?').join(',');
  const REACTIONS=['❤️','😂','😮','😢','👍','🙏','🔥','🥰'] as const;
  /** Overlays everything that can change after a message is sent (edits, deletes, reactions, pins, view-once state)
   *  plus choice thumbnails and voice waveforms, so message rows themselves stay append-only. */
  async function decorate(rows:Row[],viewer:string){
    if(!rows.length)return rows;
    const messageIds=[...new Set(rows.flatMap(row=>[row.id,row.reply_to].filter(Boolean) as string[]))];
    const own=rows.map(row=>row.id as string);
    const choices=[...new Set(rows.filter(row=>row.decision_id).map(row=>row.decision_id as string))];
    const audio=[...new Set(rows.filter(row=>row.media_id&&String(row.media_mime||'').startsWith('audio/')).map(row=>row.media_id as string))];
    const images=new Map<string,{id:string;media_id:string}[]>();
    if(choices.length)for(const option of await c.all(`SELECT id,decision_id,media_id FROM decision_options WHERE decision_id IN (${ids(choices)}) ORDER BY position`,...choices)){
      const group=images.get(option.decision_id)||[];group.push({id:option.id,media_id:option.media_id});images.set(option.decision_id,group);
    }
    const changes=new Map((await c.all(`SELECT message_id,text,deleted FROM message_changes WHERE message_id IN (${ids(messageIds)})`,...messageIds)).map(row=>[row.message_id,row]));
    const reactions=new Map<string,{user_id:string;emoji:string}[]>();
    for(const row of await c.all(`SELECT message_id,user_id,emoji FROM message_reactions WHERE message_id IN (${ids(own)}) ORDER BY created_at`,...own)){const list=reactions.get(row.message_id)||[];list.push({user_id:row.user_id,emoji:row.emoji});reactions.set(row.message_id,list);}
    const pins=new Set((await c.all(`SELECT message_id FROM message_pins WHERE message_id IN (${ids(own)})`,...own)).map(row=>row.message_id));
    const once=new Set((await c.all(`SELECT message_id FROM message_view_once WHERE message_id IN (${ids(own)})`,...own)).map(row=>row.message_id));
    const views=new Set((await c.all(`SELECT message_id FROM message_views WHERE message_id IN (${ids(own)})`,...own)).map(row=>row.message_id));
    const waves=new Map(audio.length?(await c.all(`SELECT media_id,peaks FROM media_waveforms WHERE media_id IN (${ids(audio)})`,...audio)).map(row=>[row.media_id,String(row.peaks).split(',').map(Number)]):[]);
    return rows.map(row=>{
      const change=changes.get(row.id),deleted=!!Number(change?.deleted),replyChange=row.reply_to?changes.get(row.reply_to):undefined,viewOnce=once.has(row.id);
      const result:Row={...row,text:deleted?'':change?change.text:row.text,edited:!!change&&!deleted,deleted,reactions:reactions.get(row.id)||[],pinned:pins.has(row.id),view_once:viewOnce,viewed:viewOnce&&views.has(row.id),media_waveform:row.media_id?waves.get(row.media_id)||null:null};
      if(row.decision_id)result.choice_images=images.get(row.decision_id)||[];
      if(deleted)Object.assign(result,{media_id:null,media_mime:null,media_thumb:0,media_duration:null,media_width:null,media_height:null,media_waveform:null,choice_images:undefined,decision_id:null});
      // The recipient never gets a preview of a view-once photo.
      if(viewOnce&&row.user_id!==viewer)result.media_thumb=0;
      if(replyChange)Object.assign(result,Number(replyChange.deleted)?{reply_text:'Deleted message',reply_media_mime:null}:{reply_text:replyChange.text});
      return result;
    });
  }
  const message=async(resource:string,viewer:string)=>{
    const row=await c.one(`${selectMessages} WHERE m.id=?`,resource);
    return row?(await decorate([row],viewer))[0]:undefined;
  };
  const updated=(couple:string,resource:string)=>{c.io.to(`couple:${couple}`).emit('message:updated',{id:resource});};
  const isDeleted=async(resource:string)=>!!Number((await c.one('SELECT deleted FROM message_changes WHERE message_id=?',resource))?.deleted);
  /** Own, not deleted, and an ordinary chat message (choice events are written by the app). */
  async function editable(req:import('express').Request){
    const row=await c.owned('messages',String(req.params.id),req);
    if(row.user_id!==req.identity.id)throw new HttpError(403,'You can only change your own messages.');
    if(await isDeleted(row.id))throw new HttpError(410,'This message was deleted.');
    if(await c.one('SELECT 1 AS found FROM message_decisions WHERE message_id=?',row.id))throw new HttpError(400,'Choice updates cannot be changed.');
    return row;
  }
  router.get('/',async(req,res)=>{
    if(typeof req.query.after==='string'){
      // Clients poll only for newer messages; the overlap window catches messages whose transaction committed out of timestamp order.
      const after=await c.owned('messages',req.query.after,req);const since=new Date(Date.parse(after.created_at)-10000).toISOString();
      const rows=await c.all(`${selectMessages} WHERE m.couple_id=? AND m.created_at>=? ORDER BY m.created_at,m.id LIMIT 100`,req.identity.coupleId,since);
      res.json(await decorate(rows,req.identity.id));return;
    }
    const before=typeof req.query.before==='string'?await c.owned('messages',req.query.before,req):null;
    const rows=await c.all(`${selectMessages} WHERE m.couple_id=? ${before?'AND (m.created_at<? OR (m.created_at=? AND m.id<?))':''} ORDER BY m.created_at DESC,m.id DESC LIMIT 100`,...([req.identity.coupleId,...(before?[before.created_at,before.created_at,before.id]:[])]));
    res.json(await decorate(rows.reverse(),req.identity.id));
  });
  router.get('/search',async(req,res)=>{
    const q=z.string().trim().min(2).max(100).parse(req.query.q);const pattern='%'+q.toLowerCase().replace(/[!%_]/g,ch=>'!'+ch)+'%';
    const rows=await c.all(`${selectMessages} LEFT JOIN message_changes sc ON sc.message_id=m.id WHERE m.couple_id=? AND COALESCE(sc.deleted,0)=0 AND NOT EXISTS(SELECT 1 FROM message_decisions sd WHERE sd.message_id=m.id) AND LOWER(COALESCE(sc.text,m.text)) LIKE ? ESCAPE '!' ORDER BY m.created_at DESC,m.id DESC LIMIT 50`,req.identity.coupleId,pattern);
    res.json(await decorate(rows,req.identity.id));
  });
  router.get('/pins',async(req,res)=>{
    const rows=await c.all(`${selectMessages} JOIN message_pins pin ON pin.message_id=m.id WHERE m.couple_id=? ORDER BY pin.pinned_at DESC LIMIT 20`,req.identity.coupleId);
    res.json(await decorate(rows,req.identity.id));
  });
  router.get('/:id',async(req,res)=>{const row=await c.owned('messages',String(req.params.id),req);res.json(await message(row.id,req.identity.id));});
  router.patch('/:id',async(req,res)=>{
    const row=await editable(req);const {text}=z.object({text:z.string().trim().max(4000)}).parse(req.body);
    if(!text&&!row.media_id)throw new HttpError(400,'Write a message or delete it instead.');
    await c.run('INSERT INTO message_changes VALUES(?,?,0,?) ON CONFLICT(message_id) DO UPDATE SET text=excluded.text,changed_at=excluded.changed_at',row.id,text,now());
    updated(req.identity.coupleId!,row.id);res.json(await message(row.id,req.identity.id));
  });
  router.delete('/:id',async(req,res)=>{
    const row=await editable(req);
    await c.transaction(async()=>{
      await c.run("INSERT INTO message_changes VALUES(?,'',1,?) ON CONFLICT(message_id) DO UPDATE SET text='',deleted=1,changed_at=excluded.changed_at",row.id,now());
      await c.run('DELETE FROM message_pins WHERE message_id=?',row.id);await c.run('DELETE FROM message_reactions WHERE message_id=?',row.id);
    });
    updated(req.identity.coupleId!,row.id);res.json(await message(row.id,req.identity.id));
  });
  router.put('/:id/reaction',async(req,res)=>{
    const row=await c.owned('messages',String(req.params.id),req);const {emoji}=z.object({emoji:z.enum(REACTIONS).nullable()}).parse(req.body);
    if(await isDeleted(row.id))throw new HttpError(410,'This message was deleted.');
    if(emoji)await c.run('INSERT INTO message_reactions VALUES(?,?,?,?) ON CONFLICT(message_id,user_id) DO UPDATE SET emoji=excluded.emoji,created_at=excluded.created_at',row.id,req.identity.id,emoji,now());
    else await c.run('DELETE FROM message_reactions WHERE message_id=? AND user_id=?',row.id,req.identity.id);
    updated(req.identity.coupleId!,row.id);res.json(await message(row.id,req.identity.id));
  });
  router.put('/:id/pin',async(req,res)=>{
    const row=await c.owned('messages',String(req.params.id),req);const {pinned}=z.object({pinned:z.boolean()}).parse(req.body);
    if(await isDeleted(row.id))throw new HttpError(410,'This message was deleted.');
    if(pinned)await c.run('INSERT INTO message_pins VALUES(?,?,?) ON CONFLICT(message_id) DO UPDATE SET pinned_at=excluded.pinned_at,user_id=excluded.user_id',row.id,req.identity.id,now());
    else await c.run('DELETE FROM message_pins WHERE message_id=?',row.id);
    updated(req.identity.coupleId!,row.id);res.json(await message(row.id,req.identity.id));
  });
  /** A view-once photo: the recipient gets the file exactly once; the sender can always see what they sent. */
  router.post('/:id/open',async(req,res)=>{
    const row=await c.owned('messages',String(req.params.id),req);
    if(!row.media_id||!await c.one('SELECT 1 AS found FROM message_view_once WHERE message_id=?',row.id))throw new HttpError(400,'This is not a view-once photo.');
    if(await isDeleted(row.id))throw new HttpError(410,'This message was deleted.');
    if(row.user_id!==req.identity.id){
      const first=await c.transaction(async()=>{if(await c.one('SELECT 1 AS found FROM message_views WHERE message_id=? AND user_id=?',row.id,req.identity.id))return false;await c.run('INSERT INTO message_views VALUES(?,?,?)',row.id,req.identity.id,now());return true;});
      if(!first)throw new HttpError(410,'This photo was already opened.');
      updated(req.identity.coupleId!,row.id);
    }
    const item=await c.one('SELECT filename,mime FROM media WHERE id=?',row.media_id);if(!item)throw new HttpError(404,'Photo unavailable.');
    res.set({'Cache-Control':'private, no-store','Content-Type':item.mime,'Content-Disposition':'inline'});res.sendFile(resolve(c.uploadDir,item.filename));
  });
  router.post('/',rateLimit({windowMs:60000,limit:60,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Sending too quickly. Try again shortly.'}}),async(req,res)=>{
    const input=z.object({text:z.string().trim().max(4000).default(''),media_id:z.uuid().optional(),reply_to:z.uuid().optional(),view_once:z.boolean().optional(),client_id:z.string().min(1).max(100)}).refine(v=>!!v.text||!!v.media_id,'Write a message or attach media.').parse(req.body);
    const attached=input.media_id?await c.owned('media',input.media_id,req):undefined;
    if(input.view_once&&!String(attached?.mime||'').startsWith('image/'))throw new HttpError(400,'Only photos can be sent as view once.');
    if(input.reply_to)await c.owned('messages',input.reply_to,req);
    const result=await c.transaction(async()=>{
      const existing=await c.one('SELECT id FROM messages WHERE user_id=? AND client_id=?',req.identity.id,input.client_id);
      if(existing)return {resource:existing.id as string,created:false};
      const resource=id();await c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.text,input.media_id||null,input.client_id,now());
      if(input.reply_to)await c.run('INSERT INTO message_replies VALUES(?,?)',resource,input.reply_to);
      if(input.view_once)await c.run('INSERT INTO message_view_once VALUES(?)',resource);
      return {resource,created:true};
    });
    await notify?.(req.identity.coupleId!,req.identity.id,'message',result.resource);
    if(result.created)await c.changed(req.identity.coupleId,'messages');
    res.status(result.created?201:200).json(await message(result.resource,req.identity.id));
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
    bind?.(socket);const user=socket.data.user;const room=`couple:${user.coupleId}`;socket.join(room);socket.join(`user:${user.id}`);presence(user.coupleId);
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
