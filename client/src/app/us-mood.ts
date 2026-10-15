import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from './api';
import { MoodDay } from './models';
import { localDay } from './us-dates';

export const MOODS:{id:string;emoji:string;label:string}[]=[
  {id:'happy',emoji:'😊',label:'Happy'},{id:'loved',emoji:'🥰',label:'Loved'},{id:'calm',emoji:'😌',label:'Calm'},{id:'excited',emoji:'🤩',label:'Excited'},
  {id:'tired',emoji:'😴',label:'Tired'},{id:'stressed',emoji:'😣',label:'Stressed'},{id:'sad',emoji:'😢',label:'Sad'},{id:'missing',emoji:'🥺',label:'Missing you'},
];
const moodOf=(id:string|null|undefined)=>MOODS.find(mood=>mood.id===id);

/** Daily mood check-in for both of you, with a "what I need" note and the last seven days. */
@Component({selector:'us-mood',standalone:true,imports:[FormsModule],template:`
<section class="card us-card mood-card" aria-labelledby="mood-title">
  <div class="us-card-heading"><h2 id="mood-title">How are you today?</h2></div>
  <div class="mood-picker" role="radiogroup" aria-label="Your mood">@for(mood of moods;track mood.id){<button type="button" role="radio" class="mood-option" [class.active]="data()?.mine?.mood===mood.id" [attr.aria-checked]="data()?.mine?.mood===mood.id" [attr.aria-label]="mood.label" (click)="pick(mood.id)"><span aria-hidden="true">{{mood.emoji}}</span><small>{{mood.label}}</small></button>}</div>
  @if(data()?.mine){<form class="inline-add" (ngSubmit)="saveNote()"><input name="note" [(ngModel)]="note" maxlength="280" aria-label="What I need today" placeholder="What I need today (optional)" autocomplete="off"><button class="secondary" type="submit" [disabled]="note===(data()?.mine?.note||'')">Save</button></form>}
  <div class="mood-partner">@if(partnerMood();as mood){<span class="mood-big" aria-hidden="true">{{mood.emoji}}</span><div><strong>{{partnerName()}} feels {{mood.label.toLowerCase()}}</strong>@if(data()?.partner?.note){<p>“{{data()?.partner?.note}}”</p>}</div>}@else{<p class="fineprint">{{partnerName()}} hasn’t checked in today.</p>}</div>
  <div class="mood-week" aria-label="This week">@for(day of data()?.week||[];track day.day){<div class="mood-day"><small>{{weekday(day.day)}}</small><span [title]="'You: '+(label(day.mine)||'—')">{{emoji(day.mine)}}</span><span [title]="partnerName()+': '+(label(day.partner)||'—')">{{emoji(day.partner)}}</span></div>}</div>
</section>`})
export class UsMood {
  api=inject(Api);moods=MOODS;data=signal<MoodDay|null>(null);note='';
  partnerName=computed(()=>this.api.partner()?.name||'Your partner');partnerMood=computed(()=>moodOf(this.data()?.partner?.mood));
  constructor(){effect(()=>{this.api.usVersion();if(this.api.pair())untracked(()=>void this.load());});}
  async load(){try{const data=await this.api.request<MoodDay>('/us/mood?day='+localDay());this.data.set(data);this.note=data.mine?.note||'';}catch{/* shown elsewhere */}}
  async pick(mood:string){try{await this.api.request('/us/mood',{day:localDay(),mood,note:this.note},'PUT');await this.load();}catch(error){this.api.error.set((error as Error).message);}}
  async saveNote(){const mood=this.data()?.mine?.mood;if(mood)await this.pick(mood);}
  emoji(id:string|null){return moodOf(id)?.emoji||'·';}label(id:string|null){return moodOf(id)?.label||'';}
  weekday(day:string){return new Intl.DateTimeFormat(undefined,{weekday:'narrow',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));}
}
