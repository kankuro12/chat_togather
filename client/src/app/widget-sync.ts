import { Injectable, effect, inject, untracked } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Api } from './api';
import { NativeCalls } from './communication';
import { Moment, SpecialDate } from './models';
import { localDay, dayNumber, nextOccurrence, together } from './us-dates';

/** Keeps the Android home-screen widget in step with the app: "together for", the next special date and the partner's latest moment. */
@Injectable({providedIn:'root'})
export class WidgetSync {
  private api=inject(Api);private lastMoment='';
  constructor(){
    if(Capacitor.getPlatform()!=='android')return;
    effect(()=>{this.api.usVersion();if(this.api.pair())untracked(()=>void this.sync());});
    // "Thinking of you" shows on the widget too (the native push handler does this while the app is closed).
    effect(()=>{if(this.api.nudged()&&this.api.pair())untracked(()=>void this.sync());});
  }
  private async sync(){
    try{
      const [dates,moment]=await Promise.all([this.api.request<SpecialDate[]>('/us/dates'),this.api.request<{from_partner:Moment|null}>('/us/moment')]);
      const today=localDay(),partner=this.api.partner()?.name||'Your partner';
      const start=dates.find(date=>date.kind==='together');const title=start?`Together ${together(start.date,today).split(', ')[0]}`:`You & ${partner}`;
      const next=dates.map(date=>{const day=nextOccurrence(date.date,today,!!date.yearly);return day?{title:date.title,days:dayNumber(day)-dayNumber(today)}:null;}).filter(Boolean).sort((a,b)=>a!.days-b!.days)[0];
      const fresh=moment.from_partner&&moment.from_partner.id!==this.lastMoment?moment.from_partner:null;
      const nudge=this.api.nudged();const recentNudge=nudge&&Date.now()-nudge.at<6*3600_000?`💗 ${nudge.name||partner} is thinking of you · ${new Date(nudge.at).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`:'';
      const subtitle=fresh?`${fresh.kind==='drawing'?'🎨':'📷'} From ${fresh.sender_name}${fresh.caption?' · '+fresh.caption:''}`:recentNudge?recentNudge:next?`${next.title}: ${next.days===0?'today 🎉':next.days===1?'tomorrow':'in '+next.days+' days'}`:'💗 Tap the heart to send love';
      const image=fresh?await this.picture(fresh.media_id):undefined;if(fresh)this.lastMoment=fresh.id;
      await NativeCalls.updateWidget({title,subtitle,...(image?{image}:{})});
    }catch{/* the widget keeps its last picture */}
  }
  /** A small JPEG (≤600px) so the widget stays within Android's memory budget. */
  private async picture(mediaId:string){
    const url=await this.api.mediaUrl(mediaId);
    try{const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,600/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
      canvas.getContext('2d')!.drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.82).split(',')[1];}
    finally{URL.revokeObjectURL(url);}
  }
}
