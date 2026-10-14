import {IonIcon} from '@ionic/angular/standalone';
import { Component, ElementRef, ViewChild, output, signal } from '@angular/core';
import {canSwitchCamera,otherFacing,type Facing} from './camera';
type QRReader=typeof import('jsqr').default;

@Component({selector:'qr-scanner',standalone:true,imports:[IonIcon],template:`
<dialog #dialog class="qr-dialog" aria-labelledby="qr-title" (cancel)="stop()" (close)="stop()">
  <div class="qr-heading"><h2 id="qr-title">Scan invitation</h2><button type="button" class="icon-button" (click)="close()" aria-label="Close QR scanner" title="Close"><ion-icon name="close-outline"></ion-icon></button></div>
  <video #video autoplay playsinline muted [hidden]="!camera()" aria-label="QR camera preview"></video>
  <p>Scan your partner's QR or choose its image.</p>
  @if(error()){<p role="alert">{{error()}}</p>}
  <button type="button" class="primary wide" (click)="start()" [disabled]="starting()||camera()">{{starting()?'Opening camera…':'Use camera'}}</button>@if(camera()&&canSwitch()){<button type="button" class="secondary wide" (click)="switchCamera()" [disabled]="starting()">Switch camera</button>}
  <label class="secondary qr-upload">Upload QR image<input type="file" accept="image/*" (change)="upload($event)"></label>
</dialog>`})
export class QrScanner {
  @ViewChild('dialog',{static:true}) dialog!:ElementRef<HTMLDialogElement>;
  @ViewChild('video',{static:true}) video!:ElementRef<HTMLVideoElement>;
  /** Starts on the back camera; the front one helps when scanning a code shown on another screen held up to a laptop. */
  private facing:Facing='environment';canSwitch=signal(false);
  switchCamera(){this.facing=otherFacing(this.facing);this.stop();void this.start();}
  scanned=output<string>();error=signal('');camera=signal(false);starting=signal(false);
  private stream?:MediaStream;private frame=0;private generation=0;
  private canvas=document.createElement('canvas');
  // The decoder is large and only needed while pairing, so it loads on first scan.
  private reader?:QRReader;private loading?:Promise<QRReader>;
  private loadReader(){return this.loading??=import('jsqr').then(module=>this.reader=module.default);}
  open(){void this.loadReader().catch(()=>this.loading=undefined);this.error.set('');this.dialog.nativeElement.showModal();}
  close(){this.stop();this.dialog.nativeElement.close();}
  stop(){this.generation++;cancelAnimationFrame(this.frame);this.stream?.getTracks().forEach(track=>track.stop());this.stream=undefined;this.video.nativeElement.srcObject=null;this.camera.set(false);this.starting.set(false);}
  async start(){
    const generation=++this.generation;this.error.set('');this.starting.set(true);
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error();
      await this.loadReader();
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:this.facing}},audio:false});
      if(generation!==this.generation||!this.dialog.nativeElement.open){stream.getTracks().forEach(track=>track.stop());return;}
      this.stream=stream;this.camera.set(true);void canSwitchCamera().then(can=>{if(generation===this.generation)this.canSwitch.set(can);});this.video.nativeElement.srcObject=stream;await this.video.nativeElement.play();
      let last=0;const scan=(time:number)=>{if(generation!==this.generation)return;const video=this.video.nativeElement;if(time-last>=150&&video.readyState>=2){last=time;if(this.decode(video,video.videoWidth,video.videoHeight))return;}this.frame=requestAnimationFrame(scan);};this.frame=requestAnimationFrame(scan);
    }catch{if(generation===this.generation){this.stop();this.error.set('Camera unavailable. Upload a QR image or enter the code.');}}
    finally{if(generation===this.generation)this.starting.set(false);}
  }
  private decode(source:CanvasImageSource,width:number,height:number){
    if(!width||!height||!this.reader)return false;const scale=Math.min(1,1024/Math.max(width,height));this.canvas.width=Math.round(width*scale);this.canvas.height=Math.round(height*scale);
    const context=this.canvas.getContext('2d',{willReadFrequently:true})!;context.drawImage(source,0,0,this.canvas.width,this.canvas.height);
    const pixels=context.getImageData(0,0,this.canvas.width,this.canvas.height),result=this.reader(pixels.data,pixels.width,pixels.height);
    if(!result)return false;const code=result.data.trim().toUpperCase();if(!/^[A-F0-9]{16}$/.test(code)){this.error.set('This QR is not a Together invitation.');return false;}
    this.close();this.scanned.emit(code);return true;
  }
  async upload(event:Event){const input=event.target as HTMLInputElement,file=input.files?.[0];if(!file)return;this.error.set('');const generation=this.generation;
    try{await this.loadReader();const image=await createImageBitmap(file);try{if(generation!==this.generation||!this.dialog.nativeElement.open)return;if(!this.decode(image,image.width,image.height))this.error.set('No invitation found. Choose a clear QR image.');}finally{image.close();}}
    catch{this.error.set('Could not read this image. Try another image.');}finally{input.value='';}
  }
  ngOnDestroy(){this.stop();}
}
