import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Context, HttpError, id, now } from './context.js';
const supported=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav']);
const thumbTypes=new Set(['image/webp','image/jpeg','image/png']);
// Previews are made in the sender's browser so viewers can render a message without downloading the full file.
const columns='media.id,media.mime,media.size,media.user_id,media.created_at,mp.duration,mp.width,mp.height,(mp.thumb_filename IS NOT NULL) AS thumb';
const number=(value:unknown,max:number)=>{if(value===undefined||value==='')return null;const n=Number(value);if(!Number.isFinite(n)||n<=0||n>max)throw new HttpError(400,'Invalid media details.');return n;};
export function mediaRoutes(c:Context){
  mkdirSync(c.uploadDir,{recursive:true});
  const router=Router();router.use(c.authenticated,c.paired);
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:2,fields:4}});
  /** View-once photos are only handed to the recipient through the chat's one-time open. */
  const viewOnceGuard=async(media:string,viewer:string)=>{const owner=await c.one('SELECT m.user_id FROM messages m JOIN message_view_once v ON v.message_id=m.id WHERE m.media_id=?',media);if(owner&&owner.user_id!==viewer)throw new HttpError(403,'This photo can only be opened once from the chat.');};
  router.get('/',async(req,res)=>res.json(await c.all(`SELECT ${columns} FROM media LEFT JOIN media_previews mp ON mp.media_id=media.id WHERE media.couple_id=? AND NOT EXISTS(SELECT 1 FROM choice_media cm WHERE cm.media_id=media.id) AND NOT EXISTS(SELECT 1 FROM decision_options o WHERE o.media_id=media.id) AND NOT EXISTS(SELECT 1 FROM messages vm JOIN message_view_once vo ON vo.message_id=vm.id WHERE vm.media_id=media.id) ORDER BY media.created_at DESC LIMIT 200`,req.identity.coupleId)));
  router.post('/',upload.fields([{name:'file',maxCount:1},{name:'thumb',maxCount:1}]),async(req,res)=>{
    if(req.query.purpose!==undefined&&req.query.purpose!=='choice')throw new HttpError(400,'Choose a valid upload destination.');
    const files=req.files as Record<string,Express.Multer.File[]>|undefined;
    const file=files?.file?.[0];if(!file)throw new HttpError(400,'Choose a photo, audio or video.');
    const type=await fileTypeFromBuffer(file.buffer).catch(()=>undefined);
    const mime=file.mimetype.split(';')[0];const compatible=type&&(type.mime===mime||(type.mime==='video/webm'&&mime==='audio/webm')||(['video/mp4','audio/x-m4a'].includes(type.mime)&&mime==='audio/mp4')||(type.mime==='audio/opus'&&mime==='audio/ogg')||(type.mime==='audio/x-wav'&&mime==='audio/wav'));
    if(!type||!supported.has(mime)||!compatible)throw new HttpError(400,'Choose a supported photo, audio or video file.');
    if(req.query.purpose==='choice'&&!mime.startsWith('image/'))throw new HttpError(400,'Choose photos for this choice.');
    const thumb=files?.thumb?.[0];const thumbType=thumb&&await fileTypeFromBuffer(thumb.buffer).catch(()=>undefined);
    if(thumb&&(mime.startsWith('audio/')||thumb.size>256*1024||!thumbType||!thumbTypes.has(thumbType.mime)))throw new HttpError(400,'Choose a valid preview image.');
    const duration=mime.startsWith('image/')?null:number(req.body?.duration,24*60*60);const width=number(req.body?.width,20000);const height=number(req.body?.height,20000);
    const waveform=mime.startsWith('audio/')&&typeof req.body?.waveform==='string'?req.body.waveform.split(',').map(Number):null;
    if(waveform&&(waveform.length<8||waveform.length>64||waveform.some((n:number)=>!Number.isInteger(n)||n<0||n>100)))throw new HttpError(400,'Invalid media details.');
    const resource=id();const filename=`${resource}.${type.ext}`;const path=resolve(c.uploadDir,filename);
    const thumbFilename=thumb&&thumbType?`${resource}.thumb.${thumbType.ext}`:null;const written=[path];
    try{
      await writeFile(path,file.buffer,{flag:'wx'});
      if(thumbFilename){written.push(resolve(c.uploadDir,thumbFilename));await writeFile(written[1],thumb!.buffer,{flag:'wx'});}
      await c.transaction(async()=>{
        await c.run('INSERT INTO media VALUES(?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,filename,mime,file.size,now());
        if(thumbFilename||duration||width||height)await c.run('INSERT INTO media_previews VALUES(?,?,?,?,?,?)',resource,thumbFilename,thumbFilename?thumbType!.mime:null,duration,width&&Math.round(width),height&&Math.round(height));
        if(waveform)await c.run('INSERT INTO media_waveforms VALUES(?,?)',resource,waveform.join(','));
        if(req.query.purpose==='choice')await c.run('INSERT INTO choice_media VALUES(?)',resource);
      });
    }catch(e){await Promise.all(written.map(item=>unlink(item).catch(()=>{})));throw e;}
    await c.changed(req.identity.coupleId,'media');res.status(201).json(await c.one(`SELECT ${columns} FROM media LEFT JOIN media_previews mp ON mp.media_id=media.id WHERE media.id=?`,resource));
  });
  router.get('/:id/thumb',async(req,res)=>{
    const item=await c.owned('media',String(req.params.id),req);await viewOnceGuard(item.id,req.identity.id);
    const preview=await c.one('SELECT thumb_filename,thumb_mime FROM media_previews WHERE media_id=? AND thumb_filename IS NOT NULL',item.id);
    if(!preview)throw new HttpError(404,'No preview for this media.');
    // A thumbnail never changes for its id, so the device may keep it; shared caches and proxies still may not.
    res.set({'Cache-Control':'private, max-age=31536000, immutable','Content-Type':preview.thumb_mime,'Content-Disposition':'inline'});
    res.sendFile(resolve(c.uploadDir,preview.thumb_filename));
  });
  router.get('/:id',async(req,res)=>{
    const item=await c.owned('media',String(req.params.id),req);await viewOnceGuard(item.id,req.identity.id);
    res.set({'Cache-Control':'private, no-store','Content-Type':item.mime,'Content-Disposition':'inline'});
    res.sendFile(resolve(c.uploadDir,item.filename));
  });return router;
}
