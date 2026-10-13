import { Component, input, inject, effect, signal, computed, untracked, afterNextRender, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import {IonIcon} from '@ionic/angular/standalone';
import { Api } from './api';
/** Shows the sender-made thumbnail and length first; the real file is downloaded only when opened or played (or when `full` is set). */
@Component({selector:'media-view',standalone:true,imports:[IonIcon],template:`@if(audio()) {
  @if(url()){<audio [src]="url()" controls autoplay [attr.aria-label]="label()" (error)="failed.set(true)"></audio>}
  @else{<button type="button" class="media-audio" [disabled]="loading()" [attr.aria-label]="'Play '+label()+(duration()?', '+time(duration()):'')" (click)="play()"><ion-icon [name]="loading()?'hourglass-outline':'play-outline'"></ion-icon><span class="media-wave" aria-hidden="true"></span><span class="media-duration">{{time(duration())}}</span></button>}
} @else if(video()) {
  @if(url()){<video [src]="url()" controls autoplay playsinline [attr.poster]="preview()||null" [attr.aria-label]="label()" [style.aspect-ratio]="ratio()" (error)="failed.set(true)"></video>}
  @else if(compact()){<div class="media-poster" [class.no-preview]="!preview()" [style.aspect-ratio]="ratio()">@if(preview()){<img [src]="preview()" [alt]="label()">}<span class="video-play-hint" aria-hidden="true"><ion-icon name="play-outline"></ion-icon></span>@if(duration()){<span class="media-duration">{{time(duration())}}</span>}</div>}
  @else{<button type="button" class="media-poster" [class.no-preview]="!preview()" [disabled]="loading()" [attr.aria-label]="'Play '+label()+(duration()?', '+time(duration()):'')" [style.aspect-ratio]="ratio()" (click)="play()">@if(preview()){<img [src]="preview()" alt="">}<span class="video-play-hint" aria-hidden="true"><ion-icon [name]="loading()?'hourglass-outline':'play-outline'"></ion-icon></span>@if(duration()){<span class="media-duration">{{time(duration())}}</span>}</button>}
} @else if(shown()) {
  @if(expandable()){<button type="button" class="media-expand" aria-label="Open shared photo" (click)="openViewer()"><img [src]="shown()" [alt]="label()" loading="lazy" [style.aspect-ratio]="ratio()"></button>}@else{<img [src]="shown()" [alt]="label()" loading="lazy" [style.aspect-ratio]="ratio()">}
} @else {<div class="media-placeholder" [style.aspect-ratio]="ratio()">{{failed()?'Media unavailable':'Loading media…'}}</div>}
@if(failed()&&(url()||audio()||video())){<p class="fineprint" role="status">Cannot play this file on this device.</p>}
@if(expandable()&&!video()&&!audio()){<dialog #viewer class="modal media-viewer"><button type="button" class="icon-button" aria-label="Close shared photo" (click)="viewer.close()"><ion-icon name="close-outline"></ion-icon></button>@if(viewer.open&&(url()||preview())){<img [src]="url()||preview()" [alt]="label()">}</dialog>}`,styles:[`:host{display:block;position:relative;overflow:hidden;border-radius:inherit;min-width:0}audio{display:block;width:100%;max-width:100%;min-width:0}img,video{display:block;width:100%;max-height:420px;object-fit:contain}video{background:oklch(14% 0.01 325)}.media-expand{border:0;padding:0;width:100%;background:transparent;cursor:zoom-in}.media-viewer img{max-height:75dvh}.media-poster{position:relative;display:block;width:100%;min-height:140px;max-height:420px;border:0;padding:0;background:oklch(14% 0.01 325);cursor:pointer;overflow:hidden}.media-poster.no-preview{aspect-ratio:16/9;background:linear-gradient(135deg,color-mix(in oklch,var(--color-accent) 50%,oklch(14% 0.01 325)),oklch(14% 0.01 325))}.media-poster img{width:100%;height:100%;max-height:420px;object-fit:cover}.video-play-hint{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;color:#fff}.video-play-hint ion-icon{padding:12px;border-radius:50%;background:oklch(14% 0.01 325 / .72);font-size:24px}.media-duration{position:absolute;right:8px;bottom:8px;padding:2px 6px;border-radius:999px;background:oklch(14% 0.01 325 / .72);color:#fff;font-size:12px;font-variant-numeric:tabular-nums}.media-audio{display:flex;align-items:center;gap:10px;width:100%;min-width:180px;padding:8px 12px;border:0;border-radius:999px;background:var(--color-paper-2);color:inherit;cursor:pointer}.media-audio ion-icon{flex:none;font-size:20px}.media-audio .media-wave{flex:1;height:2px;background:var(--color-muted);opacity:.5}.media-audio .media-duration{position:static;background:none;color:var(--color-muted);padding:0}.media-placeholder{background:var(--color-paper-2);min-height:100px;display:grid;place-items:center;color:var(--color-muted);font-size:12px}`]})
export class MediaView implements OnDestroy {
  @ViewChild('viewer') viewer?:ElementRef<HTMLDialogElement>;
  id=input.required<string>();label=input('Shared memory');video=input(false);audio=input(false);compact=input(false);expandable=input(false);
  /** Load the real file straight away, e.g. in a viewer the person already opened. */
  full=input(false);
  /** Whether a thumbnail exists; leave unset to try one and fall back to the original image. */
  thumb=input<number|boolean|null|undefined>(undefined);duration=input<number|null|undefined>(null);width=input<number|null|undefined>(null);height=input<number|null|undefined>(null);
  preview=signal('');url=signal('');loading=signal(false);failed=signal(false);
  shown=computed(()=>this.url()||this.preview());ratio=computed(()=>this.width()&&this.height()?`${this.width()} / ${this.height()}`:null);
  private api=inject(Api);private generation=0;private host:ElementRef<HTMLElement>=inject(ElementRef);private observer?:IntersectionObserver;
  /** Nothing is fetched until the item scrolls near the screen, so long chats do not download every thumbnail at once. */
  private visible=signal(typeof IntersectionObserver==='undefined');
  constructor(){
    afterNextRender(()=>{if(this.visible())return;const root=this.host.nativeElement.closest<HTMLElement>('.conversation');this.observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){this.visible.set(true);this.observer?.disconnect();}},{root,rootMargin:'600px 0px'});this.observer.observe(this.host.nativeElement);});
    effect(()=>{
    if(!this.visible())return;
    const resource=this.id(),visual=!this.audio(),image=visual&&!this.video(),thumb=this.thumb(),full=this.full();
    untracked(()=>this.show(resource,visual,image,thumb,full));
  });}
  private show(resource:string,visual:boolean,image:boolean,thumb:number|boolean|null|undefined,full:boolean){
    this.release();this.preview.set('');this.failed.set(false);this.loading.set(false);const generation=++this.generation;
    if(full){void this.load();return;}
    if(!visual||thumb===false||thumb===0||thumb===null){if(image)void this.load();return;}
    void this.api.thumbUrl(resource).then(url=>{if(generation===this.generation)this.preview.set(url);}).catch(()=>{if(generation===this.generation&&image)void this.load();});
  }
  openViewer(){this.viewer?.nativeElement.showModal();void this.load();}
  play(){void this.load();}
  async load(){
    if(this.url()||this.loading())return;const generation=this.generation;this.loading.set(true);
    try{const url=await this.api.mediaUrl(this.id());if(generation===this.generation)this.url.set(url);else URL.revokeObjectURL(url);}
    catch{if(generation===this.generation)this.failed.set(true);}
    finally{if(generation===this.generation)this.loading.set(false);}
  }
  time(seconds:number|null|undefined){if(!seconds)return '–:––';const total=Math.round(seconds);const h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=String(total%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`;}
  private release(){if(this.url())URL.revokeObjectURL(this.url());this.url.set('');}
  ngOnDestroy(){this.observer?.disconnect();this.generation++;this.release();}
}
