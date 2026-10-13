import {Component,ElementRef,ViewChild,output,signal} from '@angular/core';
import {IonIcon} from '@ionic/angular/standalone';
import {canSwitchCamera,otherFacing,type Facing} from './camera';
@Component({selector:'message-recorder',standalone:true,imports:[IonIcon],template:`
<dialog #dialog class="modal recorder-dialog" aria-labelledby="record-title" (cancel)="reset()" (close)="reset()"><div class="modal-heading"><h2 id="record-title">{{kind()==='audio'?'Voice message':'Video message'}}</h2><button class="icon-button" type="button" aria-label="Close recorder" (click)="close()"><ion-icon name="close-outline"></ion-icon></button></div>
<video #preview [hidden]="kind()!=='video'||!stream()" autoplay playsinline muted [srcObject]="stream()" aria-label="Recording preview"></video>
@if(url()){@if(kind()==='audio'){<audio [src]="url()" controls aria-label="Voice message preview"></audio>}@else{<video [src]="url()" controls playsinline aria-label="Video message preview"></video>}}
<p role="status">{{recording()?'Recording · '+seconds()+'s':'Up to 60 seconds. Preview before sending.'}}</p>@if(error()){<p role="alert" class="form-error">{{error()}}</p>}
<div class="modal-actions">@if(recording()){<button class="primary" type="button" (click)="stop()">Stop recording</button>}@else if(file){<button class="secondary" type="button" (click)="reset()">Discard</button><button class="primary" type="button" (click)="use()">Use recording</button>}@else{@if(kind()==='video'&&canSwitch()){<button class="secondary" type="button" [attr.aria-label]="facing()==='user'?'Use back camera':'Use front camera'" (click)="facing.set(otherFacing(facing()))" [disabled]="starting()"><ion-icon name="camera-reverse-outline"></ion-icon>{{facing()==='user'?'Front camera':'Back camera'}}</button>}<button class="primary" type="button" (click)="start()" [disabled]="starting()">{{starting()?'Opening…':'Record'}}</button>}</div></dialog>`})
export class MessageRecorder {
  @ViewChild('dialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;
  /** Which camera a video message uses; chosen before recording because switching mid-recording would end it. */
  facing=signal<Facing>('user');canSwitch=signal(false);otherFacing=otherFacing;
  recorded=output<File>();kind=signal<'audio'|'video'>('audio');recording=signal(false);starting=signal(false);seconds=signal(0);url=signal('');stream=signal<MediaStream|null>(null);error=signal('');file:File|null=null;
  private recorder?:MediaRecorder;private chunks:Blob[]=[];private timer?:ReturnType<typeof setInterval>;private bytes=0;private generation=0;
  open(kind:'audio'|'video'){this.reset();this.kind.set(kind);this.dialog.nativeElement.showModal();if(kind==='video')void canSwitchCamera().then(can=>this.canSwitch.set(can));}
  async start(){const generation=++this.generation;this.starting.set(true);this.error.set('');try{
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Recording unavailable. Attach an existing audio or video file.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:this.kind()==='video'?{facingMode:this.facing(),width:{ideal:640},height:{ideal:480}}:false});
    if(generation!==this.generation||!this.dialog.nativeElement.open){stream.getTracks().forEach(track=>track.stop());return;}this.stream.set(stream);
    const types=this.kind()==='audio'?['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus']:['video/webm;codecs=vp8,opus','video/mp4','video/webm'];const mimeType=types.find(type=>MediaRecorder.isTypeSupported(type));if(!mimeType)throw new Error('Recording unavailable. Attach an existing file.');
    this.recorder=new MediaRecorder(stream,{mimeType,...(this.kind()==='video'?{videoBitsPerSecond:1000000}:{audioBitsPerSecond:64000})});const recorder=this.recorder;this.chunks=[];this.bytes=0;this.seconds.set(0);
    recorder.ondataavailable=event=>{if(generation!==this.generation)return;this.chunks.push(event.data);this.bytes+=event.data.size;if(this.bytes>14*1024*1024)this.stop();};
    recorder.onstop=()=>{stream.getTracks().forEach(track=>track.stop());if(generation!==this.generation)return;this.stream.set(null);this.recording.set(false);clearInterval(this.timer);if(this.bytes>15*1024*1024){this.error.set('Recording too large. Please record a shorter message.');return;}const type=mimeType.split(';')[0],blob=new Blob(this.chunks,{type});if(!blob.size){this.error.set('No recording captured. Try again.');return;}this.file=new File([blob],`message-${Date.now()}.${type.includes('mp4')?'mp4':type.includes('ogg')?'ogg':'webm'}`,{type});this.url.set(URL.createObjectURL(blob));};
    recorder.onerror=()=>{this.reset();this.error.set('Recording failed. Please try again.');};recorder.start(500);this.recording.set(true);this.timer=setInterval(()=>{this.seconds.update(value=>value+1);if(this.seconds()>=60)this.stop();},1000);
  }catch(e){if(generation!==this.generation)return;this.stream()?.getTracks().forEach(track=>track.stop());this.stream.set(null);this.error.set((e as any).name==='NotAllowedError'?'Allow microphone or camera access to record.':(e as Error).message||'Could not start recording.');}finally{if(generation===this.generation)this.starting.set(false);}}
  stop(){clearInterval(this.timer);if(this.recorder?.state==='recording')this.recorder.stop();}
  use(){if(!this.file)return;const file=this.file;this.close();this.recorded.emit(file);}
  close(){this.reset();this.dialog.nativeElement.close();}
  reset(){this.generation++;clearInterval(this.timer);if(this.recorder?.state==='recording')this.recorder.stop();this.recorder=undefined;this.stream()?.getTracks().forEach(track=>track.stop());this.stream.set(null);if(this.url())URL.revokeObjectURL(this.url());this.url.set('');this.file=null;this.recording.set(false);this.starting.set(false);this.seconds.set(0);this.error.set('');}
  ngOnDestroy(){this.reset();}
}
