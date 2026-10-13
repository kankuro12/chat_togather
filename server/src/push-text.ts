import type {Database} from './db.js';
export type PushText={title:string;body:string};

const clip=(value:string,max=140)=>{const text=value.replace(/\s+/g,' ').trim();return text.length>max?text.slice(0,max-1).trimEnd()+'…':text;};
const length=(seconds:unknown)=>{const total=Math.round(Number(seconds));if(!Number.isFinite(total)||total<=0)return '';return ` (${Math.floor(total/60)}:${String(total%60).padStart(2,'0')})`;};
export function mediaLabel(mime:string|null|undefined,duration?:unknown){
  if(!mime)return '';
  if(mime.startsWith('image/'))return '📷 Photo';
  if(mime.startsWith('video/'))return '🎥 Video'+length(duration);
  if(mime.startsWith('audio/'))return '🎤 Voice message'+length(duration);
  return '📎 Attachment';
}

/** Says only what kind of thing arrived, so nothing personal shows on a locked phone. */
const privateMedia=(mime:string|null|undefined)=>!mime?'New message':mime.startsWith('image/')?'📷 New photo':mime.startsWith('video/')?'🎥 New video':mime.startsWith('audio/')?'🎤 New voice message':'📎 New attachment';

/** Lock-screen text that says what actually happened: a chat message, a photo, a new choice, an answer to a choice.
 *  Without `previews` the names, message text and choice titles are left out. */
export async function pushText(db:Database,couple:string,kind:string,event?:string,previews=false):Promise<PushText|undefined>{
  if(!event)return;
  if(kind==='choice'){
    const choice=await db.prepare('SELECT d.title,d.mode,u.name,(SELECT count(*) FROM decision_options o WHERE o.decision_id=d.id) AS images FROM decisions d JOIN users u ON u.id=d.user_id WHERE d.id=? AND d.couple_id=?').get(event,couple);
    if(!choice)return;
    if(!previews)return {title:'Together',body:'🖼️ New choice waiting for you'};
    return {title:`${choice.name} shared a choice`,body:clip(`${choice.title} · ${Number(choice.images)} photos · ${choice.mode==='rate'?'Tap to rate them':'Tap to pick one'}`)};
  }
  if(kind==='nudge'){
    const nudge=await db.prepare('SELECT u.name FROM nudges n JOIN users u ON u.id=n.user_id WHERE n.id=? AND n.couple_id=?').get(event,couple);if(!nudge)return;
    return previews?{title:nudge.name,body:'💗 Thinking of you'}:{title:'Together',body:'💗 Someone is thinking of you'};
  }
  if(kind==='question'){
    const [day,user]=event.split(':');const person=await db.prepare('SELECT u.name FROM daily_answers a JOIN users u ON u.id=a.user_id WHERE a.couple_id=? AND a.day=? AND a.user_id=?').get(couple,day,user||'');if(!person)return;
    return previews?{title:person.name,body:'Answered today’s question. Answer yours to see it.'}:{title:'Together',body:'💬 Today’s question has a new answer'};
  }
  if(kind==='note'){
    const note=await db.prepare('SELECT u.name FROM love_notes n JOIN users u ON u.id=n.user_id WHERE n.id=? AND n.couple_id=?').get(event,couple);if(!note)return;
    return previews?{title:`💌 A love note from ${note.name}`,body:'It just unlocked. Tap to read it.'}:{title:'Together',body:'💌 A love note just unlocked'};
  }
  if(kind==='date'){
    const [dateId,occurrence]=event.split(':');const row=await db.prepare('SELECT title,kind,date FROM special_dates WHERE id=? AND couple_id=?').get(dateId,couple);if(!row)return;
    if(!previews)return {title:'Together',body:'🎉 You have a special date today'};
    const years=Number(String(occurrence).slice(0,4))-Number(String(row.date).slice(0,4));
    return {title:`🎉 Today: ${clip(row.title,60)}`,body:(row.kind==='together'||row.kind==='anniversary')&&years>0?`${years} year${years===1?'':'s'} together`:row.kind==='birthday'?'Make it special.':'A special day for you two.'};
  }
  if(kind==='message'){
    const message=await db.prepare('SELECT m.text,u.name,media.mime,mp.duration,md.event AS choice_event,(vo.message_id IS NOT NULL) AS view_once FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN message_view_once vo ON vo.message_id=m.id LEFT JOIN media ON media.id=m.media_id LEFT JOIN media_previews mp ON mp.media_id=m.media_id LEFT JOIN message_decisions md ON md.message_id=m.id WHERE m.id=? AND m.couple_id=?').get(event,couple);
    if(!message)return;
    if(Number(message.view_once))return {title:previews?message.name:'Together',body:'📷 View-once photo'};
    if(!previews)return {title:'Together',body:message.choice_event==='chosen'?'Your choice was answered':privateMedia(message.mime)};
    if(message.choice_event==='chosen')return {title:`${message.name} answered your choice`,body:clip(message.text)};
    const label=mediaLabel(message.mime,message.duration);
    return {title:message.name,body:clip([label,message.text].filter(Boolean).join(' · '))||'New message'};
  }
}
