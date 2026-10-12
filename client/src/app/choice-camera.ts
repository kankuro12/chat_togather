import {Component,ElementRef,ViewChild,signal,output} from '@angular/core';
import {IonIcon} from '@ionic/angular/standalone';
@Component({selector:'choice-camera',standalone:true,imports:[IonIcon],template:`
<dialog #dialog class="modal choice-camera" aria-labelledby="camera-title" (cancel)="stop()" (close)="stop()">
<div class="modal-heading"><h2 id="camera-title">Take a photo</h2><button class="icon-button" type="button" aria-label="Close camera" (click)="close()"><ion-icon name="close-outline"></ion-icon></button></div>
@if(photo()){<img [src]="photo()" alt="Captured choice photo">}@else{<video #video autoplay playsinline muted [srcObject]="stream()" aria-label="Live camera preview"></video>}
@if(error()){<p role="alert" class="form-error">{{error()}}</p>}@if(opening()){<p role="status">Opening camera…</p>}
<div class="modal-actions">@if(photo()){<button class="secondary" type="button" (click)="retake()">Retake</button><button class="primary" type="button" (click)="use()">Use photo</button>}@else{<button class="secondary" type="button" aria-label="Switch camera" (click)="switchCamera()" [disabled]="opening()"><ion-icon name="camera-reverse-outline"></ion-icon></button><button class="primary" type="button" aria-label="Capture photo" (click)="capture()" [disabled]="opening()||!stream()"><ion-icon name="camera-outline"></ion-icon>Capture</button>}</div>
<label class="text-button camera-fallback">Use device camera<input type="file" accept="image/*" capture="environment" aria-label="Use device camera" (change)="fallback($event)"></label>
</dialog>`})
export class ChoiceCamera{
  @ViewChild('dialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;@ViewChild('video') video?:ElementRef<HTMLVideoElement>;
  captured=output<File>();stream=signal<MediaStream|null>(null);photo=signal('');opening=signal(false);error=signal('');private generation=0;private facing:'user'|'environment'='environment';private file?:File;
  open(){this.stop();this.dialog.nativeElement.showModal();void this.start();}
  async start(){const generation=++this.generation;this.opening.set(true);this.error.set('');try{
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Use device camera below to take a photo.');
    const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:this.facing},width:{ideal:1600},height:{ideal:1200}}});
    if(generation!==this.generation||!this.dialog.nativeElement.open){stream.getTracks().forEach(track=>track.stop());return;}this.stream.set(stream);
  }catch(e){if(generation===this.generation)this.error.set((e as Error).name==='NotAllowedError'?'Allow camera access, or use device camera below.':'Camera unavailable. Use device camera below.');}finally{if(generation===this.generation)this.opening.set(false);}}
  capture(){const video=this.video?.nativeElement;if(!video?.videoWidth)return;const canvas=document.createElement('canvas');const scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d')?.drawImage(video,0,0,canvas.width,canvas.height);const generation=this.generation;canvas.toBlob(blob=>{if(generation!==this.generation||!this.dialog.nativeElement.open)return;if(!blob){this.error.set('Could not capture photo. Try again.');return;}this.preview(new File([blob],'choice-camera-'+Date.now()+'.webp',{type:'image/webp'}));},'image/webp',0.8);}
  preview(file:File){this.stopStream();this.error.set('');if(this.photo())URL.revokeObjectURL(this.photo());this.file=file;this.photo.set(URL.createObjectURL(file));}
  fallback(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];if(file){if(!file.type.startsWith('image/')||file.size>40*1024*1024)this.error.set('Choose a photo smaller than 40 MB.');else this.preview(file);}input.value='';}
  retake(){if(this.photo())URL.revokeObjectURL(this.photo());this.photo.set('');this.file=undefined;void this.start();}
  switchCamera(){this.stopStream();this.facing=this.facing==='environment'?'user':'environment';void this.start();}
  use(){if(!this.file)return;const file=this.file;this.close();this.captured.emit(file);}
  stopStream(){this.generation++;this.stream()?.getTracks().forEach(track=>track.stop());this.stream.set(null);this.opening.set(false);}
  stop(){this.stopStream();if(this.photo())URL.revokeObjectURL(this.photo());this.photo.set('');this.file=undefined;this.error.set('');}
  close(){this.stop();this.dialog.nativeElement.close();}
  ngOnDestroy(){this.stop();}
}
