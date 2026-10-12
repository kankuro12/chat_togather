import { Router } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now } from './context.js';
const schema=z.object({title:z.string().trim().min(1).max(160),notes:z.string().max(4000).default(''),location:z.string().max(200).default(''),start_at:z.iso.datetime().transform(v=>new Date(v).toISOString()),end_at:z.iso.datetime().transform(v=>new Date(v).toISOString()),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone.'),status:z.enum(['planned','done']).default('planned'),decision_id:z.uuid().nullable().optional()});
export function plansRoutes(c:Context){
  const router=Router();router.use(c.authenticated,c.paired);
  const detail=async(row:any)=>({...row,responses:await c.all('SELECT r.*,u.name FROM plan_responses r JOIN users u ON u.id=r.user_id WHERE plan_id=?',row.id)});
  async function validate(input:any,req:any){const parsed=schema.parse(input);if(parsed.end_at<=parsed.start_at)throw new HttpError(400,'End must be after start.');if(parsed.decision_id)await c.owned('decisions',parsed.decision_id,req);return parsed;}
  router.get('/',async(req,res)=>res.json(await Promise.all((await c.all('SELECT * FROM plans WHERE couple_id=? ORDER BY start_at LIMIT 500',req.identity.coupleId)).map(detail))));
  router.get('/:id',async(req,res)=>res.json(await detail(await c.owned('plans',String(req.params.id),req))));
  router.post('/',async(req,res)=>{
    const input=await validate(req.body,req);const resource=id();await c.run('INSERT INTO plans VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.title,input.notes,input.location,input.start_at,input.end_at,input.timezone,input.status,input.decision_id||null,now());
    await c.changed(req.identity.coupleId,'plans');res.status(201).json(await detail(await c.owned('plans',resource,req)));
  });
  router.patch('/:id',async(req,res)=>{
    const existing=await c.owned('plans',String(req.params.id),req);const input=await validate({...existing,...req.body},req);
    await c.transaction(async()=>{
      await c.run('UPDATE plans SET title=?,notes=?,location=?,start_at=?,end_at=?,timezone=?,status=?,decision_id=? WHERE id=?',input.title,input.notes,input.location,input.start_at,input.end_at,input.timezone,input.status,input.decision_id||null,existing.id);
      if(input.start_at!==existing.start_at||input.end_at!==existing.end_at||input.timezone!==existing.timezone)await c.run('DELETE FROM plan_responses WHERE plan_id=?',existing.id);
    });await c.changed(req.identity.coupleId,'plans');res.json(await detail(await c.owned('plans',existing.id,req)));
  });
  router.post('/:id/respond',async(req,res)=>{const plan=await c.owned('plans',String(req.params.id),req);const input=z.object({response:z.enum(['yes','no'])}).parse(req.body);await c.run('INSERT INTO plan_responses VALUES(?,?,?) ON CONFLICT(plan_id,user_id) DO UPDATE SET response=excluded.response',plan.id,req.identity.id,input.response);await c.changed(req.identity.coupleId,'plans');res.json(await detail(plan));});
  router.delete('/:id',async(req,res)=>{const plan=await c.owned('plans',String(req.params.id),req);await c.run('DELETE FROM plans WHERE id=?',plan.id);await c.changed(req.identity.coupleId,'plans');res.json({ok:true});});return router;
}
