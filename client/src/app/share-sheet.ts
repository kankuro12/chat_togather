import { Component, ElementRef, ViewChild, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { Outbox } from './outbox';
import { ShareInbox } from './share';
import { SharedList } from './models';

const URL_PATTERN=/https?:\/\/[^\s<>"']+/i;
/** Same limits as attaching in chat: photos are compressed before upload, other media must already be small. */
const tooLarge=(file:File)=>file.size>(file.type.startsWith('image/')?40:15)*1024*1024;

/** "Share with Together": choose where something shared from another app goes. */
@Component({selector:'share-sheet',standalone:true,imports:[FormsModule,IonIcon],template:`
<dialog #sheet class="modal share-sheet" aria-labelledby="share-title" (close)="closed()">
  @if(share.incoming();as content){
  <div class="modal-heading"><h2 id="share-title">Share with Together</h2><button type="button" class="icon-button" aria-label="Cancel sharing" (click)="sheet.close()"><ion-icon name="close-outline"></ion-icon></button></div>
  @if(previews().length){<div class="share-preview">@for(item of previews();track item.url){<figure>@if(item.kind==='image'){<img [src]="item.url" [alt]="item.name">}@else if(item.kind==='video'){<video [src]="item.url" muted playsinline preload="metadata"></video><ion-icon name="play" aria-hidden="true"></ion-icon>}@else{<span class="share-file"><ion-icon [name]="item.kind==='audio'?'mic':'attach-outline'" aria-hidden="true"></ion-icon>{{item.name}}</span>}</figure>}</div>}
  @if(content.text){<p class="share-text">{{content.text}}</p>}
  @if(skipped()){<p class="form-error" role="alert">{{skipped()}} {{skipped()===1?'item was':'items were'}} too large to share (photos up to 40 MB, videos and audio up to 15 MB).</p>}
  @if(picking()){
    <p class="fineprint">Add to which list?</p>
    <div class="share-targets">@for(list of lists();track list.id){<button type="button" class="share-target" (click)="addToList(list.id)"><ion-icon name="list-outline" aria-hidden="true"></ion-icon>{{list.title}}</button>}<button type="button" class="share-target" (click)="addToList()"><ion-icon name="add-outline" aria-hidden="true"></ion-icon>New list “Shared”</button></div>
    <button type="button" class="text-button" (click)="picking.set(false)">Back</button>
  }@else{
    <label class="share-message">Add a message<input name="message" [(ngModel)]="message" maxlength="4000" placeholder="Say something…" autocomplete="off"></label>
    <div class="share-targets">
      <button type="button" class="share-target main" (click)="sendToChat()" [disabled]="busy()||nothing()"><span class="share-avatar" aria-hidden="true">{{initial()}}</span><span>Send to {{partner()}}</span></button>
      @if(visual().length){<button type="button" class="share-target" (click)="saveToMemories()" [disabled]="busy()"><ion-icon name="images-outline" aria-hidden="true"></ion-icon>Save to Memories</button>}
      @if(content.text&&!sendable().length){<button type="button" class="share-target" (click)="addWish()" [disabled]="busy()"><ion-icon name="gift-outline" aria-hidden="true"></ion-icon>Add to wishlist</button><button type="button" class="share-target" (click)="pickList()" [disabled]="busy()"><ion-icon name="list-outline" aria-hidden="true"></ion-icon>Add to a list</button>}
    </div>
  }}
</dialog>`})
export class ShareSheet {
  share=inject(ShareInbox);private api=inject(Api);private outbox=inject(Outbox);navigate=output<string>();
  @ViewChild('sheet',{static:true}) sheet!:ElementRef<HTMLDialogElement>;
  message='';busy=signal(false);picking=signal(false);lists=signal<SharedList[]>([]);
  partner=computed(()=>this.api.partner()?.name||'your partner');initial=computed(()=>this.partner().charAt(0).toUpperCase());
  sendable=computed(()=>(this.share.incoming()?.files||[]).filter(file=>!tooLarge(file)));
  visual=computed(()=>this.sendable().filter(file=>file.type.startsWith('image/')||file.type.startsWith('video/')));
  skipped=computed(()=>{const content=this.share.incoming();return content?content.skipped+content.files.filter(tooLarge).length:0;});
  nothing=computed(()=>!this.sendable().length&&!this.share.incoming()?.text);
  previews=signal<{url:string;name:string;kind:'image'|'video'|'audio'|'file'}[]>([]);
  constructor(){
    // Opens once someone has shared something and the app is signed in and paired.
    effect(()=>{const content=this.share.incoming(),paired=!!this.api.pair();untracked(()=>{
      this.release();if(!content||!paired)return;
      this.previews.set(this.sendable().slice(0,10).map(file=>({url:URL.createObjectURL(file),name:file.name,kind:file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'file'})));
      this.message='';this.picking.set(false);if(!this.sheet.nativeElement.open)this.sheet.nativeElement.showModal();
      if(content.direct)setTimeout(()=>this.sheet.nativeElement.querySelector<HTMLInputElement>('.share-message input')?.focus(),0);
    });});
  }
  private release(){for(const item of this.previews())URL.revokeObjectURL(item.url);this.previews.set([]);}
  closed(){this.release();this.share.done();}
  private finish(page:string){this.sheet.nativeElement.close();this.navigate.emit(page);}
  /** Each file becomes its own message; the note and any shared text ride along with the first one. */
  sendToChat(){
    const content=this.share.incoming();if(!content)return;const caption=[this.message.trim(),content.text].filter(Boolean).join('\n');const files=this.sendable();
    if(!files.length)this.outbox.add({client_id:crypto.randomUUID(),text:caption});
    files.forEach((file,index)=>this.outbox.add({client_id:crypto.randomUUID(),text:index===0?caption:'',file,preview:URL.createObjectURL(file),media_mime:file.type}));
    this.finish('chat');
  }
  async saveToMemories(){
    this.busy.set(true);try{for(const file of this.visual())await this.api.upload(file,'memory');await this.api.reload('media');this.finish('memories');}
    catch(error){this.api.error.set((error as Error).message);}finally{this.busy.set(false);}
  }
  async addWish(){
    const text=this.share.incoming()?.text||'';const link=text.match(URL_PATTERN)?.[0]||'';
    const title=(this.message.trim()||text.replace(URL_PATTERN,'').split('\n').map(line=>line.trim()).find(Boolean)||(link?new URL(link).hostname.replace(/^www\./,''):'Shared wish')).slice(0,160);
    this.busy.set(true);try{await this.api.request('/us/wishes',{title,link:link.slice(0,500)});this.finish('us');}catch(error){this.api.error.set((error as Error).message);}finally{this.busy.set(false);}
  }
  async pickList(){this.busy.set(true);try{this.lists.set(await this.api.request<SharedList[]>('/us/lists'));this.picking.set(true);}catch(error){this.api.error.set((error as Error).message);}finally{this.busy.set(false);}}
  async addToList(listId?:string){
    const text=(this.message.trim()||this.share.incoming()?.text||'').trim();if(!text)return;
    this.busy.set(true);try{const id=listId||(await this.api.request<SharedList>('/us/lists',{title:'Shared'})).id;
      for(const line of text.split('\n').map(item=>item.trim()).filter(Boolean).slice(0,30))await this.api.request(`/us/lists/${id}/items`,{title:line.slice(0,160)});
      this.finish('us');}catch(error){this.api.error.set((error as Error).message);}finally{this.busy.set(false);}
  }
}
