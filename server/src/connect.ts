import { Router, type Request } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now } from './context.js';
import { PACKS, KNOW_QUESTIONS } from './questions.js';

type Notify=(couple:string,user:string,kind:string,message?:string)=>Promise<void>;
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const MOODS=['happy','loved','calm','excited','tired','stressed','sad','missing'] as const;
export const QUIZZES=['love-language','communication'] as const;
const dayNumber=(value:string)=>Math.round(Date.parse(value+'T00:00:00Z')/86400000);
const dayString=(n:number)=>new Date(n*86400000).toISOString().slice(0,10);
/** Great-circle distance in kilometres, rounded so nobody's exact position can be worked out from it. */
function distanceKm(a:{lat:number;lng:number},b:{lat:number;lng:number}){
  const rad=(deg:number)=>deg*Math.PI/180,dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng);
  const h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
  const km=12742*Math.asin(Math.min(1,Math.sqrt(h)));return km<1?0:km<10?Math.round(km):Math.round(km/5)*5;
}

/** Ways for the two of you to stay close: mood, quizzes, question packs, the know-me game, a journal, live status and moments. */
export function connectRoutes(c:Context,notify?:Notify){
  const router=Router();router.use(c.authenticated,c.paired);
  const couple=(req:Request)=>req.identity.coupleId!;const me=(req:Request)=>req.identity.id;
  const changed=(req:Request)=>c.changed(couple(req),'us');
  const partnerOf=async(req:Request)=>(await c.one('SELECT u.id,u.name FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.couple_id=? AND m.user_id!=?',couple(req),me(req)))!;

  // Mood check-in: one per person per day, with an optional "what I need" note.
  router.get('/mood',async(req,res)=>{
    const today=day.parse(typeof req.query.day==='string'?req.query.day:new Date().toISOString().slice(0,10));const from=dayString(dayNumber(today)-6);
    const rows=await c.all('SELECT user_id,day,mood,note,updated_at FROM moods WHERE couple_id=? AND day>=? AND day<=? ORDER BY day',couple(req),from,today);
    const mine=(d:string)=>rows.find(row=>row.day===d&&row.user_id===me(req))||null,theirs=(d:string)=>rows.find(row=>row.day===d&&row.user_id!==me(req))||null;
    res.json({day:today,mine:mine(today),partner:theirs(today),week:Array.from({length:7},(_,i)=>{const d=dayString(dayNumber(from)+i);return {day:d,mine:mine(d)?.mood||null,partner:theirs(d)?.mood||null};})});
  });
  router.put('/mood',async(req,res)=>{
    const input=z.object({day,mood:z.enum(MOODS),note:z.string().trim().max(280).default('')}).parse(req.body);
    if(Math.abs(dayNumber(input.day)-dayNumber(new Date().toISOString().slice(0,10)))>1)throw new HttpError(400,'Check in for today.');
    await c.run('INSERT INTO moods VALUES(?,?,?,?,?,?) ON CONFLICT(couple_id,user_id,day) DO UPDATE SET mood=excluded.mood,note=excluded.note,updated_at=excluded.updated_at',couple(req),me(req),input.day,input.mood,input.note,now());
    await changed(req);res.json({ok:true});
  });

  // Quizzes: each person's scores per category; the app works them out from the answers.
  router.get('/quizzes',async(req,res)=>{
    const partner=await partnerOf(req);const rows=await c.all('SELECT user_id,quiz,result,updated_at FROM quiz_results WHERE user_id IN (?,?)',me(req),partner.id);
    const pick=(user:string)=>Object.fromEntries(rows.filter(row=>row.user_id===user).map(row=>[row.quiz,{scores:JSON.parse(row.result),updated_at:row.updated_at}]));
    res.json({mine:pick(me(req)),partner:pick(partner.id),partner_name:partner.name});
  });
  router.put('/quizzes/:quiz',async(req,res)=>{
    const quiz=z.enum(QUIZZES).parse(req.params.quiz);const {scores}=z.object({scores:z.record(z.string().regex(/^[a-z_]{1,24}$/),z.number().int().min(0).max(100))}).parse(req.body);
    if(Object.keys(scores).length<2||Object.keys(scores).length>8)throw new HttpError(400,'Invalid quiz result.');
    await c.run('INSERT INTO quiz_results VALUES(?,?,?,?) ON CONFLICT(user_id,quiz) DO UPDATE SET result=excluded.result,updated_at=excluded.updated_at',me(req),quiz,JSON.stringify(scores),now());
    await changed(req);res.json({ok:true});
  });

  // Question packs: answered in order; an answer is shown to the partner once both have answered.
  async function packState(req:Request,pack:string){
    const questions=PACKS[pack].questions;const answers=await c.all('SELECT idx,user_id,answer FROM pack_answers WHERE couple_id=? AND pack=?',couple(req),pack);
    const both=(idx:number)=>answers.filter(a=>a.idx===idx).length>=2;let current=0;while(current<questions.length&&both(current))current++;
    const mine=answers.find(a=>a.idx===current&&a.user_id===me(req)),theirs=answers.find(a=>a.idx===current&&a.user_id!==me(req));
    const history=Array.from({length:current},(_,idx)=>({idx,question:questions[idx],mine:answers.find(a=>a.idx===idx&&a.user_id===me(req))?.answer,partner:answers.find(a=>a.idx===idx&&a.user_id!==me(req))?.answer})).reverse().slice(0,10);
    return {pack,title:PACKS[pack].title,total:questions.length,done:current,current:current<questions.length?{idx:current,question:questions[current],mine:mine?.answer||null,partner_answered:!!theirs}:null,history};
  }
  router.get('/packs',async(req,res)=>res.json(await Promise.all(Object.keys(PACKS).map(pack=>packState(req,pack)))));
  router.post('/packs/:pack/:idx',async(req,res)=>{
    const pack=z.enum(Object.keys(PACKS) as [string,...string[]]).parse(req.params.pack);const idx=z.coerce.number().int().min(0).parse(req.params.idx);
    const {answer}=z.object({answer:z.string().trim().min(1).max(1000)}).parse(req.body);const state=await packState(req,pack);
    if(!state.current||state.current.idx!==idx)throw new HttpError(409,'That question was already answered by both of you.');
    await c.run('INSERT INTO pack_answers VALUES(?,?,?,?,?,?) ON CONFLICT(couple_id,pack,idx,user_id) DO UPDATE SET answer=excluded.answer',couple(req),pack,idx,me(req),answer,now());
    await changed(req);res.json(await packState(req,pack));
  });
  /** Days in a row (ending today or yesterday) on which both of you answered the daily question. */
  router.get('/streak',async(req,res)=>{
    const days=new Set((await c.all('SELECT day FROM daily_answers WHERE couple_id=? GROUP BY day HAVING count(*)>1',couple(req))).map(row=>row.day as string));
    let cursor=dayNumber(day.parse(typeof req.query.day==='string'?req.query.day:new Date().toISOString().slice(0,10)));if(!days.has(dayString(cursor)))cursor--;
    let streak=0;while(days.has(dayString(cursor))){streak++;cursor--;}
    res.json({streak});
  });

  // How well do you know me? One person answers about themselves, the other guesses.
  router.get('/game',async(req,res)=>{
    const rows=await c.all('SELECT * FROM know_rounds WHERE couple_id=? ORDER BY created_at DESC LIMIT 40',couple(req));
    const view=(row:any)=>({id:row.id,question:KNOW_QUESTIONS[row.question].question,options:KNOW_QUESTIONS[row.question].options,about_me:row.subject_id===me(req),
      answer:row.subject_id===me(req)||row.guess!==null?row.subject_answer:null,guess:row.guess,correct:row.guess===null?null:row.guess===row.subject_answer,created_at:row.created_at});
    const scored=rows.filter(row=>row.guess!==null);
    res.json({to_guess:rows.filter(row=>row.guess===null&&row.subject_id!==me(req)).map(view),waiting:rows.filter(row=>row.guess===null&&row.subject_id===me(req)).map(view),
      results:scored.slice(0,10).map(view),score:{mine:scored.filter(row=>row.subject_id!==me(req)&&row.guess===row.subject_answer).length,mine_total:scored.filter(row=>row.subject_id!==me(req)).length,
      partner:scored.filter(row=>row.subject_id===me(req)&&row.guess===row.subject_answer).length,partner_total:scored.filter(row=>row.subject_id===me(req)).length},
      next:await nextQuestion(req)});
  });
  async function nextQuestion(req:Request){
    const asked=new Set((await c.all('SELECT question FROM know_rounds WHERE couple_id=? AND subject_id=?',couple(req),me(req))).map(row=>Number(row.question)));
    const open=KNOW_QUESTIONS.map((_,i)=>i).filter(i=>!asked.has(i));const index=open.length?open[Math.floor(Math.random()*open.length)]:Math.floor(Math.random()*KNOW_QUESTIONS.length);
    return {index,question:KNOW_QUESTIONS[index].question,options:KNOW_QUESTIONS[index].options};
  }
  router.post('/game',async(req,res)=>{
    const input=z.object({question:z.number().int().min(0).max(KNOW_QUESTIONS.length-1),answer:z.number().int().min(0).max(3)}).parse(req.body);
    const resource=id();await c.run('INSERT INTO know_rounds VALUES(?,?,?,?,?,NULL,?,NULL)',resource,couple(req),me(req),input.question,input.answer,now());
    await notify?.(couple(req),me(req),'game',resource);await changed(req);res.status(201).json({id:resource});
  });
  router.post('/game/:id/guess',async(req,res)=>{
    const round=await c.owned('know_rounds',String(req.params.id),req);const {guess}=z.object({guess:z.number().int().min(0).max(3)}).parse(req.body);
    if(round.subject_id===me(req))throw new HttpError(400,'Your partner guesses this one.');if(round.guess!==null)throw new HttpError(409,'Already guessed.');
    await c.run('UPDATE know_rounds SET guess=?,guessed_at=? WHERE id=? AND guess IS NULL',guess,now(),round.id);
    await changed(req);res.json({correct:guess===round.subject_answer,answer:round.subject_answer});
  });

  // Journal: gratitude entries both of you read, private entries only the writer sees.
  router.get('/journal',async(req,res)=>res.json(await c.all("SELECT j.*,u.name AS author_name FROM journal_entries j JOIN users u ON u.id=j.user_id WHERE j.couple_id=? AND (j.kind='gratitude' OR j.user_id=?) ORDER BY j.created_at DESC LIMIT 100",couple(req),me(req))));
  router.post('/journal',async(req,res)=>{
    const input=z.object({kind:z.enum(['gratitude','private']),text:z.string().trim().min(1).max(2000)}).parse(req.body);const resource=id();
    await c.run('INSERT INTO journal_entries VALUES(?,?,?,?,?,?)',resource,couple(req),me(req),input.kind,input.text,now());
    if(input.kind==='gratitude'){await notify?.(couple(req),me(req),'gratitude',resource);await changed(req);}res.status(201).json({id:resource});
  });
  router.delete('/journal/:id',async(req,res)=>{const entry=await c.owned('journal_entries',String(req.params.id),req);if(entry.user_id!==me(req))throw new HttpError(403,'Only the writer can delete this.');await c.run('DELETE FROM journal_entries WHERE id=?',entry.id);await changed(req);res.json({ok:true});});

  // Status: local time, battery and (only if shared) how far apart you are. Coordinates never leave the server.
  router.put('/status',async(req,res)=>{
    const input=z.object({timezone:z.string().max(100).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}}),battery:z.number().int().min(0).max(100).nullable().optional(),charging:z.boolean().nullable().optional(),
      location:z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)}).nullable().optional(),reunion:day.nullable().optional()}).parse(req.body);
    const previous=await c.one('SELECT lat,lng,reunion FROM partner_status WHERE user_id=?',me(req));
    const location=input.location===undefined?previous&&previous.lat!==null?{lat:previous.lat,lng:previous.lng}:null:input.location;const reunion=input.reunion===undefined?previous?.reunion??null:input.reunion;
    await c.run('INSERT INTO partner_status VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET timezone=excluded.timezone,battery=excluded.battery,charging=excluded.charging,lat=excluded.lat,lng=excluded.lng,reunion=excluded.reunion,updated_at=excluded.updated_at',
      me(req),input.timezone,input.battery??null,input.charging==null?null:input.charging?1:0,location?Math.round(location.lat*1000)/1000:null,location?Math.round(location.lng*1000)/1000:null,reunion,now());
    if(input.reunion!==undefined)await changed(req);res.json({ok:true});
  });
  router.get('/status',async(req,res)=>{
    const partner=await partnerOf(req);const [mine,theirs]=await Promise.all([c.one('SELECT * FROM partner_status WHERE user_id=?',me(req)),c.one('SELECT * FROM partner_status WHERE user_id=?',partner.id)]);
    const coords=(row:any)=>row&&row.lat!==null&&row.lng!==null?{lat:Number(row.lat),lng:Number(row.lng)}:null;const a=coords(mine),b=coords(theirs);
    const reunion=[mine?.reunion,theirs?.reunion].filter(Boolean).sort()[0]||null;
    res.json({sharing_location:!!a,reunion,partner:theirs?{name:partner.name,timezone:theirs.timezone,battery:theirs.battery,charging:theirs.charging===null?null:!!Number(theirs.charging),updated_at:theirs.updated_at,sharing_location:!!b}:{name:partner.name},distance_km:a&&b?distanceKm(a,b):null});
  });

  // Moments: a drawing or photo sent to the partner's widget and Home screen.
  router.get('/moment',async(req,res)=>{
    const rows=await c.all('SELECT m.*,u.name AS sender_name FROM moments m JOIN users u ON u.id=m.user_id WHERE m.couple_id=? ORDER BY m.created_at DESC LIMIT 20',couple(req));
    res.json({from_partner:rows.find(row=>row.user_id!==me(req))||null,mine:rows.find(row=>row.user_id===me(req))||null});
  });
  router.post('/moment',async(req,res)=>{
    const input=z.object({media_id:z.uuid(),kind:z.enum(['drawing','photo']),caption:z.string().trim().max(80).default('')}).parse(req.body);
    const media=await c.owned('media',input.media_id,req);if(media.user_id!==me(req)||!String(media.mime).startsWith('image/'))throw new HttpError(400,'Choose a photo or drawing.');
    const resource=id();await c.run('INSERT INTO moments VALUES(?,?,?,?,?,?,?)',resource,couple(req),me(req),media.id,input.kind,input.caption,now());
    await notify?.(couple(req),me(req),'moment',resource);await changed(req);res.status(201).json({id:resource});
  });
  return router;
}
