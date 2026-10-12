import {Injectable,Pipe,PipeTransform,inject,signal,Component,input,output,computed,effect,untracked} from '@angular/core';
import NepaliDate from 'nepali-date-converter';
import {FormsModule} from '@angular/forms';
import {formatDate} from '@angular/common';
import {adToBs,bsToAd} from './calendar-conversion';
@Injectable({providedIn:'root'})
export class Calendar {
  mode=signal<'ad'|'bs'>(localStorage.getItem('together.calendar')==='bs'?'bs':'ad');
  set(mode:'ad'|'bs'){this.mode.set(mode);localStorage.setItem('together.calendar',mode);}
  display(value:string,pattern='MMM d, y',timezone?:string){
    if(this.mode()==='ad')return formatDate(value,pattern,'en-US',timezone);
    try{const date=timezone==='UTC'?value.slice(0,10):formatDate(value,'yyyy-MM-dd','en-US');const bs=adToBs(date);const nepali=new NepaliDate(bs);if(pattern==='MMM')return nepali.format('MMM');if(pattern==='d')return String(nepali.getDate());if(pattern==='EEE')return nepali.format('ddd');return bs+' BS';}catch{return formatDate(value,pattern,'en-US',timezone)+' AD';}
  }
}
@Pipe({name:'calendarDate',standalone:true,pure:false})
export class CalendarDate implements PipeTransform {calendar=inject(Calendar);transform(value:string,pattern='MMM d, y',timezone?:string){return this.calendar.display(value,pattern,timezone);}}
@Component({selector:'calendar-switch',standalone:true,template:`<div class="calendar-switch" aria-label="Calendar"><button type="button" [class.active]="calendar.mode()==='ad'" [attr.aria-pressed]="calendar.mode()==='ad'" (click)="calendar.set('ad')">AD</button><button type="button" [class.active]="calendar.mode()==='bs'" [attr.aria-pressed]="calendar.mode()==='bs'" (click)="calendar.set('bs')">BS</button></div>`})
export class CalendarSwitch {calendar=inject(Calendar);}
@Component({selector:'calendar-input',standalone:true,imports:[FormsModule],template:`
@if(calendar.mode()==='ad'){<label>{{label()}}<input [name]="label()" [ngModel]="value()" (ngModelChange)="valueChange.emit($event)" [type]="time()?'datetime-local':'date'" [min]="min()" [max]="max()" required></label>}
@else{<label>{{label()}} (BS)<input [name]="label()" [ngModel]="bsValue()" (ngModelChange)="change($event)" type="text" inputmode="numeric" [placeholder]="time()?'2083-07-01T18:00':'2083-07-01'" required [attr.aria-invalid]="!!error()"></label>@if(error()){<p class="form-error" role="alert">{{error()}}</p>}}
`})
export class CalendarInput {
  calendar=inject(Calendar);label=input.required<string>();value=input('');valueChange=output<string>();time=input(false);min=input('');max=input('');error=signal('');draft=signal<string|null>(null);
  constructor(){effect(()=>{const value=this.value();this.calendar.mode();if(value)untracked(()=>this.draft.set(null));});}
  bsValue=computed(()=>{if(this.draft()!==null)return this.draft()!;const v=this.value();if(!v)return '';try{return adToBs(v.slice(0,10))+v.slice(10);}catch{return '';}});
  change(value:string){this.draft.set(value);try{const suffix=value.slice(10);if(this.time()&&!/^T([01]\d|2[0-3]):[0-5]\d$/.test(suffix))throw new Error('Include time as HH:MM after the BS date.');const ad=bsToAd(value.slice(0,10))+suffix;if((this.min()&&ad<this.min())||(this.max()&&ad>this.max()))throw new Error('Choose a date within this trip.');this.error.set('');this.valueChange.emit(ad);}catch(e){this.error.set((e as Error).message);this.valueChange.emit('');}}
}
