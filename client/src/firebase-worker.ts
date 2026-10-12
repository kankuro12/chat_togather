import './pwa-worker';
import {initializeApp} from 'firebase/app';
import {getMessaging,onBackgroundMessage} from 'firebase/messaging/sw';
declare const self:ServiceWorkerGlobalScope;
self.addEventListener('notificationclick',event=>{event.stopImmediatePropagation();event.notification.close();const call=event.notification.data?.call_id;const action=event.action==='decline'?'decline':event.action==='answer'?'answer':'view';const target=call?'/#chat?call='+encodeURIComponent(call)+'&action='+action:'/#chat';event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(client=>new URL(client.url).origin===self.location.origin) as WindowClient|undefined;if(client){await client.navigate(target);return client.focus();}return self.clients.openWindow(target);}));});

const config=JSON.parse(new URL(self.location.href).searchParams.get('config')||'null');
if(config){const messaging=getMessaging(initializeApp(config));onBackgroundMessage(messaging,payload=>{
  // Notification payloads are displayed by FCM. Data-only updates use generic text.
  if(payload.data?.kind==='call_cancel')return self.registration.getNotifications({tag:payload.data.call_id}).then(list=>list.forEach(notification=>notification.close()));
  if(payload.data?.kind==='call'){const data=payload.data;if(Number(data.expires_at)<=Date.now())return Promise.resolve();return self.registration.showNotification('Incoming '+(data.call_kind||'audio')+' call',{body:data.caller_name||'Your partner',tag:data.call_id,requireInteraction:true,actions:[{action:'answer',title:'Answer'},{action:'decline',title:'Decline'}],data:{call_id:data.call_id}});}
  if(!payload.notification)return self.registration.showNotification('Together',{body:'New update from your partner.',data:{page:'chat'}});
  return Promise.resolve();
});}
