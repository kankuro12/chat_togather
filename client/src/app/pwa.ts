import {registerPushWorker} from './push-worker';
import {Injectable,signal} from '@angular/core';
import {Capacitor} from '@capacitor/core';
type InstallPrompt=Event&{prompt():Promise<void>;userChoice:Promise<{outcome:string}>};
@Injectable({providedIn:'root'})
export class Pwa{
  available=signal(false);installed=signal(matchMedia('(display-mode: standalone)').matches);updateReady=signal(false);working=signal(false);private prompt?:InstallPrompt;private registration?:ServiceWorkerRegistration;
  constructor(){if(Capacitor.isNativePlatform())return;window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();this.prompt=event as InstallPrompt;this.available.set(true);});window.addEventListener('appinstalled',()=>{this.available.set(false);this.installed.set(true);this.prompt=undefined;});if('serviceWorker' in navigator&&window.isSecureContext)void this.register();}
  private async register(){try{this.registration=await registerPushWorker(navigator.serviceWorker);this.updateReady.set(!!this.registration.waiting);navigator.serviceWorker.addEventListener('controllerchange',()=>this.updateReady.set(false));this.registration.addEventListener('updatefound',()=>{const worker=this.registration?.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)this.updateReady.set(true);});});}catch{ /* Offline first launch can retry after reconnect. */ }}
  async install(){if(!this.prompt||this.working())return;this.working.set(true);try{await this.prompt.prompt();await this.prompt.userChoice;this.available.set(false);this.prompt=undefined;}finally{this.working.set(false);}}
  update(){const worker=this.registration?.waiting;if(!worker)return;navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});worker.postMessage({type:'ACTIVATE'});}
}
