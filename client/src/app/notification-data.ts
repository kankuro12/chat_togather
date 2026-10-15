export function isChoiceNotification(notification:{tag?:string;data?:unknown}):boolean{
  const data=notification.data as {page?:string;kind?:string;FCM_MSG?:{data?:{page?:string;kind?:string}}}|undefined;
  const payload=data?.FCM_MSG?.data;
  return notification.tag?.startsWith('choice:')===true||data?.page==='choices'||data?.kind==='choice'||payload?.page==='choices'||payload?.kind==='choice';
}

export type NoticePage='chat'|'choices'|'us'|'games';
export function notificationPage(data:{page?:string;kind?:string}):NoticePage{return data.page==='choices'||data.kind==='choice'?'choices':data.page==='us'?'us':data.page==='games'?'games':'chat';}

export function isCallNotification(notification:{tag?:string;data?:unknown}):boolean{
  const data=notification.data as {kind?:string;FCM_MSG?:{data?:{kind?:string}}}|undefined;
  return data?.kind==='call'||data?.kind==='call_cancel'||data?.FCM_MSG?.data?.kind==='call'||data?.FCM_MSG?.data?.kind==='call_cancel';
}

export function notificationDetails(data:Record<string,string>):NotificationOptions{
  const choice=data.kind==='choice'||data.page==='choices';
  const id=data.event||data.notification_id||data.event_id||data.message_id||data.choice_id||data.client_id||data.id||globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;
  return {body:data.body||(choice?'New choice waiting from your partner.':'New update from your partner.'),tag:`${choice?'choice':'chat'}:${id}`,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',data:{...data,page:data.page||(choice?'choices':'chat')}};
}

/** Title and one-line summary written by the server for this event, with generic text for older servers. */
export function notificationTitle(data:Record<string,string>){return data.title||'Together';}
export function notificationSummary(data:Record<string,string>){
  if(data.kind==='call')return 'Incoming '+(data.call_kind||'audio')+' call.';
  if(data.title&&data.body)return data.title+': '+data.body;
  return data.kind==='choice'?'New choice waiting from your partner.':'New message from your partner.';
}

export function callNotificationDetails(data:Record<string,string>):{title:string;options:NotificationOptions}|undefined{
  if(data.kind!=='call'||!data.call_id||!Number.isFinite(Number(data.expires_at))||Number(data.expires_at)<=Date.now())return;
  return {title:'Incoming '+(data.call_kind||'audio')+' call',options:{body:data.caller_name||'Your partner',tag:data.call_id,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',requireInteraction:true,actions:[{action:'answer',title:'Answer'},{action:'decline',title:'Decline'}],data:{...data,page:'chat'}} as NotificationOptions};
}
