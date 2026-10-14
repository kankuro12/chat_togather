import {Component,ElementRef,HostListener,OnDestroy,ViewChild,computed,effect,inject,signal,untracked} from '@angular/core';
import {IonIcon} from '@ionic/angular/standalone';
import {Communication} from './communication';
type Corner='tl'|'tr'|'bl'|'br';
/** Messenger-style call UI: full screen while you focus on the call, a small draggable corner window when you go back,
 *  and a system picture-in-picture window (where the browser supports it) when you leave the app. */
@Component({selector:'call-panel',standalone:true,imports:[IonIcon],template:`@if(call.status()!=='idle'){
<audio class="call-audio" [srcObject]="call.remote()" autoplay></audio>
@if(!call.minimized()){
<section class="call-screen" [class.video-call]="isVideo()" [class.connected]="hasVideo()" role="dialog" aria-modal="true" aria-label="Partner call">
  @if(isVideo()){<video #remoteVideo class="remote-video" [srcObject]="call.remote()" [hidden]="!hasVideo()" autoplay playsinline muted aria-label="Partner video"></video>}
  <header class="call-top">
    @if(call.status()!=='incoming'){<button class="call-round glass small" type="button" aria-label="Minimize call" title="Minimize" (click)="minimize()"><ion-icon name="chevron-down-outline"></ion-icon></button>}@else{<span></span>}
    @if(hasVideo()){<div class="call-top-title"><strong>{{call.name()}}</strong><span><span role="status">{{statusText()}}</span>@if(timer()){ · {{timer()}}}</span></div>}
    @if(hasVideo()&&pipSupported){<button class="call-round glass small" type="button" aria-label="Picture in picture" title="Picture in picture" (click)="popOut()"><ion-icon name="albums-outline"></ion-icon></button>}@else{<span></span>}
  </header>
  @if(!hasVideo()){<div class="call-identity"><span class="call-avatar" [class.ringing]="call.status()==='incoming'||call.status()==='ringing'">{{initial()}}</span><h2>{{call.name()}}</h2><p><span role="status">{{statusText()}}</span>@if(timer()){<span class="call-timer"> · {{timer()}}</span>}</p></div>}
  @if(isVideo()&&call.local()){<video class="self-video" [class.mirrored]="call.facing()==='user'" [class.off]="call.cameraOff()" [srcObject]="call.local()" autoplay playsinline muted aria-label="Your video"></video>}
  <div class="call-controls">
    @if(call.status()==='incoming'){
      <div class="call-control"><button class="call-round decline" type="button" aria-label="Decline" title="Decline" (click)="call.end()"><ion-icon name="call-outline"></ion-icon></button><span aria-hidden="true">Decline</span></div>
      <div class="call-control"><button class="call-round answer" type="button" [attr.aria-label]="call.preparing()?'Connecting…':'Answer'" title="Answer" (click)="call.accept()" [disabled]="call.preparing()"><ion-icon [name]="call.preparing()?'hourglass-outline':isVideo()?'videocam':'call'"></ion-icon></button><span aria-hidden="true">{{call.preparing()?'Connecting…':'Answer'}}</span></div>
    }@else{
      <div class="call-control"><button class="call-round glass" type="button" [class.on]="call.muted()" [attr.aria-label]="call.muted()?'Unmute':'Mute'" [title]="call.muted()?'Unmute':'Mute'" [attr.aria-pressed]="call.muted()" (click)="call.mute()"><ion-icon [name]="call.muted()?'mic-off':'mic'"></ion-icon></button><span aria-hidden="true">{{call.muted()?'Unmute':'Mute'}}</span></div>
      @if(isVideo()){<div class="call-control"><button class="call-round glass" type="button" [class.on]="call.cameraOff()" [attr.aria-label]="call.cameraOff()?'Camera on':'Camera off'" [title]="call.cameraOff()?'Camera on':'Camera off'" [attr.aria-pressed]="call.cameraOff()" (click)="call.toggleCamera()"><ion-icon [name]="call.cameraOff()?'videocam-off':'videocam'"></ion-icon></button><span aria-hidden="true">Camera</span></div>
        @if(call.canSwitch()){<div class="call-control"><button class="call-round glass" type="button" aria-label="Switch camera" title="Switch camera" (click)="call.switchCamera()" [disabled]="call.switching()||call.cameraOff()"><ion-icon name="camera-reverse"></ion-icon></button><span aria-hidden="true">Flip</span></div>}}
      <div class="call-control"><button class="call-round decline" type="button" aria-label="End call" title="End call" (click)="call.end()"><ion-icon name="call-outline"></ion-icon></button><span aria-hidden="true">End</span></div>
    }
  </div>
</section>}
@else{
<div class="call-mini" [class.video-call]="isVideo()" [attr.data-corner]="corner()" [style.transform]="drag()?'translate('+drag()!.x+'px,'+drag()!.y+'px)':null" role="dialog" aria-label="Call in progress" (pointerdown)="dragStart($event)" (pointermove)="dragMove($event)" (pointerup)="dragEnd($event)" (pointercancel)="drag.set(null)">
  @if(hasVideo()){<video #miniVideo [srcObject]="call.remote()" autoplay playsinline muted aria-hidden="true"></video>}@else{<span class="call-avatar small">{{initial()}}</span>}
  <div class="call-mini-text"><strong>{{call.name()}}</strong><span>{{timer()||statusText()}}</span></div>
  <button class="call-round decline tiny" type="button" aria-label="End call" title="End call" (pointerdown)="$event.stopPropagation()" (click)="call.end()"><ion-icon name="call-outline"></ion-icon></button>
  <button class="call-mini-open" type="button" aria-label="Return to call" (click)="expand()"></button>
</div>}
}`})
export class CallPanel implements OnDestroy {
  call=inject(Communication);private pushed=false;
  @ViewChild('remoteVideo') remoteVideo?:ElementRef<HTMLVideoElement>;@ViewChild('miniVideo') miniVideo?:ElementRef<HTMLVideoElement>;
  isVideo=computed(()=>this.call.kind()==='video');
  hasVideo=computed(()=>this.isVideo()&&!!this.call.remote()&&this.call.status()==='active');
  initial=computed(()=>(this.call.name()||'?').charAt(0).toUpperCase());
  statusText=computed(()=>{const status=this.call.status();return status==='incoming'?`Incoming ${this.call.kind()} call`:status==='ringing'?'Calling…':status==='connecting'?'Connecting…':this.isVideo()?'Video call':'Audio call';});
  private now=signal(Date.now());private tick=setInterval(()=>this.now.set(Date.now()),1000);
  timer=computed(()=>{const start=this.call.startedAt();if(!start)return '';const total=Math.max(0,Math.floor((this.now()-start)/1000));const h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=String(total%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${s}`:`${m}:${s}`;});
  pipSupported=typeof document!=='undefined'&&'pictureInPictureEnabled' in document&&document.pictureInPictureEnabled;
  constructor(){
    // While the call screen is open, the phone's back gesture shrinks it to the corner instead of leaving the page.
    effect(()=>{const open=this.call.status()!=='idle'&&!this.call.minimized();untracked(()=>{if(open&&!history.state?.callScreen){history.pushState({...history.state,callScreen:true},'');this.pushed=true;}
      // The call ended while its screen was showing: drop the extra history entry so Back works normally again.
      if(this.call.status()==='idle'&&this.pushed){this.pushed=false;if(history.state?.callScreen)history.back();}});});
    // Chrome can pop a video call out automatically when the person switches away from the app.
    try{navigator.mediaSession?.setActionHandler('enterpictureinpicture' as MediaSessionAction,()=>void this.popOut());}catch{/* not supported here */}
  }
  /** The Android app is showing the call in a system picture-in-picture window: show only the partner. */
  @HostListener('window:native-pip',['$event']) nativePip(event:Event){const on=!!(event as CustomEvent<boolean>).detail;document.documentElement.classList.toggle('pip-mode',on);if(on)this.call.minimized.set(false);}
  @HostListener('window:popstate') back(){if(this.call.status()!=='idle'&&!this.call.minimized()&&this.call.status()!=='incoming')this.call.minimized.set(true);}
  /** Leaving the tab during a video call: try a system picture-in-picture window (works where the browser allows it). */
  @HostListener('document:visibilitychange') hidden(){if(document.visibilityState==='hidden'&&this.hasVideo()&&!document.pictureInPictureElement)void this.popOut();}
  minimize(){if(history.state?.callScreen){this.pushed=false;history.back();}else this.call.minimized.set(true);}
  expand(){this.call.minimized.set(false);}
  async popOut(){const video=this.remoteVideo?.nativeElement||this.miniVideo?.nativeElement;if(!video||!this.pipSupported||document.pictureInPictureElement)return;try{await video.requestPictureInPicture();}catch{/* needs a user gesture in some browsers */}}
  // Corner window: drag it anywhere, it snaps to the nearest corner; a tap opens the call again.
  corner=signal<Corner>('br');drag=signal<{x:number;y:number}|null>(null);private start?:{x:number;y:number;moved:boolean};
  dragStart(event:PointerEvent){this.start={x:event.clientX,y:event.clientY,moved:false};(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);}
  dragMove(event:PointerEvent){const start=this.start;if(!start)return;const x=event.clientX-start.x,y=event.clientY-start.y;if(Math.abs(x)+Math.abs(y)>6)start.moved=true;if(start.moved)this.drag.set({x,y});}
  dragEnd(event:PointerEvent){const start=this.start;this.start=undefined;this.drag.set(null);if(!start)return;
    if(!start.moved){if(!(event.target as HTMLElement).closest('.decline'))this.expand();return;}
    this.corner.set(((event.clientY<innerHeight/2?'t':'b')+(event.clientX<innerWidth/2?'l':'r')) as Corner);}
  ngOnDestroy(){clearInterval(this.tick);}
}
