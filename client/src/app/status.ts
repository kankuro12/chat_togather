import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { Api } from './api';

type BatteryManager={level:number;charging:boolean};
/** Shares this phone's local time zone and battery with the partner, and (only when switched on) a coarse position
 *  so the server can tell you both how far apart you are. Coordinates are rounded and never shown to anyone. */
@Injectable({providedIn:'root'})
export class StatusReporter {
  private api=inject(Api);private timer?:ReturnType<typeof setInterval>;
  sharingDistance=signal(false);
  constructor(){
    effect(()=>{if(this.api.pair())untracked(()=>{void this.report();clearInterval(this.timer);this.timer=setInterval(()=>void this.report(),10*60*1000);});else clearInterval(this.timer);});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&this.api.pair())void this.report();});
  }
  private key(){return 'together.shareDistance.'+(this.api.user()?.id||'');}
  async setSharing(on:boolean){
    try{localStorage.setItem(this.key(),on?'on':'off');}catch{/* storage blocked */}this.sharingDistance.set(on);
    if(!on){await this.api.request('/us/status',{timezone:this.zone(),location:null},'PUT').catch(()=>{});return;}
    await this.report(true);
  }
  setReunion(day:string|null){return this.api.request('/us/status',{timezone:this.zone(),reunion:day},'PUT');}
  private zone(){return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}
  async report(askLocation=false){
    if(!this.api.pair())return;
    try{localStorage.getItem(this.key())==='on'?this.sharingDistance.set(true):this.sharingDistance.set(false);}catch{/* ignore */}
    const body:Record<string,unknown>={timezone:this.zone()};
    try{const battery=await (navigator as Navigator&{getBattery?:()=>Promise<BatteryManager>}).getBattery?.();if(battery){body['battery']=Math.round(battery.level*100);body['charging']=battery.charging;}}catch{/* no battery info */}
    if(this.sharingDistance()&&'geolocation' in navigator){
      const position=await new Promise<GeolocationPosition|null>(resolve=>navigator.geolocation.getCurrentPosition(resolve,()=>resolve(null),{enableHighAccuracy:false,maximumAge:30*60*1000,timeout:askLocation?20000:8000}));
      if(position)body['location']={lat:position.coords.latitude,lng:position.coords.longitude};else if(askLocation)this.api.error.set('Allow location to show how far apart you are.');
    }
    await this.api.request('/us/status',body,'PUT').catch(()=>{});
  }
}
