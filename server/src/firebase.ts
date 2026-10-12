import {applicationDefault,cert,getApps,initializeApp} from 'firebase-admin/app';
import {getMessaging} from 'firebase-admin/messaging';
import type {CommunicationOptions} from './communication.js';
export function firebaseOptions():CommunicationOptions {
  const firebase=process.env.FCM_WEB_CONFIG?JSON.parse(process.env.FCM_WEB_CONFIG):undefined;
  const projectId=process.env.FCM_PROJECT_ID;
  if(!projectId)return {firebase,vapidKey:process.env.FCM_VAPID_KEY};
  const app=getApps().find(app=>app.name==='together-fcm')||initializeApp({credential:process.env.FCM_CLIENT_EMAIL&&process.env.FCM_PRIVATE_KEY?cert({projectId,clientEmail:process.env.FCM_CLIENT_EMAIL,privateKey:process.env.FCM_PRIVATE_KEY.replace(/\\n/g,'\n')}):applicationDefault(),projectId},'together-fcm');
  return {firebase,vapidKey:process.env.FCM_VAPID_KEY,sendPush:async(tokens,kind,event,call)=>{
    const page=kind==='choice'?'choices':'chat',body=kind==='choice'?'New choice from your partner.':'New message from your partner.',tag=event?(kind==='choice'?'choice:'+event:event):undefined;
    const nativeCall=(kind==='call'||kind==='call_cancel')&&!!call;const invalid:string[]=[];for(let i=0;i<tokens.length;i+=500){const batch=tokens.slice(i,i+500);const result=await getMessaging(app).sendEachForMulticast({tokens:batch,...(nativeCall?{}:{notification:{title:'Together',body}}),data:{page,kind,...(event?{event}:{}),...(call?{call_id:call.id,call_kind:call.kind,caller_name:call.name,expires_at:String(call.expires)}:{})},webpush:nativeCall?{headers:{Urgency:'high',TTL:kind==='call_cancel'?'30':String(Math.max(0,Math.ceil((call!.expires-Date.now())/1000)))}}:{notification:{...(tag?{tag}:{})}},android:{priority:'high',...(nativeCall?{ttl:kind==='call'?Math.max(0,call!.expires-Date.now()):30000}:{notification:{...(tag?{tag}:{})}})},apns:{payload:{aps:{sound:'default',...(nativeCall&&kind==='call'?{alert:{title:'Incoming call',body:call!.name}}:{})}}}});
      result.responses.forEach((response,index)=>{if(!response.success&&!['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(response.error?.code||''))throw new Error('Push delivery failed');if(['messaging/registration-token-not-registered','messaging/invalid-registration-token'].includes(response.error?.code||''))invalid.push(batch[index]);});}return invalid;
  }};
}
