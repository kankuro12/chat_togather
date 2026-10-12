import { Router } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now } from './context.js';
import {pendingChoiceCondition} from './choice-state.js';
export function decisionsRoutes(c:Context,notify?:(couple:string,user:string,kind:string,message?:string)=>Promise<void>){
  const router=Router();router.use(c.authenticated,c.paired);
  const detail=async(row:any)=>{const [creator,options,votes]=await Promise.all([row.creator_name?Promise.resolve(undefined):c.one('SELECT name FROM users WHERE id=?',row.user_id),c.all('SELECT * FROM decision_options WHERE decision_id=? ORDER BY position',row.id),c.all('SELECT v.*,u.name AS voter_name FROM decision_votes v JOIN users u ON u.id=v.user_id WHERE decision_id=?',row.id)]);return {...row,creator_name:row.creator_name||creator?.name,options,votes};};
  router.get('/',async(req,res)=>res.json(await Promise.all((await c.all('SELECT d.*,u.name AS creator_name FROM decisions d JOIN users u ON u.id=d.user_id WHERE couple_id=? ORDER BY created_at DESC LIMIT 100',req.identity.coupleId)).map(detail))));
  router.get('/pending',async(req,res)=>{
    const row=await c.one(`SELECT count(*) AS count FROM decisions d WHERE d.couple_id=? AND d.user_id!=? AND ${pendingChoiceCondition}`,req.identity.coupleId,req.identity.id,req.identity.id,req.identity.id);
    res.json({count:Number(row?.count||0)});
  });
  router.get('/:id',async(req,res)=>res.json(await detail(await c.owned('decisions',String(req.params.id),req))));
  router.post('/',async(req,res)=>{
    const input=z.object({title:z.string().trim().min(1).max(160),mode:z.enum(['choose','rate']),client_id:z.string().min(1).max(100).optional(),options:z.array(z.object({label:z.string().trim().max(80).optional(),media_id:z.uuid()})).min(2).max(6)}).parse(req.body);
    const result=await c.transaction(async()=>{
      const previous=input.client_id?await c.one('SELECT decision_id FROM decision_requests WHERE user_id=? AND client_id=?',req.identity.id,input.client_id):null;
      if(previous)return {resource:previous.decision_id as string,notification:undefined,created:false};
      for(const option of input.options){const media=await c.owned('media',option.media_id,req);if(!media.mime.startsWith('image/'))throw new HttpError(400,'Decision options must be images.');}
      const resource=id();await c.run('INSERT INTO decisions VALUES(?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.title,input.mode,now());for(const [i,o] of input.options.entries()){await c.run('INSERT INTO decision_options VALUES(?,?,?,?,?)',id(),resource,o.label||`Image ${i+1}`,o.media_id,i);await c.run('INSERT OR IGNORE INTO choice_media VALUES(?)',o.media_id);}if(input.client_id)await c.run('INSERT INTO decision_requests VALUES(?,?,?)',req.identity.id,input.client_id,resource);const message=id();await c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',message,req.identity.coupleId,req.identity.id,'New choice: '+input.title,input.options[0].media_id,'choice:'+resource,now());await c.run('INSERT INTO message_decisions VALUES(?,?,?)',message,resource,'shared');return {resource,notification:message,created:true};
    });
    if(!result.created){res.json(await detail(await c.owned('decisions',result.resource,req)));return;}
    if(result.notification)await notify?.(req.identity.coupleId!,req.identity.id,'choice',result.resource);
    await c.changed(req.identity.coupleId,'decisions');await c.changed(req.identity.coupleId,'messages');await c.changed(req.identity.coupleId,'media');res.status(201).json(await detail(await c.owned('decisions',result.resource,req)));
  });
  router.post('/:id/vote',async(req,res)=>{
    const decision=await c.owned('decisions',String(req.params.id),req);
    const input=z.object({option_id:z.string(),rating:z.number().int().min(1).max(5).optional()}).parse(req.body);
    const option=await c.one('SELECT * FROM decision_options WHERE id=? AND decision_id=?',input.option_id,decision.id);
    if(!option)throw new HttpError(400,'Choose an image from this choice.');
    if(decision.mode==='rate'&&input.rating===undefined)throw new HttpError(400,'Choose a rating from 1 to 5.');
    let changed=false;let notification:string|undefined;await c.transaction(async()=>{
      const previous=await c.one('SELECT * FROM decision_votes WHERE decision_id=? AND user_id=?'+(decision.mode==='rate'?' AND option_id=?':''),decision.id,req.identity.id,...(decision.mode==='rate'?[input.option_id]:[]));
      changed=!previous||previous.option_id!==input.option_id||(decision.mode==='rate'&&previous.rating!==input.rating);
      if(decision.mode==='choose')await c.run('DELETE FROM decision_votes WHERE decision_id=? AND user_id=?',decision.id,req.identity.id);
      await c.run('INSERT INTO decision_votes VALUES(?,?,?,?) ON CONFLICT(decision_id,option_id,user_id) DO UPDATE SET rating=excluded.rating',decision.id,input.option_id,req.identity.id,decision.mode==='rate'?input.rating!:null);
      if(changed){const message=id();await c.run('INSERT INTO messages VALUES(?,?,?,?,?,?,?)',message,req.identity.coupleId,req.identity.id,`${decision.mode==='rate'?'Rated':'Chose'} image ${option.position+1}${decision.mode==='rate'?' '+input.rating+'/5':''}: ${decision.title}`,option.media_id,'choice-vote:'+message,now());await c.run('INSERT INTO message_decisions VALUES(?,?,?)',message,decision.id,'chosen');notification=message;}
    });if(notification)await notify?.(req.identity.coupleId!,req.identity.id,'message',notification);await c.changed(req.identity.coupleId,'decisions');if(changed){await c.changed(req.identity.coupleId,'messages');}res.json(await detail(decision));
  });return router;
}
