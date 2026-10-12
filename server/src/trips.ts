import { Router } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now } from './context.js';
const date=z.iso.date();
const schema=z.object({title:z.string().trim().min(1).max(160),destination:z.string().trim().min(1).max(200),start_date:date,end_date:date,notes:z.string().max(4000).default('')});
const itemSchema=z.object({title:z.string().trim().min(1).max(160),date,time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),notes:z.string().max(2000).default('')});
export function tripsRoutes(c:Context){
  const router=Router();router.use(c.authenticated,c.paired);
  const detail=async(row:any)=>{const [itinerary,checklist]=await Promise.all([c.all('SELECT * FROM itinerary_items WHERE trip_id=? ORDER BY date,time',row.id),c.all('SELECT * FROM checklist_items WHERE trip_id=? ORDER BY position',row.id)]);return {...row,itinerary,checklist:checklist.map(i=>({...i,done:!!i.done}))};};
  function valid(input:any){const value=schema.parse(input);if(value.end_date<value.start_date)throw new HttpError(400,'Trip end cannot precede start.');return value;}
  function validItem(input:any,trip:any){const item=itemSchema.parse(input);if(item.date<trip.start_date||item.date>trip.end_date)throw new HttpError(400,'Activity must fall within trip dates.');return item;}
  router.get('/',async(req,res)=>res.json(await Promise.all((await c.all('SELECT * FROM trips WHERE couple_id=? ORDER BY start_date LIMIT 200',req.identity.coupleId)).map(detail))));
  router.get('/:id',async(req,res)=>res.json(await detail(await c.owned('trips',String(req.params.id),req))));
  router.post('/',async(req,res)=>{const input=valid(req.body),resource=id();await c.run('INSERT INTO trips VALUES(?,?,?,?,?,?,?,?,?)',resource,req.identity.coupleId,req.identity.id,input.title,input.destination,input.start_date,input.end_date,input.notes,now());await c.changed(req.identity.coupleId,'trips');res.status(201).json(await detail(await c.owned('trips',resource,req)));});
  router.patch('/:id',async(req,res)=>{
    const trip=await c.owned('trips',String(req.params.id),req),input=valid({...trip,...req.body});
    if(await c.one('SELECT id FROM itinerary_items WHERE trip_id=? AND (date<? OR date>?)',trip.id,input.start_date,input.end_date))throw new HttpError(400,'Move or remove activities outside the new trip dates first.');
    await c.run('UPDATE trips SET title=?,destination=?,start_date=?,end_date=?,notes=? WHERE id=?',input.title,input.destination,input.start_date,input.end_date,input.notes,trip.id);await c.changed(req.identity.coupleId,'trips');res.json(await detail(await c.owned('trips',trip.id,req)));
  });
  router.delete('/:id',async(req,res)=>{const trip=await c.owned('trips',String(req.params.id),req);await c.run('DELETE FROM trips WHERE id=?',trip.id);await c.changed(req.identity.coupleId,'trips');res.json({ok:true});});
  router.post('/:id/itinerary',async(req,res)=>{const trip=await c.owned('trips',String(req.params.id),req),input=validItem(req.body,trip),resource=id();await c.run('INSERT INTO itinerary_items VALUES(?,?,?,?,?,?)',resource,trip.id,input.title,input.date,input.time,input.notes);await c.changed(req.identity.coupleId,'trips');res.status(201).json(await c.one('SELECT * FROM itinerary_items WHERE id=?',resource));});
  router.patch('/:id/itinerary/:itemId',async(req,res)=>{const trip=await c.owned('trips',String(req.params.id),req),item=await c.one('SELECT * FROM itinerary_items WHERE id=? AND trip_id=?',String(req.params.itemId),trip.id);if(!item)throw new HttpError(404,'Activity not found.');const input=validItem({...item,...req.body},trip);await c.run('UPDATE itinerary_items SET title=?,date=?,time=?,notes=? WHERE id=?',input.title,input.date,input.time,input.notes,item.id);await c.changed(req.identity.coupleId,'trips');res.json(await c.one('SELECT * FROM itinerary_items WHERE id=?',item.id));});
  router.post('/:id/checklist',async(req,res)=>{const trip=await c.owned('trips',String(req.params.id),req),input=z.object({title:z.string().trim().min(1).max(160)}).parse(req.body),resource=id();await c.run('INSERT INTO checklist_items(id,trip_id,title) VALUES(?,?,?)',resource,trip.id,input.title);await c.changed(req.identity.coupleId,'trips');res.status(201).json({id:resource,trip_id:trip.id,title:input.title,done:false});});
  router.patch('/:id/checklist/:itemId',async(req,res)=>{const trip=await c.owned('trips',String(req.params.id),req),item=await c.one('SELECT * FROM checklist_items WHERE id=? AND trip_id=?',String(req.params.itemId),trip.id);if(!item)throw new HttpError(404,'Checklist item not found.');const input=z.object({done:z.boolean()}).parse(req.body);await c.run('UPDATE checklist_items SET done=? WHERE id=?',Number(input.done),item.id);await c.changed(req.identity.coupleId,'trips');res.json({...item,done:input.done});});
  for(const [route,table] of [['itinerary','itinerary_items'],['checklist','checklist_items']])router.delete(`/:id/${route}/:itemId`,async(req,res)=>{const trip=await c.owned('trips',String(req.params.id),req),item=await c.one(`SELECT id FROM ${table} WHERE id=? AND trip_id=?`,String(req.params.itemId),trip.id);if(!item)throw new HttpError(404,'Item not found.');await c.run(`DELETE FROM ${table} WHERE id=?`,item.id);await c.changed(req.identity.coupleId,'trips');res.json({ok:true});});
  return router;
}
