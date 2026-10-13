import { Injectable, effect, inject, signal } from '@angular/core';
import { Api, OfflineError } from './api';

export interface PendingMessage {
  client_id:string;text:string;reply_to?:string;reply_label?:string;view_once?:boolean;
  /** Attachments live only in memory; text-only messages also survive an app restart. */
  file?:File;preview?:string;media_mime?:string;media_id?:string;
  state:'sending'|'waiting'|'failed';error?:string;created_at:string;
}

/** Sends chat messages in order. Without a connection they wait and are retried when it returns;
 *  the client_id makes every retry safe because the server ignores duplicates. */
@Injectable({providedIn:'root'})
export class Outbox {
  private api=inject(Api);items=signal<PendingMessage[]>([]);private running=false;private retryTimer?:ReturnType<typeof setTimeout>;private loadedFor='';
  constructor(){
    effect(()=>{const user=this.api.user()?.id||'';if(user===this.loadedFor)return;this.loadedFor=user;this.items.set(user?this.restore(user):[]);if(user)void this.flush();});
    effect(()=>{if(this.api.connected())void this.flush();});
    window.addEventListener('online',()=>void this.flush());
  }
  private key(user=this.loadedFor){return 'together.outbox.'+user;}
  private restore(user:string):PendingMessage[]{try{return (JSON.parse(localStorage.getItem(this.key(user))||'[]') as PendingMessage[]).map(item=>({...item,state:item.state==='failed'?'failed':'waiting'}));}catch{return [];}}
  private persist(){try{localStorage.setItem(this.key(),JSON.stringify(this.items().filter(item=>!item.file||item.media_id).map(({file,preview,...rest})=>rest)));}catch{/* storage full or blocked: messages still send from memory */}}
  private update(client:string,change:Partial<PendingMessage>){this.items.update(list=>list.map(item=>item.client_id===client?{...item,...change}:item));this.persist();}
  add(item:Omit<PendingMessage,'state'|'created_at'>){this.items.update(list=>[...list,{...item,state:'sending',created_at:new Date().toISOString()}]);this.persist();void this.flush();}
  retry(client:string){this.update(client,{state:'sending',error:undefined});void this.flush();}
  discard(client:string){const item=this.items().find(entry=>entry.client_id===client);if(item?.preview)URL.revokeObjectURL(item.preview);this.items.update(list=>list.filter(entry=>entry.client_id!==client));this.persist();}
  async flush(){
    if(this.running||!this.api.user())return;this.running=true;clearTimeout(this.retryTimer);const session=this.api.token;
    try{
      for(;;){
        const next=this.items().find(item=>item.state!=='failed');if(!next||session!==this.api.token)break;
        this.update(next.client_id,{state:'sending'});
        try{
          let media=next.media_id;
          if(next.file&&!media){media=(await this.api.upload(next.file)).id;this.update(next.client_id,{media_id:media});}
          await this.api.request('/messages',{text:next.text,client_id:next.client_id,...(media?{media_id:media}:{}),...(next.reply_to?{reply_to:next.reply_to}:{}),...(next.view_once?{view_once:true}:{})});
          // Show the real message before removing the placeholder so the bubble never blinks out.
          await this.api.reload('messages').catch(()=>{});this.discard(next.client_id);
        }catch(error){
          if(error instanceof OfflineError){this.update(next.client_id,{state:'waiting'});this.retryTimer=setTimeout(()=>void this.flush(),15000);break;}
          this.update(next.client_id,{state:'failed',error:error instanceof Error&&error.message?error.message:'Could not send.'});
        }
      }
    }finally{this.running=false;}
  }
}
