import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getMessaging,type MulticastMessage} from 'firebase-admin/messaging';
import type {CommunicationOptions} from './communication.js';
import type {PushText} from './push-text.js';
type PushCall={id:string;expires:number;name:string;kind:string};

export function buildPushMessage(tokens:string[],kind:string,event?:string,call?:PushCall,text?:PushText):MulticastMessage{
  const page=kind==='choice'?'choices':'chat';
  const title=text?.title||'Together';const body=text?.body||(kind==='choice'?'New choice from your partner.':'New message from your partner.');
  const tag=event?(kind==='choice'?'choice:'+event:event):undefined;
  const nativeCall=(kind==='call'||kind==='call_cancel')&&!!call;
  const data={page,kind,...(event?{event}:{}),...(call?{call_id:call.id,call_kind:call.kind,caller_name:call.name,expires_at:String(call.expires)}:{}),...(text?{title,body}:{})};
  // Private visibility lets Android's "hide sensitive content" lock-screen setting redact it too.
  const androidNotification=nativeCall?undefined:{title,body,visibility:'private' as const,...(tag?{tag}:{})};
  const ttl=kind==='call_cancel'?'30':String(Math.ceil(Math.max(0,(call?.expires||Date.now()+86400000)-Date.now())/1000));
  return {
    tokens,data,
    webpush:{headers:{Urgency:'high',TTL:ttl}},
    android:{priority:'high',...(androidNotification?{notification:androidNotification}:{}),...(nativeCall&&kind==='call'&&call?{ttl:Math.max(0,call.expires-Date.now())}: {})},
    apns:{...(kind==='call_cancel'?{headers:{'apns-push-type':'background','apns-priority':'5'}}:{}),payload:{aps:{...(kind==='call_cancel'?{contentAvailable:true}:{sound:'default',alert:nativeCall&&call?{title:'Incoming '+call.kind+' call',body:call.name}:{title,body}})}}}
  };
}
export function firebaseOptions():CommunicationOptions {
  const firebase=process.env.FCM_WEB_CONFIG?JSON.parse(process.env.FCM_WEB_CONFIG):undefined;
  const projectId=process.env.FCM_PROJECT_ID;
  if(!projectId)return {firebase,vapidKey:process.env.FCM_VAPID_KEY};
  const app=getApps().find(app=>app.name==='together-fcm')||initializeApp({credential:process.env.FCM_CLIENT_EMAIL&&process.env.FCM_PRIVATE_KEY?cert({projectId,clientEmail:process.env.FCM_CLIENT_EMAIL,privateKey:process.env.FCM_PRIVATE_KEY.replace(/\\n/g,'\n')}):applicationDefault(),projectId},'together-fcm');
  return {firebase,vapidKey:process.env.FCM_VAPID_KEY,sendPush:async(tokens,kind,event,call,text)=>{
    const invalid:string[]=[];for(let i=0;i<tokens.length;i+=500){const batch=tokens.slice(i,i+500);const result=await getMessaging(app).sendEachForMulticast(buildPushMessage(batch,kind,event,call,text));
      result.responses.forEach((response,index)=>{const code=response.error?.code||'';if(!response.success&&!['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(code)){const error=Object.assign(new Error(response.error?.message||code||'Push delivery failed'),{code});throw error;}if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(code))invalid.push(batch[index]);});}return invalid;
  }};
}
