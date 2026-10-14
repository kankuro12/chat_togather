import { compressImage } from './compress-image';
import { createPreview } from './media-preview';
import { Injectable, signal, computed } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { User, Pair, Media, Message, Decision, Plan, Trip } from './models';
import { normalizeServerUrl } from './server-url';
import { appendMessages } from './chat-messages';

/** The request never reached the server (offline, server down); safe to retry later. */
export class OfflineError extends Error{constructor(){super('Cannot reach Together. Check your connection and try again.');this.name='OfflineError';}}

@Injectable({providedIn:'root'})
export class Api {
  user=signal<User|null>(null);pair=signal<Pair|null>(null);booting=signal(true);busy=signal(false);error=signal('');
  messages=signal<Message[]>([]);media=signal<Media[]>([]);private thumbs=new Map<string,Promise<string>>();decisions=signal<Decision[]>([]);plans=signal<Plan[]>([]);trips=signal<Trip[]>([]);
  connected=signal(false);online=signal<string[]>([]);typing=signal('');
  unread=signal(0);pendingChoices=signal(0);pendingChoicesReady=signal(false);chatReading=signal(false);partnerRead=signal<{id:string;created_at:string}|null>(null);private lastRead='';private readingPending=false;private readSequence=0;private pendingSequence=0;
  setChatReading(active:boolean){this.chatReading.set(active);this.socket?.emit('chat:view',active);if(active)void this.readLatest();}
  async readLatest(){const latest=this.messages().at(-1);if(!this.chatReading()||!latest||this.lastRead===latest.id||this.readingPending)return;const token=this.token;this.readingPending=true;let success=false;try{await this.request('/messages/read',{message_id:latest.id});if(token!==this.token)return;this.lastRead=latest.id;success=true;await this.readState();}catch(e){if(token===this.token)this.error.set(this.message(e));}finally{this.readingPending=false;if(success&&token===this.token&&this.messages().at(-1)?.id!==latest.id)void this.readLatest();}}
  async readState(){const token=this.token,sequence=++this.readSequence;const state=await this.request('/messages/read-state');if(token!==this.token||sequence!==this.readSequence)return;this.unread.set(state.unread);this.partnerRead.set(state.partner);}
  async refreshPendingChoices(){const token=this.token,pairId=this.pair()?.id,sequence=++this.pendingSequence;const state=await this.request<{count:number}>('/decisions/pending');if(token!==this.token||pairId!==this.pair()?.id||sequence!==this.pendingSequence)return;this.pendingChoices.set(Number(state.count)||0);this.pendingChoicesReady.set(true);}
  seen(message:Message){const read=this.partnerRead();return !!read&&(read.created_at>message.created_at||(read.created_at===message.created_at&&read.id>=message.id));}
  partner=computed(()=>this.pair()?.members.find(m=>m.id!==this.user()?.id));
  token=localStorage.getItem('together.session')||'';
  base=localStorage.getItem('together.server')||'';
  native=Capacitor.isNativePlatform();socket?:Socket;
  private typingTimer?:ReturnType<typeof setTimeout>;private poll?:ReturnType<typeof setInterval>;
  private running:Record<string,Promise<void>|undefined>={};private queued:Record<string,Promise<void>|undefined>={};
  constructor(){void this.initialize();setInterval(()=>{if(this.chatReading())this.socket?.emit('chat:view',document.visibilityState==='visible'&&document.hasFocus());},20000);}
  async initialize(){
    try{
      if(this.native&&!this.base){const config=await fetch('together-config.json').then(r=>r.json());this.setServer(config.apiUrl||'');}
      const result=new URLSearchParams(location.hash.slice(1));
      if(result.has('auth_ticket')||result.has('auth_error')){
        history.replaceState(null,'',location.pathname+location.search);
        if(result.has('auth_error'))throw new Error('Sign-in could not be completed. Please try again.');
        const verifier=sessionStorage.getItem('together.oauth')||'';sessionStorage.removeItem('together.oauth');
        await this.acceptSession(await this.request('/auth/oauth/exchange',{ticket:result.get('auth_ticket'),verifier}));
      }else if(this.token)await this.me();
    }catch(e){this.error.set(this.native&&!this.base?'Together is unavailable right now. Please try again later.':this.message(e));}finally{this.booting.set(false);}
    this.poll=setInterval(()=>{if(this.user()&&!this.pair())void this.me().catch(e=>this.error.set(this.message(e)));},3000);
  }
  setServer(base:string){
    const normalized=normalizeServerUrl(base,this.native);
    if(normalized!==this.base)this.forget();
    this.base=normalized;localStorage.setItem('together.server',normalized);
  }
  async request<T=any>(path:string,body?:unknown,method?:string):Promise<T>{
    const backend=normalizeServerUrl(this.base,this.native),token=this.token;
    let response:Response;
    try{response=await fetch(`${backend}/api${path}`,{credentials:'include',method:method||(body===undefined?'GET':'POST'),headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body instanceof FormData?{}:body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body)});}catch{throw new OfflineError();}
    const data=await response.json().catch(()=>({error:'Together is unavailable right now. Please try again.'}));
    if(!response.ok){if(response.status===401&&token&&path!=='/auth/login'){if(token!==this.token)throw new Error('');this.forget();this.error.set('You’re signed out. Sign in to continue.');throw new Error('You’re signed out. Sign in to continue.');}throw new Error(data.error||'Request failed.');}return data;
  }
  async me(){const token=this.token;let me:{user:User;pair:Pair|null};try{me=await this.request('/auth/me');}catch(error){if(token!==this.token)return;throw error;}if(token!==this.token)return;this.user.set(me.user);const previous=this.pair()?.id;this.pair.set(me.pair);// Connect first: an incoming call answered from a notification needs the live connection, not the full data load.
    if(me.pair&&previous!==me.pair.id){this.connect();await this.reload();}}
  async acceptSession(session:{token:string}){this.token=session.token;localStorage.setItem('together.session',this.token);await this.me();}
  async authenticate(mode:'register'|'login',input:unknown){await this.acceptSession(await this.request('/auth/'+mode,input));}
  async social(provider:'google'|'facebook'){
    const verifier=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const result=await this.request('/auth/oauth/'+provider+'/start',{verifier});
    sessionStorage.setItem('together.oauth',verifier);location.assign(result.url);
  }
  async logout(){await this.request('/auth/logout',{});this.forget();}
  private forget(){this.unread.set(0);this.pendingChoices.set(0);this.pendingChoicesReady.set(false);this.pendingSequence++;this.partnerRead.set(null);this.chatReading.set(false);this.lastRead='';this.socket?.disconnect();this.socket?.removeAllListeners();this.socket=undefined;clearTimeout(this.typingTimer);this.token='';localStorage.removeItem('together.session');if(typeof caches!=='undefined')void caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('together-media-')).map(key=>caches.delete(key)))).catch(()=>{});for(const url of this.thumbs.values())void url.then(URL.revokeObjectURL,()=>{});this.thumbs.clear();this.user.set(null);this.pair.set(null);this.messages.set([]);this.media.set([]);this.decisions.set([]);this.plans.set([]);this.trips.set([]);this.connected.set(false);this.typing.set('');this.online.set([]);}
  async reload(area?:string){
    if(!this.pair())return;
    const areas=['messages','media','decisions','plans','trips'].filter(resource=>!area||resource===area);
    await Promise.all(areas.map(resource=>this.refresh(resource)));
  }
  /** One request per area at a time; calls that arrive mid-request share a single follow-up instead of each starting their own. */
  private refresh(resource:string):Promise<void>{
    const running=this.running[resource];
    if(running)return this.queued[resource]??=running.catch(()=>{}).then(()=>{this.queued[resource]=undefined;return this.refresh(resource);});
    const run=this.fetchArea(resource).finally(()=>{if(this.running[resource]===run)this.running[resource]=undefined;});
    this.running[resource]=run;return run;
  }
  private async fetchArea(resource:string){
    const token=this.token;const pairId=this.pair()?.id;
    // Messages never change once sent, so after the first load only newer ones are fetched.
    const last=resource==='messages'?this.messages().at(-1):undefined;
    let data:any[]|undefined;
    if(last)data=await this.request<Message[]>('/messages?after='+last.id).then(rows=>rows.length<100?rows:undefined,()=>undefined);
    const incremental=!!data;data??=await this.request<any[]>('/'+resource);
    if(token!==this.token||pairId!==this.pair()?.id)return;
    switch(resource){
      case 'messages':{const next=incremental?appendMessages(this.messages(),data):data;if(next!==this.messages()){this.messages.set(next);await this.readState();}break;}
      case 'media':this.media.set(data);break;
      case 'decisions':this.decisions.set(data);await this.refreshPendingChoices();break;
      case 'plans':this.plans.set(data);break;
      case 'trips':this.trips.set(data);break;
    }
  }
  private connect(){
    this.socket?.disconnect();this.socket=io(this.base||location.origin,{auth:{token:this.token}});
    this.socket.on('connect',()=>{this.connected.set(true);this.socket?.emit('chat:view',this.chatReading());void this.reload().catch(e=>this.error.set(this.message(e)));});
    this.socket.on('disconnect',(reason:string)=>{this.connected.set(false);this.online.set([]);if(reason==='io server disconnect')void this.me().catch(e=>this.error.set(this.message(e)));});
    this.socket.on('connect_error',()=>this.connected.set(false));
    this.socket.on('changed',(event:{area:string})=>{if(event.area==='us'){this.usVersion.update(v=>v+1);return;}void (event.area==='read-state'?this.readState():this.reload(event.area)).catch(e=>this.error.set(this.message(e)));});
    this.socket.on('nudge',(event:{name:string})=>this.nudged.set({name:event.name,at:Date.now()}));
    this.socket.on('message:updated',(event:{id:string})=>{void this.refreshMessage(event.id).catch(()=>{});});
    this.socket.on('presence',(users:string[])=>this.online.set(users));
    this.socket.on('typing',(event:{name:string;active:boolean})=>{this.typing.set(event.active?`${event.name} is typing…`:'');clearTimeout(this.typingTimer);this.typingTimer=setTimeout(()=>this.typing.set(''),3500);});
  }
  /** Latest version of a message that changed after it was sent (edit, delete, reaction, pin, opened). */
  patched=signal<Message|null>(null);pinsVersion=signal(0);
  /** Bumped when the partner changes anything on the Us tab. */
  usVersion=signal(0);nudged=signal<{name:string;at:number}|null>(null);
  async refreshMessage(id:string){const token=this.token;const row=await this.request<Message>('/messages/'+id);if(token===this.token)this.applyMessage(row);}
  applyMessage(row:Message){this.messages.update(list=>list.some(m=>m.id===row.id)?list.map(m=>m.id===row.id?row:m):list);this.patched.set(row);this.pinsVersion.update(v=>v+1);}
  async react(id:string,emoji:string|null){this.applyMessage(await this.request<Message>(`/messages/${id}/reaction`,{emoji},'PUT'));}
  async editMessage(id:string,text:string){this.applyMessage(await this.request<Message>('/messages/'+id,{text},'PATCH'));}
  async deleteMessage(id:string){this.applyMessage(await this.request<Message>('/messages/'+id,undefined,'DELETE'));}
  async pin(id:string,pinned:boolean){this.applyMessage(await this.request<Message>(`/messages/${id}/pin`,{pinned},'PUT'));}
  /** Downloads a view-once photo; for the recipient this is the only time the server hands it out. */
  async openOnce(id:string){const backend=normalizeServerUrl(this.base,this.native);const response=await fetch(`${backend}/api/messages/${id}/open`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`}});if(!response.ok)throw new Error((await response.json().catch(()=>({}))).error||'Photo unavailable.');return URL.createObjectURL(await response.blob());}
  sendTyping(active:boolean){this.socket?.emit('typing',active);}
  async mutate(path:string,body?:unknown,method?:string){const result=await this.request(path,body,method);await this.reload(path.split('/')[1]);return result;}
  /** `purpose` records where an upload belongs, so Memories shows only what was added there. */
  async upload(file:File,purpose?:'choice'|'memory'|'chat'){file=await compressImage(file);if(file.size>15*1024*1024)throw new Error('Media must be smaller than 15 MB.');const preview=await createPreview(file);const form=new FormData();form.append('file',file);if(preview.thumb)form.append('thumb',preview.thumb,'thumb');for(const key of ['duration','width','height'] as const)if(preview[key])form.append(key,String(preview[key]));if(preview.waveform)form.append('waveform',preview.waveform.join(','));return this.request<Media>('/media'+(purpose?'?purpose='+purpose:''),form);}
  /** Thumbnails are tiny and reused across pages, so they stay cached until sign-out. */
  thumbUrl(id:string){let url=this.thumbs.get(id);if(!url){url=this.mediaUrl(id+'/thumb');this.thumbs.set(id,url);url.catch(()=>this.thumbs.delete(id));}return url;}
  /** Photos, videos, voice messages and thumbnails stay on this device after the first view (the server marks them unchanging),
   *  so they open instantly and work offline. View-once photos are never stored. The cache is cleared on sign-out. */
  async mediaUrl(id:string){
    const backend=normalizeServerUrl(this.base,this.native),url=`${backend}/api/media/${id}`;const cache=await this.mediaCache();
    const hit=await cache?.match(url).catch(()=>undefined);if(hit)return URL.createObjectURL(await hit.blob());
    const response=await fetch(url,{headers:{Authorization:`Bearer ${this.token}`}});if(!response.ok)throw new Error('Media unavailable.');const blob=await response.blob();
    if(cache&&/immutable/.test(response.headers.get('cache-control')||''))void cache.put(url,new Response(blob,{headers:{'content-type':blob.type}})).then(()=>this.trimMediaCache(cache)).catch(()=>{});
    return URL.createObjectURL(blob);
  }
  private mediaCacheName(){return 'together-media-'+(this.user()?.id||'anonymous');}
  private async mediaCache(){try{return typeof caches==='undefined'||!this.user()?undefined:await caches.open(this.mediaCacheName());}catch{return undefined;}}
  /** Keeps the newest 500 files; older ones are simply downloaded again if needed. */
  private async trimMediaCache(cache:Cache){const keys=await cache.keys();for(const key of keys.slice(0,Math.max(0,keys.length-500)))await cache.delete(key);}
  async action(work:()=>Promise<void>):Promise<boolean>{if(this.busy())return false;this.error.set('');this.busy.set(true);try{await work();return true;}catch(e){this.error.set(this.message(e));return false;}finally{this.busy.set(false);}}
  private message(error:unknown){return error instanceof Error?error.message:'Please try again.';}
}
