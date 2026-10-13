import { Router, type Request } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { createHash } from 'node:crypto';
import { Context, HttpError, id, now, type Row } from './context.js';
import { QUESTIONS } from './questions.js';

type Notify=(couple:string,user:string,kind:string,message?:string)=>Promise<void>;
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>!Number.isNaN(Date.parse(value+'T00:00:00Z')),'Invalid date.');
const timezone=z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}},'Invalid timezone.');

/** Epoch milliseconds for a wall-clock time on a calendar day in a time zone. */
export function zonedTime(date:string,hour:number,zone:string){
  const [y,m,d]=date.split('-').map(Number);let guess=Date.UTC(y,m-1,d,hour);
  for(let i=0;i<2;i++){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:zone,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).formatToParts(new Date(guess)).map(part=>[part.type,part.value]));
    const shown=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute));
    guess+=Date.UTC(y,m-1,d,hour)-shown;
  }
  return guess;
}
/** Next time this date comes round (today counts), as YYYY-MM-DD. Feb 29 falls on Feb 28 in other years. */
export function nextOccurrence(date:string,today:string,yearly:boolean){
  if(!yearly)return date>=today?date:null;
  const [, m,d]=date.split('-').map(Number);const year=Number(today.slice(0,4));
  for(const y of [year,year+1]){const leap=(y%4===0&&y%100!==0)||y%400===0;const dd=m===2&&d===29&&!leap?28:d;const candidate=`${y}-${String(m).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;if(candidate>=today)return candidate;}
  return null;
}
const todayIn=(zone:string)=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function questionFor(couple:string,date:string){
  const offset=createHash('sha256').update(couple).digest().readUInt32BE(0);
  return QUESTIONS[(offset+Math.floor(Date.parse(date+'T00:00:00Z')/86400000))%QUESTIONS.length];
}

export function usRoutes(c:Context,notify?:Notify){
  const router=Router();router.use(c.authenticated,c.paired);
  const queue=c.storage.queue;const couple=(req:Request)=>req.identity.coupleId!;
  const changed=(req:Request)=>c.changed(couple(req),'us');

  // Special dates, with a push on the morning of each one.
  const dateInput=z.object({title:z.string().trim().min(1).max(80),date:day,kind:z.enum(['together','anniversary','birthday','other']),yearly:z.boolean().default(true),timezone});
  async function schedule(row:Row){
    const occurrence=nextOccurrence(row.date,todayIn(row.timezone),!!Number(row.yearly));if(!occurrence)return;
    const runAt=zonedTime(occurrence,9,row.timezone);if(runAt<Date.now())return;
    await queue.enqueue('date-reminder',{couple:row.couple_id,date_id:row.id,occurrence,version:row.updated_at},`date:${row.id}:${occurrence}:${row.updated_at}`,runAt);
  }
  router.get('/dates',async(req,res)=>res.json(await c.all('SELECT d.*,u.name AS creator_name FROM special_dates d JOIN users u ON u.id=d.user_id WHERE d.couple_id=? ORDER BY d.date',couple(req))));
  router.post('/dates',async(req,res)=>{
    const input=dateInput.parse(req.body);if(input.kind==='together'&&await c.one("SELECT 1 AS found FROM special_dates WHERE couple_id=? AND kind='together'",couple(req)))throw new HttpError(409,'You already set when you got together. Edit that date instead.');
    const resource=id(),stamp=now();await c.run('INSERT INTO special_dates VALUES(?,?,?,?,?,?,?,?,?,?)',resource,couple(req),req.identity.id,input.title,input.date,input.kind,input.yearly||input.kind!=='other'?1:0,input.timezone,stamp,stamp);
    const row=(await c.one('SELECT * FROM special_dates WHERE id=?',resource))!;await schedule(row);await changed(req);res.status(201).json(row);
  });
  router.put('/dates/:id',async(req,res)=>{
    const row=await c.owned('special_dates',String(req.params.id),req);const input=dateInput.parse(req.body);
    if(input.kind==='together'&&await c.one("SELECT 1 AS found FROM special_dates WHERE couple_id=? AND kind='together' AND id!=?",couple(req),row.id))throw new HttpError(409,'You already set when you got together.');
    await c.run('UPDATE special_dates SET title=?,date=?,kind=?,yearly=?,timezone=?,updated_at=? WHERE id=?',input.title,input.date,input.kind,input.yearly||input.kind!=='other'?1:0,input.timezone,now(),row.id);
    const updated=(await c.one('SELECT * FROM special_dates WHERE id=?',row.id))!;await schedule(updated);await changed(req);res.json(updated);
  });
  router.delete('/dates/:id',async(req,res)=>{const row=await c.owned('special_dates',String(req.params.id),req);await c.run('DELETE FROM special_dates WHERE id=?',row.id);await changed(req);res.json({ok:true});});

  // Shared lists.
  router.get('/lists',async(req,res)=>{
    const lists=await c.all('SELECT * FROM shared_lists WHERE couple_id=? ORDER BY created_at',couple(req));
    const items=lists.length?await c.all(`SELECT i.*,u.name AS creator_name FROM list_items i JOIN users u ON u.id=i.user_id WHERE i.list_id IN (${lists.map(()=>'?').join(',')}) ORDER BY i.done,i.created_at`,...lists.map(list=>list.id)):[];
    res.json(lists.map(list=>({...list,items:items.filter(item=>item.list_id===list.id).map(item=>({...item,done:!!Number(item.done)}))})));
  });
  router.post('/lists',async(req,res)=>{const {title}=z.object({title:z.string().trim().min(1).max(60)}).parse(req.body);if(Number((await c.one('SELECT count(*) AS n FROM shared_lists WHERE couple_id=?',couple(req)))?.n)>=20)throw new HttpError(400,'You can keep up to 20 lists.');const resource=id();await c.run('INSERT INTO shared_lists VALUES(?,?,?,?)',resource,couple(req),title,now());await changed(req);res.status(201).json({id:resource,title,items:[]});});
  router.delete('/lists/:id',async(req,res)=>{const list=await c.owned('shared_lists',String(req.params.id),req);await c.run('DELETE FROM shared_lists WHERE id=?',list.id);await changed(req);res.json({ok:true});});
  const ownedItem=async(req:Request)=>{const item=await c.one('SELECT i.* FROM list_items i JOIN shared_lists l ON l.id=i.list_id WHERE i.id=? AND l.couple_id=?',String(req.params.id),couple(req));if(!item)throw new HttpError(404,'Item not found.');return item;};
  router.post('/lists/:id/items',async(req,res)=>{const list=await c.owned('shared_lists',String(req.params.id),req);const {title}=z.object({title:z.string().trim().min(1).max(160)}).parse(req.body);if(Number((await c.one('SELECT count(*) AS n FROM list_items WHERE list_id=?',list.id))?.n)>=300)throw new HttpError(400,'This list is full. Clear done items first.');const resource=id();await c.run('INSERT INTO list_items VALUES(?,?,?,?,0,?)',resource,list.id,req.identity.id,title,now());await changed(req);res.status(201).json({id:resource});});
  router.patch('/items/:id',async(req,res)=>{const item=await ownedItem(req);const input=z.object({done:z.boolean().optional(),title:z.string().trim().min(1).max(160).optional()}).parse(req.body);await c.run('UPDATE list_items SET done=?,title=? WHERE id=?',input.done===undefined?item.done:input.done?1:0,input.title??item.title,item.id);await changed(req);res.json({ok:true});});
  router.delete('/items/:id',async(req,res)=>{const item=await ownedItem(req);await c.run('DELETE FROM list_items WHERE id=?',item.id);await changed(req);res.json({ok:true});});
  router.post('/lists/:id/clear-done',async(req,res)=>{const list=await c.owned('shared_lists',String(req.params.id),req);await c.run('DELETE FROM list_items WHERE list_id=? AND done=1',list.id);await changed(req);res.json({ok:true});});

  // Wishlists: the partner can quietly mark "I'll get this"; the wisher never sees it.
  router.get('/wishes',async(req,res)=>{
    const rows=await c.all('SELECT w.*,u.name AS owner_name,wc.user_id AS claimed_by FROM wishes w JOIN users u ON u.id=w.user_id LEFT JOIN wish_claims wc ON wc.wish_id=w.id WHERE w.couple_id=? ORDER BY w.created_at DESC',couple(req));
    res.json(rows.map(({claimed_by,...wish})=>wish.user_id===req.identity.id?wish:{...wish,claimed:!!claimed_by,claimed_by_me:claimed_by===req.identity.id}));
  });
  router.post('/wishes',async(req,res)=>{const input=z.object({title:z.string().trim().min(1).max(160),link:z.url({protocol:/^https?$/}).max(500).or(z.literal('')).default(''),note:z.string().trim().max(500).default('')}).parse(req.body);const resource=id();await c.run('INSERT INTO wishes VALUES(?,?,?,?,?,?,?)',resource,couple(req),req.identity.id,input.title,input.link,input.note,now());await changed(req);res.status(201).json({id:resource});});
  router.delete('/wishes/:id',async(req,res)=>{const wish=await c.owned('wishes',String(req.params.id),req);if(wish.user_id!==req.identity.id)throw new HttpError(403,'Only the person who added a wish can remove it.');await c.run('DELETE FROM wishes WHERE id=?',wish.id);await changed(req);res.json({ok:true});});
  router.put('/wishes/:id/claim',async(req,res)=>{
    const wish=await c.owned('wishes',String(req.params.id),req);if(wish.user_id===req.identity.id)throw new HttpError(400,'You cannot claim your own wish.');const {claimed}=z.object({claimed:z.boolean()}).parse(req.body);
    if(claimed)await c.run('INSERT INTO wish_claims VALUES(?,?,?) ON CONFLICT(wish_id) DO UPDATE SET user_id=excluded.user_id,claimed_at=excluded.claimed_at',wish.id,req.identity.id,now());else await c.run('DELETE FROM wish_claims WHERE wish_id=?',wish.id);
    // Only the claimer's screens refresh, so the wisher's app never hints at a surprise.
    for(const socket of c.io.sockets.sockets.values())if(socket.data.user?.id===req.identity.id)socket.emit('changed',{area:'us'});
    res.json({ok:true});
  });

  // Daily question: answers are revealed once both of you have answered.
  const dayParam=(req:Request)=>{const value=day.parse(typeof req.query.day==='string'?req.query.day:new Date().toISOString().slice(0,10));if(Math.abs(Date.parse(value+'T00:00:00Z')-Date.parse(new Date().toISOString().slice(0,10)+'T00:00:00Z'))>86400000*1.5)throw new HttpError(400,'Use today’s date.');return value;};
  async function question(req:Request,date:string){
    const answers=await c.all('SELECT a.user_id,a.answer,a.created_at,u.name FROM daily_answers a JOIN users u ON u.id=a.user_id WHERE a.couple_id=? AND a.day=?',couple(req),date);
    const mine=answers.find(answer=>answer.user_id===req.identity.id),theirs=answers.find(answer=>answer.user_id!==req.identity.id);
    return {day:date,question:questionFor(couple(req),date),mine:mine?.answer||null,partner_answered:!!theirs,partner:mine&&theirs?theirs.answer:null};
  }
  router.get('/question',async(req,res)=>res.json(await question(req,dayParam(req))));
  router.post('/question',async(req,res)=>{
    const date=dayParam(req);const {answer}=z.object({answer:z.string().trim().min(1).max(1000)}).parse(req.body);
    const first=!await c.one('SELECT 1 AS found FROM daily_answers WHERE couple_id=? AND day=? AND user_id=?',couple(req),date,req.identity.id);
    await c.run('INSERT INTO daily_answers VALUES(?,?,?,?,?) ON CONFLICT(couple_id,day,user_id) DO UPDATE SET answer=excluded.answer',couple(req),date,req.identity.id,answer,now());
    if(first)await notify?.(couple(req),req.identity.id,'question',`${date}:${req.identity.id}`);
    await changed(req);res.json(await question(req,date));
  });
  router.get('/question/history',async(req,res)=>{
    const days=await c.all('SELECT day FROM daily_answers WHERE couple_id=? GROUP BY day HAVING count(*)>1 ORDER BY day DESC LIMIT 30',couple(req));
    const answers=days.length?await c.all(`SELECT a.day,a.user_id,a.answer,u.name FROM daily_answers a JOIN users u ON u.id=a.user_id WHERE a.couple_id=? AND a.day IN (${days.map(()=>'?').join(',')})`,couple(req),...days.map(row=>row.day)):[];
    res.json(days.map(row=>({day:row.day,question:questionFor(couple(req),row.day),answers:answers.filter(answer=>answer.day===row.day).map(({day,...answer})=>answer)})));
  });

  // Love notes that unlock on a chosen date.
  router.get('/notes',async(req,res)=>{
    const rows=await c.all('SELECT n.*,u.name AS author_name FROM love_notes n JOIN users u ON u.id=n.user_id WHERE n.couple_id=? ORDER BY n.unlock_at DESC',couple(req));
    const time=now();res.json(rows.map(note=>{const locked=note.unlock_at>time;return note.user_id===req.identity.id?{...note,locked}:{...note,locked,text:locked?null:note.text};}));
  });
  router.post('/notes',async(req,res)=>{
    const input=z.object({text:z.string().trim().min(1).max(4000),unlock_at:z.iso.datetime().transform(value=>new Date(value).toISOString())}).parse(req.body);
    if(input.unlock_at<=now())throw new HttpError(400,'Choose a time in the future.');if(Date.parse(input.unlock_at)-Date.now()>10*365*86400000)throw new HttpError(400,'Choose a date within the next 10 years.');
    const resource=id();await c.run('INSERT INTO love_notes VALUES(?,?,?,?,?,?)',resource,couple(req),req.identity.id,input.text,input.unlock_at,now());
    await queue.enqueue('note-unlock',{couple:couple(req),note_id:resource},'note:'+resource,Date.parse(input.unlock_at));
    await changed(req);res.status(201).json({id:resource});
  });
  router.delete('/notes/:id',async(req,res)=>{const note=await c.owned('love_notes',String(req.params.id),req);if(note.user_id!==req.identity.id)throw new HttpError(403,'Only the writer can delete a note.');await c.run('DELETE FROM love_notes WHERE id=?',note.id);await changed(req);res.json({ok:true});});

  // "Thinking of you": a single tap that reaches the partner's phone.
  router.get('/nudges',async(req,res)=>res.json(await c.all('SELECT n.id,n.user_id,n.created_at,u.name FROM nudges n JOIN users u ON u.id=n.user_id WHERE n.couple_id=? ORDER BY n.created_at DESC LIMIT 10',couple(req))));
  router.post('/nudge',rateLimit({windowMs:60000,limit:3,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:req=>'nudge:'+req.identity.id,message:{error:'Your love is on its way. Try again in a minute.'}}),async(req,res)=>{
    const resource=id();await c.run('INSERT INTO nudges VALUES(?,?,?,?)',resource,couple(req),req.identity.id,now());
    c.io.to(`couple:${couple(req)}`).except(`user:${req.identity.id}`).emit('nudge',{name:req.identity.name});
    await notify?.(couple(req),req.identity.id,'nudge',resource);await changed(req);res.status(201).json({ok:true});
  });
  return router;
}
