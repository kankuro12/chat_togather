import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { mkdirSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Context, HttpError, id, now } from './context.js';
const supported=new Set(['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/wav']);
export function mediaRoutes(c:Context){
  mkdirSync(c.uploadDir,{recursive:true});
  const router=Router();router.use(c.authenticated,c.paired);
  const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:15*1024*1024,files:1,fields:0}});
  router.get('/',(req,res)=>res.json(c.all('SELECT id,mime,size,user_id,created_at FROM media WHERE couple_id=? AND NOT EXISTS(SELECT 1 FROM choice_media cm WHERE cm.media_id=media.id) AND NOT EXISTS(SELECT 1 FROM decision_options o WHERE o.media_id=media.id) ORDER BY created_at DESC LIMIT 200',req.identity.coupleId)));
  router.post('/',upload.single('file'),async(req,res)=>{
    if(req.query.purpose!==undefined&&req.query.purpose!=='choice')throw new HttpError(400,'Choose a valid upload destination.');
    const file=req.file;if(!file)throw new HttpError(400,'Choose a photo, audio or video.');
    const type=await fileTypeFromBuffer(file.buffer).catch(()=>undefined);
    const mime=file.mimetype.split(';')[0];const compatible=type&&(type.mime===mime||(type.mime==='video/webm'&&mime==='audio/webm')||(['video/mp4','audio/x-m4a'].includes(type.mime)&&mime==='audio/mp4')||(type.mime==='audio/opus'&&mime==='audio/ogg')||(type.mime==='audio/x-wav'&&mime==='audio/wav'));
    if(!type||!supported.has(mime)||!compatible)throw new HttpError(400,'Choose a supported photo, audio or video file.');
    if(req.query.purpose==='choice'&&!mime.startsWith('image/'))throw new HttpError(400,'Choose photos for this choice.');
    const resource=id();const filename=`${resource}.${type.ext}`;const path=resolve(c.uploadDir,filename);
    await writeFile(path,file.buffer,{flag:'wx'});
    try{c.transaction(()=>{c.run('INSERT INTO media VALUES(?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,filename,mime,file.size,now());if(req.query.purpose==='choice')c.run('INSERT INTO choice_media VALUES(?)',resource);});}catch(e){await unlink(path);throw e;}
    c.changed(req.identity.coupleId,'media');res.status(201).json(c.one('SELECT id,mime,size,user_id,created_at FROM media WHERE id=?',resource));
  });
  router.get('/:id',(req,res)=>{
    const item=c.owned('media',String(req.params.id),req);
    res.set({'Cache-Control':'private, no-store','Content-Type':item.mime,'Content-Disposition':'inline'});
    res.sendFile(resolve(c.uploadDir,item.filename));
  });return router;
}
