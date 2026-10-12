import { CalendarDate } from './calendar';
import { Component, inject, computed, signal, ViewChild, ElementRef } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { MediaView } from './media-view';
@Component({selector:'memories-page',standalone:true,imports:[IonIcon,MediaView,CalendarDate],template:`
<div class="page-heading"><div><h1>Memories</h1><p>{{visualMedia().length}} photos & videos</p></div><label class="primary upload-button"><ion-icon name="add-outline"></ion-icon>Add memory<input type="file" aria-label="Add a memory" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" (change)="upload($event)" [disabled]="api.busy()"></label></div>

@if(!visualMedia().length){<div class="empty"><ion-icon name="images-outline"></ion-icon><h3>No memories yet</h3><p>Add a photo or video to share with your partner.</p></div>}
<div class="memories-grid">@for(media of visualMedia();track media.id){<article class="card memory-card"><media-view [id]="media.id" [video]="media.mime.startsWith('video/')" [compact]="true" label="A memory together"></media-view><button class="memory-open" [attr.aria-label]="'Open memory from '+(media.created_at|calendarDate:'MMM d')" (click)="open(media.id)"></button><footer><span>{{name(media.user_id)}}</span><small>{{media.created_at|calendarDate:'MMM d, y'}}</small></footer></article>}</div><dialog #viewer class="modal media-viewer" (close)="selectedId.set('')"><button class="text-button" type="button" (click)="viewer.close()">Close memory</button>@if(selected();as media){<media-view [id]="media.id" [video]="media.mime.startsWith('video/')" label="Full memory"></media-view>}</dialog>`})
export class MemoriesPage {
  @ViewChild('viewer') viewer!:ElementRef<HTMLDialogElement>;api=inject(Api);selectedId=signal('');selected=computed(()=>this.api.media().find(media=>media.id===this.selectedId()));visualMedia=computed(()=>this.api.media().filter(media=>!media.mime.startsWith('audio/')));open(id:string){this.selectedId.set(id);this.viewer.nativeElement.showModal();}
  name(id:string){return this.api.pair()?.members.find(m=>m.id===id)?.name||'Us';}
  upload(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;void this.api.action(async()=>{await this.api.upload(file);await this.api.reload();input.value='';});}
}
