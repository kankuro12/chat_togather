import {Component,ElementRef,ViewChild,inject,signal,computed,output,HostListener} from '@angular/core';
import {Api} from './api';
import {MediaView} from './media-view';
import {Decision} from './models';
@Component({selector:'choice-carousel',standalone:true,imports:[MediaView],template:`
<dialog #dialog class="modal choice-carousel" aria-labelledby="choice-title" (close)="decisionId.set('');draftImages.set([])">
@if(decision();as choice){<div class="modal-heading"><h2 id="choice-title">{{choice.title}}</h2><button type="button" class="text-button" aria-label="Close choice viewer" (click)="dialog.close()">Close</button></div>
<div class="carousel-stage" (touchstart)="touchStart($event)" (touchend)="touchEnd($event)">@if(current();as image){@if(choice.mode==='choose'){<button type="button" class="carousel-image-select" [class.chosen]="picked()===image.id" [attr.aria-label]="'Choose image '+(index()+1)" [attr.aria-pressed]="picked()===image.id" (click)="pickPhoto()"><media-view [id]="image.media_id" [label]="'Image '+(index()+1)"></media-view></button>}@else{<media-view [id]="image.media_id" [label]="'Image '+(index()+1)"></media-view>}}</div>
<div class="carousel-navigation"><button type="button" class="secondary" aria-label="Previous image" (click)="move(-1)" [disabled]="index()===0">‹</button><span>{{index()+1}} / {{choice.options.length}}</span><button type="button" class="secondary" aria-label="Next image" (click)="move(1)" [disabled]="index()===choice.options.length-1">›</button></div>
<div class="carousel-thumbnails">@for(image of choice.options;track image.id;let i=$index){<button type="button" [class.active]="index()===i" [class.chosen]="picked()===image.id" [attr.aria-label]="(choice.mode==='choose'?'Choose thumbnail ':'View image ')+(i+1)" (click)="selectThumbnail(i)"><media-view [id]="image.media_id" [label]="'Image '+(i+1)"></media-view>@if(picked()===image.id){<span class="carousel-picked" aria-hidden="true">✓</span>}</button>}</div>
@if(choice.mode==='choose'){<button type="button" class="secondary wide" [attr.aria-pressed]="picked()===current()?.id" (click)="pick()">{{picked()===current()?.id?'Selected':'Choose this image'}}</button>}
@else{<p>Rate image {{index()+1}}</p><div class="carousel-rating">@for(star of stars;track star){<button type="button" class="secondary" [attr.aria-label]="'Rate image '+(index()+1)+' '+star+' stars'" [class.selected]="picked()===current()?.id&&score()===star" (click)="pick(star)">{{star}} ★</button>}</div>}
@if(picked()){<p class="fineprint" role="status">Image {{pickedIndex()+1}} selected{{choice.mode==='rate'?' · '+score()+'/5':''}}</p>}
@if(api.error()){<p role="alert" class="form-error">{{api.error()}}</p>}
<div class="modal-actions"><button type="button" class="text-button" (click)="makePlan(choice.id)">Make a plan</button>@if(choosing()){<button type="button" class="primary" (click)="send()" [disabled]="api.busy()||!picked()">{{choice.mode==='rate'?'Send rating':'Send choice'}}</button>}</div>}@else if(draftImages().length){<div class="modal-heading"><h2 id="choice-title">Selected images</h2><button type="button" class="text-button" aria-label="Close choice viewer" (click)="dialog.close()">Close</button></div><div class="carousel-stage"><img [src]="draftImages()[index()]" [alt]="'Selected image '+(index()+1)"></div><div class="carousel-navigation"><button type="button" class="secondary" aria-label="Previous image" (click)="move(-1)" [disabled]="index()===0">‹</button><span>{{index()+1}} / {{draftImages().length}}</span><button type="button" class="secondary" aria-label="Next image" (click)="move(1)" [disabled]="index()===draftImages().length-1">›</button></div>}
</dialog>`})
export class ChoiceCarousel {
  private ignorePhotoClick=false;private swiping=false;private startX=0;private startY=0;
  touchStart(event:TouchEvent){this.ignorePhotoClick=false;this.swiping=event.touches.length===1;if(!this.swiping)return;this.startX=event.touches[0].clientX;this.startY=event.touches[0].clientY;}
  touchEnd(event:TouchEvent){if(!this.swiping)return;this.swiping=false;const touch=event.changedTouches[0],x=touch.clientX-this.startX,y=touch.clientY-this.startY;if(Math.abs(x)>40&&Math.abs(x)>Math.abs(y)){this.ignorePhotoClick=true;this.move(x<0?1:-1);}}
  @HostListener('document:keydown',['$event']) key(event:KeyboardEvent){if(!this.dialog.nativeElement.open)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.move(event.key==='ArrowRight'?1:-1);}}
  api=inject(Api);@ViewChild('dialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;
  plan=output<string>();choosing=signal(false);draftImages=signal<string[]>([]);
  openDraft(images:string[],index:number){this.decisionId.set('');this.draftImages.set(images);this.index.set(index);this.dialog.nativeElement.showModal();}
  decisionId=signal('');index=signal(0);picked=signal('');score=signal(0);stars=[1,2,3,4,5];
  decision=computed(()=>this.api.decisions().find(choice=>choice.id===this.decisionId()));current=computed(()=>this.decision()?.options[this.index()]);pickedIndex=computed(()=>this.decision()?.options.findIndex(image=>image.id===this.picked())??-1);
  open(choice:Decision,index=0,choose=false){this.choosing.set(choose);this.draftImages.set([]);this.decisionId.set(choice.id);this.index.set(index);this.picked.set('');this.score.set(0);this.api.error.set('');this.dialog.nativeElement.showModal();}
  move(delta:number){this.index.update(index=>Math.max(0,Math.min((this.decision()?.options.length||this.draftImages().length||1)-1,index+delta)));}
  pickPhoto(){if(this.ignorePhotoClick){this.ignorePhotoClick=false;return;}this.pick();}
  selectThumbnail(index:number){this.index.set(index);if(this.decision()?.mode==='choose')this.pick();}
  pick(score?:number){this.choosing.set(true);this.picked.set(this.current()?.id||'');this.score.set(score||0);}
  send(){void this.api.action(async()=>{const choice=this.decision();if(!choice||!this.picked())return;await this.api.mutate('/decisions/'+choice.id+'/vote',{option_id:this.picked(),...(choice.mode==='rate'?{rating:this.score()}:{})});await this.api.reload('messages');this.dialog.nativeElement.close();});}
  makePlan(id:string){this.dialog.nativeElement.close();this.plan.emit(id);}
}
