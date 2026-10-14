import { CalendarDate } from './calendar';
import { Component, inject, computed, signal, ViewChild, ElementRef } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { MediaView } from './media-view';
@Component({selector:'memories-page',standalone:true,imports:[IonIcon,MediaView,CalendarDate],template:`
<div class="page-heading"><div><h1>Memories</h1><p>{{count()}}</p></div><label class="primary upload-button" [class.disabled]="uploading()"><ion-icon name="add-outline"></ion-icon>Add memories<input type="file" multiple aria-label="Add memories" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav" (change)="upload($event)" [disabled]="uploading()"></label></div>
@if(uploading();as progress){<div class="upload-progress" role="status"><span>Uploading {{progress.done+1}} of {{progress.total}}…</span><progress [max]="progress.total" [value]="progress.done"></progress></div>}
@if(failed().length){<p class="form-error" role="alert">Could not add: {{failed().join(', ')}}</p>}
@if(!api.media().length){<div class="empty"><ion-icon name="images-outline"></ion-icon><h3>No memories yet</h3><p>Add photos, videos or voice recordings to share with your partner.</p></div>}
<div class="memories-grid">@for(media of api.media();track media.id){<article class="card memory-card" [class.audio-memory]="media.mime.startsWith('audio/')">@if(media.mime.startsWith('audio/')){<media-view [id]="media.id" [audio]="true" [duration]="media.duration" label="Voice memory"></media-view>}@else{<media-view [id]="media.id" [video]="media.mime.startsWith('video/')" [compact]="true" [thumb]="media.thumb" [duration]="media.duration" [width]="media.width" [height]="media.height" label="A memory together"></media-view><button class="memory-open" [attr.aria-label]="'Open memory from '+(media.created_at|calendarDate:'MMM d')" (click)="open(media.id)"></button>}<footer><span>{{name(media.user_id)}}</span><small>{{media.created_at|calendarDate:'MMM d, y'}}</small></footer></article>}</div><dialog #viewer class="modal media-viewer" (close)="selectedId.set('')"><button class="icon-button viewer-close" type="button" aria-label="Close memory" title="Close" (click)="viewer.close()"><ion-icon name="close-outline"></ion-icon></button>@if(selected();as media){<media-view [id]="media.id" [video]="media.mime.startsWith('video/')" [full]="true" [thumb]="media.thumb" [duration]="media.duration" [width]="media.width" [height]="media.height" label="Full memory"></media-view>}</dialog>`})
export class MemoriesPage {
  @ViewChild('viewer') viewer!:ElementRef<HTMLDialogElement>;api=inject(Api);selectedId=signal('');selected=computed(()=>this.api.media().find(media=>media.id===this.selectedId()));open(id:string){this.selectedId.set(id);this.viewer.nativeElement.showModal();}
  name(id:string){return this.api.pair()?.members.find(m=>m.id===id)?.name||'Us';}
  uploading=signal<{done:number;total:number}|null>(null);failed=signal<string[]>([]);
  count=computed(()=>{const items=this.api.media(),visual=items.filter(m=>!m.mime.startsWith('audio/')).length,voice=items.length-visual;return [visual?`${visual} photo${visual===1?'':'s'} & video${visual===1?'':'s'}`:'',voice?`${voice} voice ${voice===1?'memory':'memories'}`:''].filter(Boolean).join(' · ')||'Nothing yet';});
  /** Several files at once, uploaded strictly one after another so phones on slow connections are not swamped. */
  async upload(event:Event){
    const input=event.target as HTMLInputElement;const files=Array.from(input.files||[]);input.value='';if(!files.length||this.uploading())return;
    this.failed.set([]);this.api.error.set('');
    for(const [index,file] of files.entries()){this.uploading.set({done:index,total:files.length});try{await this.api.upload(file,'memory');}catch(error){this.failed.update(list=>[...list,`${file.name} (${(error as Error).message})`]);}}
    this.uploading.set(null);await this.api.reload('media').catch(()=>{});
  }
}
