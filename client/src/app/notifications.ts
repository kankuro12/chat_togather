import {Injectable,inject,signal,effect} from '@angular/core';
import {Capacitor} from '@capacitor/core';
import {NativeCalls} from './communication';
import {Api} from './api';
@Injectable({providedIn:'root'})
export class Notifications {
  nativeAndroid=Capacitor.getPlatform()==='android';fullScreen=signal(true);callSettings(){void NativeCalls.settings();}
  api=inject(Api);status=signal('Checking notifications…');available=signal(false);private configCheckedFor='';enabled=signal(localStorage.getItem('together.notifications')==='on');working=signal(false);notice=signal('');private listening=false;private previousUnread:number|null=null;private noticeTimer?:ReturnType<typeof setTimeout>;
  constructor(){effect(()=>{const pair=this.api.pair();if(pair&&this.configCheckedFor!==pair.id){this.configCheckedFor=pair.id;void this.checkStatus();}});effect(()=>{if(this.api.pair()&&this.enabled()&&!this.restored){this.restored=true;this.working.set(true);void this.register(true).catch(()=>{this.enabled.set(false);localStorage.removeItem('together.notifications');}).finally(()=>{this.working.set(false);if(this.api.pair())void this.checkStatus();});}});effect(()=>{const unread=this.api.unread();if(this.api.chatReading()){this.notice.set('');void this.clearDelivered();}if(!this.api.user()){this.previousUnread=null;this.notice.set('');return;}if(this.previousUnread!==null&&unread>this.previousUnread&&!this.api.chatReading())this.showNotice('New message from '+(this.api.partner()?.name||'your partner')+'.');this.previousUnread=unread;});effect(()=>{if(!this.api.booting()&&!this.api.user()){this.enabled.set(false);this.restored=false;this.configCheckedFor='';localStorage.removeItem('together.notifications');}});}
  async checkStatus(){const session=this.api.token;try{const config=await this.api.request('/communication/config');if(session!==this.api.token)return;const native=Capacitor.isNativePlatform();if(this.nativeAndroid){try{this.fullScreen.set((await NativeCalls.permissionStatus()).fullScreen);}catch{this.fullScreen.set(false);}}const supported=native?Capacitor.isPluginAvailable('FirebaseMessaging'):'Notification' in window&&'serviceWorker' in navigator;this.available.set(!!config.notifications&&supported&&(native||!!config.firebase&&!!config.vapidKey));this.status.set((!config.notifications||!native&&(!config.firebase||!config.vapidKey))?'In-app alerts active. Push setup pending.':!supported?'Push unavailable on this device.':!native&&Notification.permission==='denied'?'Blocked in browser settings.':this.enabled()?'Push notifications on.':'Receive alerts when Together is closed.');}catch{this.status.set('Check connection to manage notifications.');}}
  private async register(restore=false){
    const config=await this.api.request('/communication/config');if(!config.notifications)throw new Error('Notifications are unavailable right now.');const session=this.api.token;let token:string;
    if(Capacitor.isNativePlatform()){
      if(!Capacitor.isPluginAvailable('FirebaseMessaging'))throw new Error('Notifications are unavailable on this device.');const {FirebaseMessaging}=await import('@capacitor-firebase/messaging');const permission=restore?await FirebaseMessaging.checkPermissions():await FirebaseMessaging.requestPermissions();if(permission.receive!=='granted')throw new Error('Allow notifications in your device settings.');token=(await FirebaseMessaging.getToken()).token;
      if(!this.listening){await FirebaseMessaging.addListener('tokenReceived',event=>{if(this.enabled()&&this.api.user())void this.api.request('/notifications/token',{token:event.token}).catch(()=>{});});await FirebaseMessaging.addListener('notificationReceived',()=>{if(this.enabled()&&this.api.user()&&!this.api.connected())this.showNotice('New message from your partner.');});await FirebaseMessaging.addListener('notificationActionPerformed',()=>{location.hash='chat';});this.listening=true;}
    }else{
      if(!config.firebase||!config.vapidKey)throw new Error('Notifications are unavailable right now.');const {getMessaging,getToken,isSupported,onMessage}=await import('firebase/messaging');if(!await isSupported())throw new Error('Notifications are unsupported in this browser.');
      const permission=restore?Notification.permission:await Notification.requestPermission();if(permission!=='granted')throw new Error('Allow notifications in your browser settings.');const {getApps,initializeApp}=await import('firebase/app');const app=getApps().find(app=>app.name==='together-push')||initializeApp(config.firebase,'together-push');const messaging=getMessaging(app);
      const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js?config='+encodeURIComponent(JSON.stringify(config.firebase)));const pending=registration.installing||registration.waiting;if(pending){pending.postMessage({type:'ACTIVATE'});if(pending.state!=='activated')await new Promise<void>(resolve=>{pending.addEventListener('statechange',()=>{if(pending.state==='activated')resolve();});});}await navigator.serviceWorker.ready;token=await getToken(messaging,{vapidKey:config.vapidKey,serviceWorkerRegistration:registration});
      if(!this.listening){onMessage(messaging,()=>{if(this.api.user()&&!this.api.connected())this.showNotice('New message from your partner.');});this.listening=true;}
    }
    if(session!==this.api.token)return;await this.api.request('/notifications/token',{token});if(session!==this.api.token)return;this.enabled.set(true);localStorage.setItem('together.notifications','on');this.status.set('Push notifications on.');
  }
  private restored=false;
  private async clearDelivered(){if(!this.enabled())return;try{if(Capacitor.isNativePlatform()){const {FirebaseMessaging}=await import('@capacitor-firebase/messaging');await FirebaseMessaging.removeAllDeliveredNotifications();}else{const registration=await navigator.serviceWorker.getRegistration('/');for(const notification of await registration?.getNotifications()||[])notification.close();}}catch{}}
  showNotice(text:string){if(this.api.chatReading())return;clearTimeout(this.noticeTimer);this.notice.set(text);this.noticeTimer=setTimeout(()=>this.notice.set(''),6000);}
  async toggle(){if(this.working())return;this.working.set(true);try{
    if(this.enabled()){
      await this.api.request('/notifications/token',undefined,'DELETE');
      if(Capacitor.isNativePlatform()){const {FirebaseMessaging}=await import('@capacitor-firebase/messaging');await FirebaseMessaging.deleteToken();}
      else{const {getApps}=await import('firebase/app');const {getMessaging,deleteToken}=await import('firebase/messaging');const app=getApps().find(app=>app.name==='together-push');if(app)await deleteToken(getMessaging(app));}
      this.enabled.set(false);localStorage.removeItem('together.notifications');this.status.set('In-app alerts active. Push notifications off.');return;
    }
    await this.register();
  }catch(e){this.api.error.set((e as Error).message||'Notifications unavailable. Please try again.');}finally{this.working.set(false);}}
}
