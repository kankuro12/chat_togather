import {Injectable,inject,signal,effect,untracked} from '@angular/core';
import {Capacitor,registerPlugin} from '@capacitor/core';
export const NativeCalls=registerPlugin<{configure(input:{url:string;token:string}):Promise<void>;permissionStatus():Promise<{fullScreen:boolean}>;settings():Promise<void>;takeAction():Promise<{id?:string;action?:string}>;clear(input:{id:string}):Promise<void>}>('NativeCalls');
import {Api} from './api';
export interface LocationShare {user_id:string;latitude:number;longitude:number;accuracy:number;expires_at:number;updated_at:number}
@Injectable({providedIn:'root'})
export class Communication {
  api=inject(Api);status=signal<'idle'|'incoming'|'ringing'|'connecting'|'active'>('idle');kind=signal<'audio'|'video'>('audio');name=signal('');local=signal<MediaStream|null>(null);remote=signal<MediaStream|null>(null);muted=signal(false);cameraOff=signal(false);locations=signal<LocationShare[]>([]);sharing=signal(false);locationUntil=signal(0);preparing=signal(false);locationPending=signal(false);
  private locationRun=0;private connectionTimer?:ReturnType<typeof setTimeout>;private id='';private peer?:RTCPeerConnection;private candidates:RTCIceCandidateInit[]=[];private signalQueue=Promise.resolve();private watch?:number;private expiry?:ReturnType<typeof setTimeout>;private disconnected?:ReturnType<typeof setTimeout>;private run=0;
  constructor(){window.addEventListener('native-call-action',()=>{if(this.api.connected())void this.resumeIncoming();});effect(onCleanup=>{const connected=this.api.connected(),user=this.api.user(),socket=this.api.socket;if(!connected||!user||!socket){untracked(()=>{this.cleanup();this.stopLocation(false);});return;}
    const handlers:Record<string,(data:any)=>void>={
      'call:incoming':data=>{if(this.status()!=='idle')return;this.id=data.id;this.kind.set(data.kind);this.name.set(data.name);this.status.set('incoming');},
      'call:accepted':data=>{if(data.id===this.id)void this.offer();},
      'call:claimed':data=>{if(data.id===this.id&&this.status()==='incoming')this.cleanup();},
      'call:signal':data=>{this.signalQueue=this.signalQueue.then(()=>this.receive(data)).catch(()=>{if(data.id===this.id){this.api.error.set('Call connection failed. Please try again.');this.end();}});},
      'call:ended':data=>{if(data.id===this.id){this.cleanup();if(data.reason==='No answer'||data.reason==='Disconnected')this.api.error.set(data.reason==='No answer'?'Your partner did not answer.':'Call disconnected.');}},
      'location:changed':data=>this.locations.update(list=>[...list.filter(item=>item.user_id!==data.user_id),data]),
      'location:stopped':data=>{this.locations.update(list=>list.filter(item=>item.user_id!==data.user_id));if(data.user_id===this.api.user()?.id)this.stopLocation(false);},
      'disconnect':()=>{this.cleanup();this.stopLocation(false);this.locations.set([]);}
    };
    for(const [event,handler] of Object.entries(handlers))socket.on(event,handler);
    const token=this.api.token;void this.resumeIncoming();
    const tokenForLocations=this.api.token;void this.api.request<LocationShare[]>('/communication/locations').then(list=>{if(tokenForLocations===this.api.token)this.locations.set(list);}).catch(()=>{});
    onCleanup(()=>{for(const [event,handler] of Object.entries(handlers))socket.off(event,handler);this.cleanup();this.stopLocation(false);this.locations.set([]);});
  });}
  async resumeIncoming(){const token=this.api.token;try{let action:{id?:string;action?:string}={};if(Capacitor.getPlatform()==='android'){await NativeCalls.configure({url:this.api.base,token});action=await NativeCalls.takeAction();}else{const params=new URLSearchParams(location.hash.split('?')[1]||'');action={id:params.get('call')||undefined,action:params.get('action')||'view'};}
  const calls=action.id?[await this.api.request('/communication/calls/'+encodeURIComponent(action.id))]:await this.api.request('/communication/calls/incoming');if(token!==this.api.token)return;const call=calls[0];if(!call)return;if(action.action==='decline'){await this.api.request('/communication/calls/'+call.id+'/decline',{});return;}if(this.status()==='idle'){this.id=call.id;this.kind.set(call.kind);this.name.set(call.name);this.status.set('incoming');}if(Capacitor.getPlatform()==='android')await NativeCalls.clear({id:call.id});if(action.action==='answer')await this.accept();
  }catch{if(actionHash())this.api.error.set('This call has ended.');}finally{if(actionHash())history.replaceState(null,'','#chat');}}
  private emit(event:string,data:any):Promise<any>{return new Promise((resolve,reject)=>{if(!this.api.socket?.connected){reject(new Error('Reconnect before trying again.'));return;}this.api.socket.timeout(5000).emit(event,data,(error:any,result:any)=>{if(error||!result?.ok)reject(new Error(result?.error||'Connection unavailable. Try again.'));else resolve(result);});});}
  private async prepare(kind:'audio'|'video'){
    const generation=++this.run;this.preparing.set(true);
    try{
      const config=await this.api.request('/communication/config');if(generation!==this.run)return false;const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:kind==='video'?{facingMode:'user'}:false});
      if(generation!==this.run){stream.getTracks().forEach(track=>track.stop());return false;}
      this.local.set(stream);this.kind.set(kind);this.muted.set(false);this.cameraOff.set(false);this.peer=new RTCPeerConnection({iceServers:config.iceServers});const peer=this.peer;
      stream.getTracks().forEach(track=>peer.addTrack(track,stream));peer.ontrack=event=>{this.remote.set(event.streams[0]||new MediaStream([event.track]));};
      peer.onicecandidate=event=>{if(event.candidate&&this.id)void this.emit('call:signal',{id:this.id,candidate:event.candidate.toJSON()}).catch(()=>this.end());};
      peer.onconnectionstatechange=()=>{if(peer!==this.peer)return;if(peer.connectionState==='connected'){clearTimeout(this.connectionTimer);clearTimeout(this.disconnected);this.status.set('active');}if(peer.connectionState==='failed')this.end();if(peer.connectionState==='disconnected')this.disconnected=setTimeout(()=>this.end(),10000);};
      return true;
    }finally{if(generation===this.run)this.preparing.set(false);}
  }
  async start(kind:'audio'|'video'){if(this.status()!=='idle'||this.preparing())return;this.api.error.set('');try{if(!await this.prepare(kind))return;this.name.set(this.api.partner()?.name||'Partner');const result=await this.emit('call:start',{kind});this.id=result.id;this.status.set('ringing');}catch(e){this.cleanup();this.api.error.set(this.failure(e));}}
  async accept(){if(this.status()!=='incoming'||this.preparing())return;try{if(!await this.prepare(this.kind()))return;await this.emit('call:accept',{id:this.id});this.status.set('connecting');this.connectionTimer=setTimeout(()=>{this.api.error.set('Could not connect the call. Please try again.');this.end();},30000);}catch(e){this.api.error.set(this.failure(e));this.end();}}
  private async offer(){try{if(!this.peer)return;this.status.set('connecting');this.connectionTimer=setTimeout(()=>{this.api.error.set('Could not connect the call. Please try again.');this.end();},30000);await this.peer.setLocalDescription(await this.peer.createOffer());await this.emit('call:signal',{id:this.id,description:this.peer.localDescription});}catch{this.end();}}
  private async receive(data:any){if(data.id!==this.id||!this.peer)return;const peer=this.peer;
    if(data.description){await peer.setRemoteDescription(data.description);for(const candidate of this.candidates)await peer.addIceCandidate(candidate);this.candidates=[];if(data.description.type==='offer'){await peer.setLocalDescription(await peer.createAnswer());await this.emit('call:signal',{id:this.id,description:peer.localDescription});}}
    else if(data.candidate){if(peer.remoteDescription)await peer.addIceCandidate(data.candidate);else this.candidates.push(data.candidate);}
  }
  end(){if(this.id)void this.emit('call:end',{id:this.id}).catch(()=>{});this.cleanup();}
  private cleanup(){this.run++;this.preparing.set(false);clearTimeout(this.disconnected);clearTimeout(this.connectionTimer);this.peer?.close();this.peer=undefined;this.local()?.getTracks().forEach(track=>track.stop());this.remote()?.getTracks().forEach(track=>track.stop());this.local.set(null);this.remote.set(null);this.status.set('idle');this.id='';this.candidates=[];}
  mute(){this.muted.update(value=>!value);this.local()?.getAudioTracks().forEach(track=>track.enabled=!this.muted());}
  toggleCamera(){this.cameraOff.update(value=>!value);this.local()?.getVideoTracks().forEach(track=>track.enabled=!this.cameraOff());}
  async shareLocation(minutes:15|60){if(this.locationPending()||this.sharing())return;const generation=++this.locationRun,token=this.api.token;this.locationPending.set(true);this.api.error.set('');try{
    if(!navigator.geolocation)throw new Error('Location sharing is unavailable on this device.');const first=await new Promise<GeolocationPosition>((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,timeout:15000}));
    if(generation!==this.locationRun||token!==this.api.token)return;const result=await this.emit('location:start',{minutes});if(generation!==this.locationRun||token!==this.api.token){if(token===this.api.token)void this.emit('location:stop',{}).catch(()=>{});return;}this.sharing.set(true);this.locationUntil.set(result.expires_at);const send=(position:GeolocationPosition)=>{if(!this.sharing())return;void this.emit('location:update',{latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy}).catch(()=>this.stopLocation());};send(first);
    this.watch=navigator.geolocation.watchPosition(send,()=>{this.api.error.set('Location unavailable. Sharing stopped.');this.stopLocation();},{enableHighAccuracy:true,maximumAge:5000,timeout:15000});this.expiry=setTimeout(()=>this.stopLocation(),Math.max(0,result.expires_at-Date.now()));
  }catch(e){if(generation===this.locationRun)this.api.error.set((e as any)?.code===1?'Allow location access to share with your partner.':this.failure(e));}finally{if(generation===this.locationRun)this.locationPending.set(false);}}
  stopLocation(notify=true){this.locationRun++;this.locationPending.set(false);if(notify&&this.sharing())void this.emit('location:stop',{}).catch(()=>{});if(this.watch!==undefined)navigator.geolocation.clearWatch(this.watch);this.watch=undefined;clearTimeout(this.expiry);this.sharing.set(false);this.locationUntil.set(0);}
  map(share:LocationShare){return `https://www.openstreetmap.org/?mlat=${share.latitude}&mlon=${share.longitude}#map=16/${share.latitude}/${share.longitude}`;}
  private failure(error:any){if(error?.name==='NotAllowedError')return 'Allow microphone or camera access to continue.';if(error?.name==='NotFoundError')return 'Microphone or camera unavailable on this device.';return error?.message||'Could not connect. Please try again.';}
}

function actionHash(){return location.hash.startsWith('#chat?call=');}
