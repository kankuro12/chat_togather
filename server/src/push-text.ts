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
  if(kind==='message'){
    const message=await db.prepare('SELECT m.text,u.name,media.mime,mp.duration,md.event AS choice_event FROM messages m JOIN users u ON u.id=m.user_id LEFT JOIN media ON media.id=m.media_id LEFT JOIN media_previews mp ON mp.media_id=m.media_id LEFT JOIN message_decisions md ON md.message_id=m.id WHERE m.id=? AND m.couple_id=?').get(event,couple);
    if(!message)return;
    if(!previews)return {title:'Together',body:message.choice_event==='chosen'?'Your choice was answered':privateMedia(message.mime)};
    if(message.choice_event==='chosen')return {title:`${message.name} answered your choice`,body:clip(message.text)};
    const label=mediaLabel(message.mime,message.duration);
    return {title:message.name,body:clip([label,message.text].filter(Boolean).join(' · '))||'New message'};
  }
}
