import { Router } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now } from './context.js';
export function decisionsRoutes(c:Context,notify?:(couple:string,user:string,kind:string,message?:string)=>void){
  const router=Router();router.use(c.authenticated,c.paired);
  const detail=(row:any)=>({...row,creator_name:row.creator_name||c.one('SELECT name FROM users WHERE id=?',row.user_id)?.name,options:c.all('SELECT * FROM decision_options WHERE decision_id=? ORDER BY position',row.id),votes:c.all('SELECT v.*,u.name AS voter_name FROM decision_votes v JOIN users u ON u.id=v.user_id WHERE decision_id=?',row.id)});
  router.get('/',(req,res)=>res.json(c.all('SELECT d.*,u.name AS creator_name FROM decisions d JOIN users u ON u.id=d.user_id WHERE couple_id=? ORDER BY created_at DESC LIMIT 100',req.identity.coupleId).map(detail)));
  router.get('/:id',(req,res)=>res.json(detail(c.owned('decisions',String(req.params.id),req))));
  router.post('/',(req,res)=>{
    const input=z.object({title:z.string().trim().min(1).max(160),mode:z.enum(['choose','rate']),client_id:z.string().min(1).max(100).optional(),options:z.array(z.object({label:z.string().trim().max(80).optional(),media_id:z.uuid()})).min(2).max(6)}).parse(req.body);
    const previous=input.client_id?c.one('SELECT decision_id FROM decision_requests WHERE user_id=? AND client_id=?',req.identity.id,input.client_id):null;
    if(previous){res.json(detail(c.owned('decisions',previous.decision_id,req)));return;}
    for(const option of input.options){const media=c.owned('media',option.media_id,req);if(!media.mime.startsWith('image/'))throw new HttpError(400,'Decision options must be images.');}
    const resource=id();c.transaction(()=>{c.run('INSERT INTO decisions VALUES(?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.title,input.mode,now());input.options.forEach((o,i)=>{c.run('INSERT INTO decision_options VALUES(?,?,?,?,?)',id(),resource,o.label||`Image ${i+1}`,o.media_id,i);c.run('INSERT OR IGNORE INTO choice_media VALUES(?)',o.media_id);});if(input.client_id)c.run('INSERT INTO decision_requests VALUES(?,?,?)',req.identity.id,input.client_id,resource);const message=id();c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',message,req.identity.coupleId,req.identity.id,'New choice: '+input.title,input.options[0].media_id,'choice:'+resource,now());c.run('INSERT INTO message_decisions VALUES(?,?,?)',message,resource,'shared');notify?.(req.identity.coupleId!,req.identity.id,'message',message);});
    c.changed(req.identity.coupleId,'decisions');c.changed(req.identity.coupleId,'messages');c.changed(req.identity.coupleId,'media');res.status(201).json(detail(c.owned('decisions',resource,req)));
  });
  router.post('/:id/vote',(req,res)=>{
    const decision=c.owned('decisions',String(req.params.id),req);
    const input=z.object({option_id:z.string(),rating:z.number().int().min(1).max(5).optional()}).parse(req.body);
    const option=c.one('SELECT * FROM decision_options WHERE id=? AND decision_id=?',input.option_id,decision.id);
    if(!option)throw new HttpError(400,'Choose an image from this choice.');
    if(decision.mode==='rate'&&input.rating===undefined)throw new HttpError(400,'Choose a rating from 1 to 5.');
    let changed=false;c.transaction(()=>{
      const previous=c.one('SELECT * FROM decision_votes WHERE decision_id=? AND user_id=?'+(decision.mode==='rate'?' AND option_id=?':''),decision.id,req.identity.id,...(decision.mode==='rate'?[input.option_id]:[]));
      changed=!previous||previous.option_id!==input.option_id||(decision.mode==='rate'&&previous.rating!==input.rating);
      if(decision.mode==='choose')c.run('DELETE FROM decision_votes WHERE decision_id=? AND user_id=?',decision.id,req.identity.id);
      c.run('INSERT INTO decision_votes VALUES(?,?,?,?) ON CONFLICT(decision_id,option_id,user_id) DO UPDATE SET rating=excluded.rating',decision.id,input.option_id,req.identity.id,decision.mode==='rate'?input.rating!:null);
      if(changed){const message=id();c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',message,req.identity.coupleId,req.identity.id,`${decision.mode==='rate'?'Rated':'Chose'} image ${option.position+1}${decision.mode==='rate'?' '+input.rating+'/5':''}: ${decision.title}`,option.media_id,'choice-vote:'+message,now());c.run('INSERT INTO message_decisions VALUES(?,?,?)',message,decision.id,'chosen');notify?.(req.identity.coupleId!,req.identity.id,'message',message);}
    });c.changed(req.identity.coupleId,'decisions');if(changed){c.changed(req.identity.coupleId,'messages');}res.json(detail(decision));
  });return router;
}
