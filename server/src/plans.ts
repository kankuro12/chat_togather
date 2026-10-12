import { Router } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now } from './context.js';
const schema=z.object({title:z.string().trim().min(1).max(160),notes:z.string().max(4000).default(''),location:z.string().max(200).default(''),start_at:z.iso.datetime().transform(v=>new Date(v).toISOString()),end_at:z.iso.datetime().transform(v=>new Date(v).toISOString()),timezone:z.string().refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Invalid timezone.'),status:z.enum(['planned','done']).default('planned'),decision_id:z.uuid().nullable().optional()});
export function plansRoutes(c:Context){
  const router=Router();router.use(c.authenticated,c.paired);
  const detail=(row:any)=>({...row,responses:c.all('SELECT r.*,u.name FROM plan_responses r JOIN users u ON u.id=r.user_id WHERE plan_id=?',row.id)});
  function validate(input:any,req:any){const parsed=schema.parse(input);if(parsed.end_at<=parsed.start_at)throw new HttpError(400,'End must be after start.');if(parsed.decision_id)c.owned('decisions',parsed.decision_id,req);return parsed;}
  router.get('/',(req,res)=>res.json(c.all('SELECT * FROM plans WHERE couple_id=? ORDER BY start_at LIMIT 500',req.identity.coupleId).map(detail)));
  router.get('/:id',(req,res)=>res.json(detail(c.owned('plans',String(req.params.id),req))));
  router.post('/',(req,res)=>{
    const input=validate(req.body,req);const resource=id();c.run('INSERT INTO plans VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.title,input.notes,input.location,input.start_at,input.end_at,input.timezone,input.status,input.decision_id||null,now());
    c.changed(req.identity.coupleId,'plans');res.status(201).json(detail(c.owned('plans',resource,req)));
  });
  router.patch('/:id',(req,res)=>{
    const existing=c.owned('plans',String(req.params.id),req);const input=validate({...existing,...req.body},req);
    c.transaction(()=>{
      c.run('UPDATE plans SET title=?,notes=?,location=?,start_at=?,end_at=?,timezone=?,status=?,decision_id=? WHERE id=?',input.title,input.notes,input.location,input.start_at,input.end_at,input.timezone,input.status,input.decision_id||null,existing.id);
      if(input.start_at!==existing.start_at||input.end_at!==existing.end_at||input.timezone!==existing.timezone)c.run('DELETE FROM plan_responses WHERE plan_id=?',existing.id);
    });c.changed(req.identity.coupleId,'plans');res.json(detail(c.owned('plans',existing.id,req)));
  });
  router.post('/:id/respond',(req,res)=>{const plan=c.owned('plans',String(req.params.id),req);const input=z.object({response:z.enum(['yes','no'])}).parse(req.body);c.run('INSERT INTO plan_responses VALUES(?,?,?) ON CONFLICT(plan_id,user_id) DO UPDATE SET response=excluded.response',plan.id,req.identity.id,input.response);c.changed(req.identity.coupleId,'plans');res.json(detail(plan));});
  router.delete('/:id',(req,res)=>{const plan=c.owned('plans',String(req.params.id),req);c.run('DELETE FROM plans WHERE id=?',plan.id);c.changed(req.identity.coupleId,'plans');res.json({ok:true});});return router;
}
