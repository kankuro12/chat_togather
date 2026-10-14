import { Component, HostListener, effect, inject, signal, untracked } from '@angular/core';
import { Api } from './api';
import { Nudge } from './models';

/** "Thinking of you": a full-screen moment with floating hearts and a soft chime, shown live or the next time the app opens. */
@Component({selector:'nudge-overlay',standalone:true,template:`
@if(showing();as name){<div class="nudge-overlay" role="alertdialog" aria-live="assertive" [attr.aria-label]="name+' is thinking of you'" (click)="dismiss()">
  <div class="nudge-hearts" aria-hidden="true">@for(heart of hearts;track $index){<span [style.left.%]="heart.left" [style.animation-delay.s]="heart.delay" [style.font-size.px]="heart.size">💗</span>}</div>
  <div class="nudge-card"><span class="nudge-big" aria-hidden="true">💗</span><strong>{{name}}</strong><span>is thinking of you</span><small>Tap anywhere to close</small></div>
</div>}`})
export class NudgeOverlay {
  private api=inject(Api);showing=signal<string|null>(null);private timer?:ReturnType<typeof setTimeout>;
  hearts=Array.from({length:16},(_,i)=>({left:(i*37)%100,delay:(i%8)*0.35,size:18+((i*11)%26)}));
  constructor(){
    effect(()=>{const live=this.api.nudged();if(live)untracked(()=>this.show(live.name,new Date(live.at).toISOString()));});
    effect(()=>{if(this.api.pair())untracked(()=>void this.checkMissed());});
  }
  @HostListener('document:visibilitychange') visible(){if(document.visibilityState==='visible')void this.checkMissed();}
  private seenKey(){return 'together.nudge.seen.'+(this.api.user()?.id||'');}
  /** A nudge sent while the app was closed plays once when it next opens (if it is less than a day old). */
  private async checkMissed(){
    if(!this.api.pair()||this.showing())return;
    try{
      const latest=(await this.api.request<Nudge[]>('/us/nudges')).find(nudge=>nudge.user_id!==this.api.user()?.id);if(!latest)return;
      const seen=localStorage.getItem(this.seenKey())||'';if(latest.created_at<=seen||Date.now()-Date.parse(latest.created_at)>86400000)return;
      this.show(latest.name,latest.created_at);
    }catch{/* nothing to show */}
  }
  private show(name:string,at:string){
    try{const seen=localStorage.getItem(this.seenKey())||'';if(at>seen)localStorage.setItem(this.seenKey(),at);}catch{/* storage blocked */}
    this.showing.set(name);this.chime();navigator.vibrate?.([60,80,60]);
    clearTimeout(this.timer);this.timer=setTimeout(()=>this.dismiss(),5000);
  }
  dismiss(){clearTimeout(this.timer);this.showing.set(null);}
  /** Three soft rising notes; skipped quietly where the browser blocks sound without a tap. */
  private chime(){
    try{
      const context=new AudioContext();void context.resume();const start=context.currentTime+0.05;
      for(const [frequency,offset] of [[523.25,0],[659.25,0.18],[783.99,0.36],[1046.5,0.6]] as const){
        const tone=context.createOscillator(),gain=context.createGain();tone.type='sine';tone.frequency.value=frequency;
        gain.gain.setValueAtTime(0,start+offset);gain.gain.linearRampToValueAtTime(0.16,start+offset+0.03);gain.gain.exponentialRampToValueAtTime(0.0001,start+offset+1.1);
        tone.connect(gain).connect(context.destination);tone.start(start+offset);tone.stop(start+offset+1.2);
      }
      setTimeout(()=>void context.close(),2500);
    }catch{/* no audio */}
  }
}
