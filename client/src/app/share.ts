import { Injectable, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Api } from './api';
import { NativeCalls } from './communication';

export interface SharedContent {text:string;files:File[];skipped:number;direct:boolean}

/** Content shared into Together from other apps: Android's share sheet (including the partner's direct-share contact)
 *  or the installed web app's share target. The share sheet picks it up from `incoming`. */
@Injectable({providedIn:'root'})
export class ShareInbox {
  private api=inject(Api);private native=Capacitor.getPlatform()==='android';
  incoming=signal<SharedContent|null>(null);
  constructor(){
    if(this.native){void this.takeNative();window.addEventListener('native-share',()=>void this.takeNative());}
    else if(location.hash.startsWith('#share'))void this.takeWeb();
    // Android lists the partner in the system share sheet, like a messenger contact.
    let published:string|undefined;
    effect(()=>{const name=this.api.partner()?.name||'';if(!this.native||name===published)return;published=name;void NativeCalls.setPartner({name}).catch(()=>{});});
  }
  private async takeNative(){
    try{
      const data=await NativeCalls.takeShare();if(data.error){this.api.error.set(data.error);return;}
      if(!data.text&&!data.files?.length)return;
      const files=await Promise.all((data.files||[]).map(async file=>{const blob=await (await fetch(Capacitor.convertFileSrc(file.path))).blob();return new File([blob],file.name,{type:file.mime||blob.type});}));
      this.incoming.set({text:data.text||'',files,skipped:data.skipped||0,direct:!!data.direct});
    }catch{this.api.error.set('Could not open what was shared. Try sharing it again.');}
  }
  private async takeWeb(){
    history.replaceState(null,'','#home');
    try{
      const cache=await caches.open('together-share');const meta=await cache.match('/share/meta');if(!meta)return;
      const info=await meta.json() as {text:string;files:{name:string;type:string}[]};
      const files=await Promise.all(info.files.map(async(file,index)=>{const response=await cache.match('/share/file/'+index);const blob=response?await response.blob():new Blob();return new File([blob],file.name,{type:file.type||blob.type});}));
      for(const key of await cache.keys())await cache.delete(key);
      this.incoming.set({text:info.text,files:files.filter(file=>file.size>0),skipped:0,direct:false});
    }catch{this.api.error.set('Could not open what was shared. Try sharing it again.');}
  }
  done(){this.incoming.set(null);if(this.native)void NativeCalls.clearShare().catch(()=>{});}
}
