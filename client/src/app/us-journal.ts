import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { CalendarDate } from './calendar';
import { JournalEntry } from './models';

const PROMPTS=['One thing I appreciated about you this week…','You made me smile when…','I felt loved when you…','Thank you for…','Something small you did that mattered…'];

/** Gratitude notes you both read, and a private journal only you see. */
@Component({selector:'us-journal',standalone:true,imports:[FormsModule,IonIcon,CalendarDate],template:`
<section class="card us-card" aria-labelledby="journal-title">
  <div class="us-card-heading"><h2 id="journal-title">Journal</h2></div>
  <div class="segmented list-tabs us-tabs" role="tablist"><button type="button" role="tab" [class.active]="kind()==='gratitude'" [attr.aria-selected]="kind()==='gratitude'" (click)="kind.set('gratitude')">Gratitude</button><button type="button" role="tab" [class.active]="kind()==='private'" [attr.aria-selected]="kind()==='private'" (click)="kind.set('private')">Just me 🔒</button></div>
  <form class="note-form" (ngSubmit)="add()"><textarea name="entry" [(ngModel)]="text" rows="3" maxlength="2000" [attr.aria-label]="kind()==='gratitude'?'Gratitude note':'Private journal entry'" [placeholder]="kind()==='gratitude'?prompt:'Only you can read this.'"></textarea><button class="primary" type="submit" [disabled]="!text.trim()">{{kind()==='gratitude'?'Share with '+partnerName():'Save privately'}}</button></form>
  <ul class="note-list">@for(entry of visible();track entry.id){<li><span class="note-icon" aria-hidden="true">{{entry.kind==='gratitude'?'🙏':'🔒'}}</span><div><strong>{{entry.user_id===api.user()?.id?'You':entry.author_name}} · {{entry.created_at|calendarDate:'MMM d'}}</strong><p>{{entry.text}}</p></div>@if(entry.user_id===api.user()?.id){<button class="icon-button" type="button" aria-label="Delete entry" (click)="remove(entry.id)"><ion-icon name="trash-outline"></ion-icon></button>}</li>}@empty{<li class="fineprint">{{kind()==='gratitude'?'Write one thing you are grateful for. '+partnerName()+' gets a little notification.':'A private place for your thoughts.'}}</li>}</ul>
</section>`})
export class UsJournal {
  api=inject(Api);entries=signal<JournalEntry[]>([]);kind=signal<'gratitude'|'private'>('gratitude');text='';prompt=PROMPTS[new Date().getDate()%PROMPTS.length];
  partnerName=computed(()=>this.api.partner()?.name||'your partner');visible=computed(()=>this.entries().filter(entry=>entry.kind===this.kind()));
  constructor(){effect(()=>{this.api.usVersion();if(this.api.pair())untracked(()=>void this.load());});}
  async load(){try{this.entries.set(await this.api.request<JournalEntry[]>('/us/journal'));}catch{/* shown elsewhere */}}
  async add(){const text=this.text.trim();if(!text)return;try{await this.api.request('/us/journal',{kind:this.kind(),text});this.text='';await this.load();}catch(error){this.api.error.set((error as Error).message);}}
  async remove(id:string){try{await this.api.request('/us/journal/'+id,undefined,'DELETE');await this.load();}catch(error){this.api.error.set((error as Error).message);}}
}
