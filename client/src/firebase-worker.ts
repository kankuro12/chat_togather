import './pwa-worker';
import {initializeApp} from 'firebase/app';
import {getMessaging,onBackgroundMessage} from 'firebase/messaging/sw';
import {notificationDetails,notificationTitle,callNotificationDetails} from './app/notification-data';
declare const self:ServiceWorkerGlobalScope;
self.addEventListener('notificationclick',event=>{event.stopImmediatePropagation();event.notification.close();const data=event.notification.data||{},fcm=data.FCM_MSG?.data||{},call=data.call_id||fcm.call_id,page=data.page||fcm.page;const action=event.action==='decline'?'decline':event.action==='answer'?'answer':'view';const target=call?'/#chat?call='+encodeURIComponent(call)+'&action='+action:page==='choices'?'/#choices':page==='us'?'/#us':'/#chat';event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{const client=clients.find(client=>new URL(client.url).origin===self.location.origin) as WindowClient|undefined;if(client){await client.navigate(target);return client.focus();}return self.clients.openWindow(target);}));});

const config=JSON.parse(new URL(self.location.href).searchParams.get('config')||'null');
if(config){const messaging=getMessaging(initializeApp(config));onBackgroundMessage(messaging,payload=>{
  // Notification payloads are displayed by FCM. Data-only web pushes carry the server's title and body.
  if(payload.data?.kind==='call_cancel')return self.registration.getNotifications({tag:payload.data.call_id}).then(list=>list.forEach(notification=>notification.close()));
  if(payload.data?.kind==='call'){const call=callNotificationDetails(payload.data);return call?self.registration.showNotification(call.title,call.options):Promise.resolve();}
  if(!payload.notification){const data=payload.data||{};return self.registration.showNotification(notificationTitle(data),notificationDetails(data));}
  return Promise.resolve();
});}
