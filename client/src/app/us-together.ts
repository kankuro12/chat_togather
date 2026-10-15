import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { StatusReporter } from './status';
import { MediaView } from './media-view';
import { Moment, PartnerStatus } from './models';
import { localDay, dayNumber } from './us-dates';

/** Feeling close at a distance: partner's local time, battery and distance, a reunion countdown, a shared touch, and moments. */
@Component({selector:'us-together',standalone:true,imports:[FormsModule,IonIcon,MediaView],template:`
<section class="card us-card together-card" aria-labelledby="together-title">
  <div class="us-card-heading"><h2 id="together-title">{{partnerName()}} right now</h2></div>
  <div class="status-tiles">
    <div class="status-tile"><span class="tile-icon" aria-hidden="true">🕒</span><strong>{{partnerTime()||'—'}}</strong><small>{{partnerTime()?'their time':'not shared yet'}}</small></div>
    <div class="status-tile"><span class="tile-icon" aria-hidden="true">{{battery()!==null&&battery()!<20?'🪫':'🔋'}}</span><strong>{{battery()!==null?battery()+'%':'—'}}</strong><small>{{status()?.partner?.charging?'charging':'battery'}}</small></div>
    <div class="status-tile"><span class="tile-icon" aria-hidden="true">📍</span><strong>{{distance()}}</strong><small>apart</small></div>
    <div class="status-tile"><span class="tile-icon" aria-hidden="true">✈️</span><strong>{{reunionText()}}</strong><small>until we meet</small></div>
  </div>
  <div class="together-actions">
    <label class="checkbox-label"><input type="checkbox" [checked]="reporter.sharingDistance()" (change)="reporter.setSharing($any($event.target).checked)">Share how far apart we are</label>
    <label class="reunion-field">Next time we meet<input type="date" [value]="status()?.reunion||''" [min]="today" (change)="setReunion($any($event.target).value)"></label>
  </div>
  <p class="fineprint">Only the distance is shown, never where you are. Battery and local time update while the app is open.</p>
</section>

<section class="card us-card touch-card" aria-labelledby="touch-title">
  <div class="us-card-heading"><h2 id="touch-title">Touch</h2></div>
  <button type="button" class="touch-heart" [class.holding]="holding()" [class.together]="together()" aria-label="Hold to touch" (pointerdown)="hold($event)" (pointerup)="release()" (pointercancel)="release()" (pointerleave)="release()" (contextmenu)="$event.preventDefault()"><span aria-hidden="true">💗</span></button>
  <p class="touch-status" role="status">@if(together()){You are touching 💞}@else if(api.partnerTouching()){<span>{{partnerName()}} is holding the heart — hold it too</span>}@else if(holding()){Waiting for {{partnerName()}} to hold…}@else{Hold the heart. When you both hold it, your phones beat together.}</p>
</section>

<section class="card us-card moment-card" aria-labelledby="moment-title">
  <div class="us-card-heading"><h2 id="moment-title">Moments</h2><div class="moment-buttons"><button class="secondary" type="button" (click)="openDraw()"><ion-icon name="brush-outline"></ion-icon>Draw</button><label class="secondary moment-photo"><ion-icon name="camera-outline"></ion-icon>Photo<input type="file" accept="image/*" aria-label="Send a photo moment" (change)="sendPhoto($event)"></label></div></div>
  @if(moment()?.from_partner;as from){<figure class="moment-view"><media-view [id]="from.media_id" [label]="from.kind==='drawing'?'Drawing from '+from.sender_name:'Photo from '+from.sender_name" [expandable]="true"></media-view><figcaption>{{from.kind==='drawing'?'🎨':'📷'}} From {{from.sender_name}}@if(from.caption){ · {{from.caption}}}</figcaption></figure>}
  @else{<p class="fineprint">Send {{partnerName()}} a little drawing or photo. It shows up here and on their home-screen widget.</p>}
  @if(sending()){<p class="fineprint" role="status">Sending…</p>}
</section>

<dialog #drawDialog class="modal draw-dialog" aria-labelledby="draw-title">
  <div class="modal-heading"><h2 id="draw-title">Draw for {{partnerName()}}</h2><button type="button" class="icon-button" aria-label="Close drawing" (click)="drawDialog.close()"><ion-icon name="close-outline"></ion-icon></button></div>
  <canvas #canvas class="draw-canvas" width="720" height="720" aria-label="Drawing area" (pointerdown)="penDown($event)" (pointermove)="penMove($event)" (pointerup)="penUp()" (pointercancel)="penUp()"></canvas>
  <div class="draw-tools" role="group" aria-label="Pen colour">@for(colour of colours;track colour){<button type="button" class="swatch" [style.background]="colour" [class.active]="pen===colour" [attr.aria-label]="'Colour '+colour" (click)="pen=colour"></button>}<button type="button" class="text-button" (click)="clear()">Clear</button></div>
  <label>Caption (optional)<input [(ngModel)]="caption" maxlength="80" placeholder="Miss you"></label>
  <div class="modal-actions"><button class="primary" type="button" (click)="sendDrawing()" [disabled]="!drawn||sending()">Send</button></div>
</dialog>`})
export class UsTogether {
  api=inject(Api);reporter=inject(StatusReporter);today=localDay();
  status=signal<PartnerStatus|null>(null);moment=signal<{from_partner:Moment|null;mine:Moment|null}|null>(null);now=signal(Date.now());sending=signal(false);
  partnerName=computed(()=>this.api.partner()?.name||'Your partner');
  constructor(){
    effect(()=>{this.api.usVersion();if(this.api.pair())untracked(()=>void this.load());});
    const tick=setInterval(()=>this.now.set(Date.now()),30000),poll=setInterval(()=>void this.load(),5*60000);
    inject(DestroyRef).onDestroy(()=>{clearInterval(tick);clearInterval(poll);this.release();this.stopBeat();});
    // Both holding at the same time: phones beat together.
    effect(()=>{if(this.together())untracked(()=>this.startBeat());else untracked(()=>this.stopBeat());});
  }
  async load(){try{const [status,moment]=await Promise.all([this.api.request<PartnerStatus>('/us/status'),this.api.request<{from_partner:Moment|null;mine:Moment|null}>('/us/moment')]);this.status.set(status);this.moment.set(moment);}catch{/* shown elsewhere */}}
  partnerTime=computed(()=>{this.now();const zone=this.status()?.partner?.timezone;if(!zone)return '';try{return new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date());}catch{return '';}});
  battery=computed(()=>{const value=this.status()?.partner?.battery;return typeof value==='number'?value:null;});
  distance=computed(()=>{const km=this.status()?.distance_km;return km===null||km===undefined?'—':km===0?'Together':`${km.toLocaleString()} km`;});
  reunionText=computed(()=>{const day=this.status()?.reunion;if(!day)return '—';const days=dayNumber(day)-dayNumber(localDay());return days<0?'—':days===0?'Today!':days===1?'1 day':`${days} days`;});
  async setReunion(day:string){try{await this.reporter.setReunion(day||null);await this.load();}catch(error){this.api.error.set((error as Error).message);}}
  // Touch
  holding=signal(false);together=computed(()=>this.holding()&&this.api.partnerTouching());private beat?:ReturnType<typeof setInterval>;
  hold(event:PointerEvent){(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);this.holding.set(true);this.api.sendTouch(true);navigator.vibrate?.(30);}
  release(){if(!this.holding())return;this.holding.set(false);this.api.sendTouch(false);}
  private startBeat(){this.stopBeat();const pulse=()=>navigator.vibrate?.([90,110,90]);pulse();this.beat=setInterval(pulse,900);}
  private stopBeat(){clearInterval(this.beat);this.beat=undefined;navigator.vibrate?.(0);}
  // Moments
  @ViewChild('drawDialog') drawDialog!:ElementRef<HTMLDialogElement>;@ViewChild('canvas') canvas!:ElementRef<HTMLCanvasElement>;
  colours=['#df0048','#2a0f24','#e8a33d','#2f9e6e','#3b6fd8','#ffffff'];pen='#df0048';caption='';drawn=false;private last:{x:number;y:number}|null=null;
  openDraw(){this.caption='';this.drawDialog.nativeElement.showModal();setTimeout(()=>this.clear(),0);}
  clear(){const canvas=this.canvas.nativeElement,ctx=canvas.getContext('2d')!;ctx.fillStyle='#fffaf5';ctx.fillRect(0,0,canvas.width,canvas.height);this.drawn=false;}
  private point(event:PointerEvent){const rect=this.canvas.nativeElement.getBoundingClientRect();return {x:(event.clientX-rect.left)*720/rect.width,y:(event.clientY-rect.top)*720/rect.height};}
  penDown(event:PointerEvent){this.canvas.nativeElement.setPointerCapture(event.pointerId);this.last=this.point(event);this.penMove(event);}
  penMove(event:PointerEvent){if(!this.last)return;const ctx=this.canvas.nativeElement.getContext('2d')!,next=this.point(event);ctx.strokeStyle=this.pen;ctx.lineWidth=this.pen==='#ffffff'?28:10;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(this.last.x,this.last.y);ctx.lineTo(next.x+0.01,next.y);ctx.stroke();this.last=next;this.drawn=true;}
  penUp(){this.last=null;}
  async sendDrawing(){const blob=await new Promise<Blob|null>(resolve=>this.canvas.nativeElement.toBlob(resolve,'image/png'));if(!blob)return;await this.send(new File([blob],'drawing.png',{type:'image/png'}),'drawing',this.caption);this.drawDialog.nativeElement.close();}
  async sendPhoto(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];input.value='';if(file)await this.send(file,'photo','');}
  /** Moments are private to the two of you: uploaded like chat media so they never appear in Memories. */
  private async send(file:File,kind:'drawing'|'photo',caption:string){
    this.sending.set(true);try{const media=await this.api.upload(file,'chat');await this.api.request('/us/moment',{media_id:media.id,kind,caption});await this.load();}
    catch(error){this.api.error.set((error as Error).message);}finally{this.sending.set(false);}
  }
}
