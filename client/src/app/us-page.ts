import { Component, DestroyRef, ElementRef, ViewChild, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { CalendarDate } from './calendar';
import { UsMood } from './us-mood';
import { UsTogether } from './us-together';
import { UsPlay } from './us-play';
import { UsJournal } from './us-journal';
import { localDay, dayNumber, nextOccurrence, together } from './us-dates';
import { SpecialDate, SharedList, Wish, DailyQuestion, QuestionHistory, LoveNote, Nudge } from './models';

const KIND_ICON:Record<string,string>={together:'💞',anniversary:'💍',birthday:'🎂',other:'⭐'};

@Component({selector:'us-page',standalone:true,imports:[FormsModule,IonIcon,CalendarDate,UsMood,UsTogether,UsPlay,UsJournal],template:`
<div class="page-heading us-heading"><div><h1>Us</h1><p>@if(togetherFor()){Together for {{togetherFor()}}}@else{Your little corner, just for two}</p></div><button class="primary nudge-button" type="button" (click)="nudge()" [disabled]="nudging()"><span aria-hidden="true">💗</span>{{nudged()?'Sent!':'Thinking of you'}}</button></div>
@if(lastNudge();as last){<p class="nudge-note" role="status">💗 {{last.name}} thought of you {{ago(last.created_at)}}</p>}
<div class="segmented us-sections" role="tablist" aria-label="Us sections">@for(item of tabs;track item.id){<button type="button" role="tab" [class.active]="tab()===item.id" [attr.aria-selected]="tab()===item.id" (click)="setTab(item.id)">{{item.label}}</button>}</div>
@switch(tab()){
@case('today'){<div class="us-grid">
  <section class="card us-card us-question" aria-labelledby="question-title">
    <div class="us-card-heading"><h2 id="question-title">Today’s question</h2>@if(streak()){<span class="score-pill" title="Days in a row you both answered">🔥 {{streak()}}</span>}<button class="text-button" type="button" (click)="toggleHistory()" [attr.aria-expanded]="showHistory()">{{showHistory()?'Hide past answers':'Past answers'}}</button></div>
    @if(question();as q){<p class="question-text">{{q.question}}</p>
      @if(q.mine===null||editingAnswer()){<form class="answer-form" (ngSubmit)="answer()"><textarea name="answer" [(ngModel)]="answerText" aria-label="Your answer" maxlength="1000" rows="3" placeholder="Your answer…"></textarea><div class="us-actions">@if(q.partner_answered&&q.mine===null){<span class="fineprint">{{partnerName()}} answered. Share yours to see it.</span>}<button class="primary" type="submit" [disabled]="!answerText.trim()||busy()">Share answer</button></div></form>}
      @else{<div class="answers"><div class="answer mine"><strong>You</strong><p>{{q.mine}}</p><button class="text-button" type="button" (click)="editAnswer()">Edit</button></div><div class="answer"><strong>{{partnerName()}}</strong><p>{{q.partner??'Not answered yet'}}</p></div></div>}}
    @else{<p class="fineprint" role="status">Loading…</p>}
    @if(showHistory()){<div class="question-history">@for(past of history();track past.day){<details><summary><span>{{past.day|calendarDate:'MMM d'}}</span>{{past.question}}</summary>@for(answer of past.answers;track answer.user_id){<p><strong>{{answer.user_id===api.user()?.id?'You':answer.name}}:</strong> {{answer.answer}}</p>}</details>}@empty{<p class="fineprint">Answers you both share appear here.</p>}</div>}
  </section>
  <us-mood></us-mood>
  <us-together></us-together>
</div>}
@case('play'){<div class="us-grid"><us-play></us-play></div>}
@case('plans'){<div class="us-grid">
  <section class="card us-card" aria-labelledby="dates-title">
    <div class="us-card-heading"><h2 id="dates-title">Special dates</h2><button class="icon-button" type="button" aria-label="Add special date" title="Add special date" (click)="openDate()"><ion-icon name="add-outline"></ion-icon></button></div>
    @for(item of upcoming();track item.date.id){<div class="special-date"><span class="date-icon" aria-hidden="true">{{icon(item.date.kind)}}</span><div><strong>{{item.date.title}}</strong><small>{{item.date.date|calendarDate:'MMM d, y'}}@if(item.years>0){ · {{item.years}} {{item.years===1?'year':'years'}}}</small></div><span class="countdown" [class.today]="item.days===0">{{countdown(item.days)}}</span><button class="icon-button" type="button" [attr.aria-label]="'Edit '+item.date.title" (click)="openDate(item.date)"><ion-icon name="create-outline"></ion-icon></button></div>}
    @empty{<p class="fineprint">Add when you got together, birthdays and anniversaries. You both get a reminder on the day.</p>}
  </section>
  <section class="card us-card" aria-labelledby="lists-title">
    <div class="us-card-heading"><h2 id="lists-title">Lists</h2><button class="icon-button" type="button" aria-label="New list" title="New list" (click)="creatingList.set(!creatingList())" [attr.aria-expanded]="creatingList()"><ion-icon name="add-outline"></ion-icon></button></div>
    @if(creatingList()){<form class="inline-add" (ngSubmit)="newList(listTitle)"><input name="listTitle" [(ngModel)]="listTitle" aria-label="List name" placeholder="List name, e.g. Weekend to-do" maxlength="60" autocomplete="off"><button class="secondary" type="submit" [disabled]="!listTitle.trim()">Create</button></form>}
    @if(lists().length){<div class="segmented list-tabs us-tabs" role="tablist">@for(list of lists();track list.id){<button type="button" role="tab" [class.active]="activeList()?.id===list.id" [attr.aria-selected]="activeList()?.id===list.id" (click)="listId.set(list.id)">{{list.title}}</button>}</div>}
    <form class="inline-add" (ngSubmit)="addItem(activeList())"><input name="item" [(ngModel)]="itemText" [attr.aria-label]="'Add to '+(activeList()?.title||'your list')" placeholder="Add an item, e.g. Milk" maxlength="160" autocomplete="off"><button class="secondary" type="submit" [disabled]="!itemText.trim()||busy()">Add</button></form>
    @if(activeList();as list){
      <ul class="check-list">@for(item of list.items;track item.id){<li [class.done]="item.done"><label><input type="checkbox" [checked]="item.done" (change)="toggleItem(item.id,$any($event.target).checked)"><span>{{item.title}}</span></label><button class="icon-button" type="button" [attr.aria-label]="'Remove '+item.title" (click)="removeItem(item.id)"><ion-icon name="close-outline"></ion-icon></button></li>}@empty{<li class="fineprint">Nothing here yet.</li>}</ul>
      <div class="us-actions">@if(doneCount(list)){<button class="text-button" type="button" (click)="clearDone(list)">Clear {{doneCount(list)}} done</button>}<button class="text-button danger" type="button" (click)="deleteList(list)">{{confirmList()===list.id?'Tap again to delete list':'Delete list'}}</button></div>}
    @else{<p class="fineprint">Groceries, chores, things to do this weekend: one list you both can tick off.</p>}
  </section>
  <section class="card us-card" aria-labelledby="wishes-title">
    <div class="us-card-heading"><h2 id="wishes-title">Wishlist</h2></div>
    <div class="segmented list-tabs us-tabs" role="tablist"><button type="button" role="tab" [class.active]="wishTab()==='mine'" [attr.aria-selected]="wishTab()==='mine'" (click)="wishTab.set('mine')">Your wishes</button><button type="button" role="tab" [class.active]="wishTab()==='theirs'" [attr.aria-selected]="wishTab()==='theirs'" (click)="wishTab.set('theirs')">{{partnerName()}}’s</button></div>
    @if(wishTab()==='mine'){
      <form class="wish-form" (ngSubmit)="addWish()"><input name="wish" [(ngModel)]="wishTitle" aria-label="Wish" placeholder="Something you’d love" maxlength="160" autocomplete="off"><input name="link" [(ngModel)]="wishLink" aria-label="Link (optional)" placeholder="Link (optional)" type="url" maxlength="500"><button class="secondary" type="submit" [disabled]="!wishTitle.trim()">Add wish</button></form>
      <ul class="wish-list">@for(wish of myWishes();track wish.id){<li><div><strong>{{wish.title}}</strong>@if(wish.link){<a [href]="wish.link" target="_blank" rel="noopener noreferrer">{{host(wish.link)}}</a>}</div><button class="icon-button" type="button" [attr.aria-label]="'Remove '+wish.title" (click)="removeWish(wish.id)"><ion-icon name="trash-outline"></ion-icon></button></li>}@empty{<li class="fineprint">{{partnerName()}} can secretly mark what they’ll get you. You’ll never see it.</li>}</ul>}
    @else{<ul class="wish-list">@for(wish of theirWishes();track wish.id){<li [class.claimed]="wish.claimed"><div><strong>{{wish.title}}</strong>@if(wish.link){<a [href]="wish.link" target="_blank" rel="noopener noreferrer">{{host(wish.link)}}</a>}@if(wish.claimed){<small>{{wish.claimed_by_me?'You’re getting this 🤫':'Someone is getting this'}}</small>}</div><button class="secondary" type="button" [attr.aria-pressed]="!!wish.claimed_by_me" (click)="claim(wish)" [disabled]="wish.claimed&&!wish.claimed_by_me">{{wish.claimed_by_me?'Undo':'I’ll get this'}}</button></li>}@empty{<li class="fineprint">{{partnerName()}} hasn’t added any wishes yet.</li>}</ul>}
  </section>
</div>}
@case('notes'){<div class="us-grid">
  <section class="card us-card us-notes" aria-labelledby="notes-title">
    <div class="us-card-heading"><h2 id="notes-title">Love notes</h2></div>
    <form class="note-form" (ngSubmit)="sendNote()"><textarea name="note" [(ngModel)]="noteText" aria-label="Love note" rows="3" maxlength="4000" placeholder="Write something to open later…"></textarea><label>Opens on<input name="unlock" type="datetime-local" [(ngModel)]="noteUnlock" [min]="minUnlock"></label><button class="primary" type="submit" [disabled]="!noteText.trim()||!noteUnlock||busy()">Seal note</button></form>
    <ul class="note-list">@for(note of notes();track note.id){<li [class.sealed]="note.locked&&!mine(note)"><span class="note-icon" aria-hidden="true">{{note.locked?'💌':'💖'}}</span><div>@if(mine(note)){<strong>To {{partnerName()}} · {{note.locked?'opens '+(note.unlock_at|calendarDate:'MMM d, y'):'opened'}}</strong><p>{{note.text}}</p>}@else if(note.locked){<strong>Sealed note from {{note.author_name}}</strong><p class="fineprint">Opens {{note.unlock_at|calendarDate:'MMM d, y'}} · {{countdown(daysUntil(note.unlock_at))}}</p>}@else{<strong>From {{note.author_name}}</strong><p>{{note.text}}</p>}</div>@if(mine(note)){<button class="icon-button" type="button" aria-label="Delete note" (click)="deleteNote(note.id)"><ion-icon name="trash-outline"></ion-icon></button>}</li>}@empty{<li class="fineprint">Seal a note for a birthday, an anniversary or a hard day ahead. It stays hidden until then.</li>}</ul>
  </section>
  <us-journal></us-journal>
</div>}
}

<dialog #dateDialog class="modal" aria-labelledby="date-title"><form (ngSubmit)="saveDate()"><div class="modal-heading"><h2 id="date-title">{{editingDate()?'Edit date':'New special date'}}</h2><button type="button" class="icon-button" aria-label="Close" (click)="dateDialog.close()"><ion-icon name="close-outline"></ion-icon></button></div>
  <label>What is it?<select name="kind" [(ngModel)]="dateKind"><option value="together">When we got together</option><option value="anniversary">Anniversary</option><option value="birthday">Birthday</option><option value="other">Something else</option></select></label>
  <label>Title<input name="title" [(ngModel)]="dateTitle" required maxlength="80" [placeholder]="dateKind==='birthday'?'Asha’s birthday':'Our first date'"></label>
  <label>Date<input name="date" type="date" [(ngModel)]="dateValue" required></label>
  @if(dateKind==='other'){<label class="checkbox-label"><input name="yearly" type="checkbox" [(ngModel)]="dateYearly">Repeat every year</label>}
  <div class="modal-actions">@if(editingDate();as d){<button type="button" class="text-button danger" (click)="deleteDate(d)">{{confirmDate()?'Tap again to delete':'Delete'}}</button>}<button class="primary" type="submit" [disabled]="!dateTitle.trim()||!dateValue||busy()">Save</button></div></form></dialog>
`})
export class UsPage {
  api=inject(Api);busy=signal(false);
  tabs=[{id:'today',label:'Today'},{id:'play',label:'Play'},{id:'plans',label:'Plans'},{id:'notes',label:'Notes'}];
  tab=signal(((()=>{try{return localStorage.getItem('together.usTab');}catch{return null;}})())||'today');
  setTab(id:string){this.tab.set(id);try{localStorage.setItem('together.usTab',id);}catch{/* storage blocked */}}
  streak=signal(0);
  partnerName=computed(()=>this.api.partner()?.name||'Your partner');
  dates=signal<SpecialDate[]>([]);lists=signal<SharedList[]>([]);wishes=signal<Wish[]>([]);question=signal<DailyQuestion|null>(null);history=signal<QuestionHistory[]>([]);notes=signal<LoveNote[]>([]);nudges=signal<Nudge[]>([]);
  today=signal(localDay());
  constructor(){
    effect(()=>{this.api.usVersion();if(this.api.pair())untracked(()=>void this.load());});
    // Roll over to the new day's question if the page stays open past midnight.
    const timer=setInterval(()=>{if(this.today()!==localDay()){this.today.set(localDay());void this.load();}},60000);
    inject(DestroyRef).onDestroy(()=>clearInterval(timer));
  }
  private async run<T>(work:()=>Promise<T>){this.busy.set(true);this.api.error.set('');try{return await work();}catch(error){this.api.error.set((error as Error).message);return undefined;}finally{this.busy.set(false);}}
  async load(){
    const token=this.api.token,day=this.today();
    try{
      const [dates,lists,wishes,question,notes,nudges]=await Promise.all([this.api.request<SpecialDate[]>('/us/dates'),this.api.request<SharedList[]>('/us/lists'),this.api.request<Wish[]>('/us/wishes'),this.api.request<DailyQuestion>('/us/question?day='+day),this.api.request<LoveNote[]>('/us/notes'),this.api.request<Nudge[]>('/us/nudges')]);
      if(token!==this.api.token)return;
      void this.api.request<{streak:number}>('/us/streak?day='+day).then(result=>{if(token===this.api.token)this.streak.set(result.streak);}).catch(()=>{});
      this.dates.set(dates);this.lists.set(lists);this.wishes.set(wishes);this.question.set(question);this.notes.set(notes);this.nudges.set(nudges);
      if(this.showHistory())this.history.set(await this.api.request<QuestionHistory[]>('/us/question/history'));
    }catch(error){this.api.error.set((error as Error).message);}
  }
  // Together for / thinking of you
  togetherFor=computed(()=>{const start=this.dates().find(date=>date.kind==='together');return start?together(start.date,this.today()):'';});
  nudging=signal(false);nudged=signal(false);
  lastNudge=computed(()=>this.nudges().find(nudge=>nudge.user_id!==this.api.user()?.id)||null);
  async nudge(){this.nudging.set(true);try{await this.api.request('/us/nudge',{});this.nudged.set(true);setTimeout(()=>this.nudged.set(false),2500);}catch(error){this.api.error.set((error as Error).message);}finally{this.nudging.set(false);}}
  ago(time:string){const minutes=Math.round((Date.now()-Date.parse(time))/60000);if(minutes<1)return 'just now';if(minutes<60)return `${minutes} min ago`;const hours=Math.round(minutes/60);if(hours<24)return `${hours} h ago`;const days=Math.round(hours/24);return `${days} day${days===1?'':'s'} ago`;}
  // Daily question
  answerText='';editingAnswer=signal(false);showHistory=signal(false);
  editAnswer(){this.answerText=this.question()?.mine||'';this.editingAnswer.set(true);}
  async answer(){const result=await this.run(()=>this.api.request<DailyQuestion>('/us/question?day='+this.today(),{answer:this.answerText}));if(result){this.question.set(result);this.answerText='';this.editingAnswer.set(false);}}
  async toggleHistory(){this.showHistory.update(value=>!value);if(this.showHistory())this.history.set(await this.api.request<QuestionHistory[]>('/us/question/history').catch(()=>[]));}
  // Special dates
  upcoming=computed(()=>this.dates().map(date=>{const next=nextOccurrence(date.date,this.today(),!!date.yearly);return {date,next,days:next?dayNumber(next)-dayNumber(this.today()):Infinity,years:next?Number(next.slice(0,4))-Number(date.date.slice(0,4)):0};}).sort((a,b)=>a.days-b.days));
  icon(kind:string){return KIND_ICON[kind]||'⭐';}
  countdown(days:number){if(!Number.isFinite(days))return 'Past';if(days===0)return 'Today 🎉';if(days===1)return 'Tomorrow';return `in ${days} days`;}
  @ViewChild('dateDialog') dateDialog!:ElementRef<HTMLDialogElement>;editingDate=signal<SpecialDate|null>(null);confirmDate=signal(false);
  dateKind:SpecialDate['kind']='birthday';dateTitle='';dateValue='';dateYearly=true;
  openDate(date?:SpecialDate){this.editingDate.set(date||null);this.confirmDate.set(false);this.dateKind=date?.kind||(this.dates().some(d=>d.kind==='together')?'birthday':'together');this.dateTitle=date?.title||'';this.dateValue=date?.date||'';this.dateYearly=date?!!date.yearly:true;this.dateDialog.nativeElement.showModal();}
  async saveDate(){const body={title:this.dateTitle,date:this.dateValue,kind:this.dateKind,yearly:this.dateKind!=='other'||this.dateYearly,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone};const editing=this.editingDate();
    if(await this.run(()=>editing?this.api.request('/us/dates/'+editing.id,body,'PUT'):this.api.request('/us/dates',body))){this.dateDialog.nativeElement.close();await this.load();}}
  async deleteDate(date:SpecialDate){if(!this.confirmDate()){this.confirmDate.set(true);return;}if(await this.run(()=>this.api.request('/us/dates/'+date.id,undefined,'DELETE'))){this.dateDialog.nativeElement.close();await this.load();}}
  // Lists
  listId=signal('');activeList=computed<SharedList|null>(()=>this.lists().find(list=>list.id===this.listId())||this.lists()[0]||null);itemText='';confirmList=signal('');
  doneCount(list:SharedList){return list.items.filter(item=>item.done).length;}
  creatingList=signal(false);listTitle='';
  async newList(title:string){const name=title.trim();if(!name)return;const created=await this.run(()=>this.api.request<SharedList>('/us/lists',{title:name}));if(created){this.listId.set(created.id);this.listTitle='';this.creatingList.set(false);await this.load();}}
  /** No list yet? The first item creates one, so adding never needs an extra step. */
  async addItem(list:SharedList|null){const title=this.itemText.trim();if(!title)return;this.itemText='';
    const added=await this.run(async()=>{const id=list?.id||(await this.api.request<SharedList>('/us/lists',{title:'Our list'})).id;if(!list)this.listId.set(id);return this.api.request(`/us/lists/${id}/items`,{title});});if(added)await this.load();}
  async toggleItem(id:string,done:boolean){this.lists.update(lists=>lists.map(list=>({...list,items:list.items.map(item=>item.id===id?{...item,done}:item)})));await this.run(()=>this.api.request('/us/items/'+id,{done},'PATCH'));await this.load();}
  async removeItem(id:string){if(await this.run(()=>this.api.request('/us/items/'+id,undefined,'DELETE')))await this.load();}
  async clearDone(list:SharedList){if(await this.run(()=>this.api.request(`/us/lists/${list.id}/clear-done`,{})))await this.load();}
  async deleteList(list:SharedList){if(this.confirmList()!==list.id){this.confirmList.set(list.id);return;}this.confirmList.set('');if(await this.run(()=>this.api.request('/us/lists/'+list.id,undefined,'DELETE'))){this.listId.set('');await this.load();}}
  // Wishes
  wishTab=signal<'mine'|'theirs'>('mine');wishTitle='';wishLink='';
  myWishes=computed(()=>this.wishes().filter(wish=>wish.user_id===this.api.user()?.id));theirWishes=computed(()=>this.wishes().filter(wish=>wish.user_id!==this.api.user()?.id));
  host(link:string){try{return new URL(link).hostname.replace(/^www\./,'');}catch{return link;}}
  async addWish(){const body={title:this.wishTitle,link:this.wishLink.trim()};if(await this.run(()=>this.api.request('/us/wishes',body))){this.wishTitle='';this.wishLink='';await this.load();}}
  async removeWish(id:string){if(await this.run(()=>this.api.request('/us/wishes/'+id,undefined,'DELETE')))await this.load();}
  async claim(wish:Wish){if(await this.run(()=>this.api.request(`/us/wishes/${wish.id}/claim`,{claimed:!wish.claimed_by_me},'PUT')))await this.load();}
  // Love notes
  noteText='';noteUnlock='';minUnlock=localDay()+'T00:00';
  mine(note:LoveNote){return note.user_id===this.api.user()?.id;}
  daysUntil(time:string){return Math.max(0,dayNumber(localDay(new Date(time)))-dayNumber(this.today()));}
  async sendNote(){const unlock=new Date(this.noteUnlock);if(Number.isNaN(unlock.getTime())||unlock.getTime()<=Date.now()){this.api.error.set('Choose a time in the future.');return;}
    if(await this.run(()=>this.api.request('/us/notes',{text:this.noteText,unlock_at:unlock.toISOString()}))){this.noteText='';this.noteUnlock='';await this.load();}}
  async deleteNote(id:string){if(await this.run(()=>this.api.request('/us/notes/'+id,undefined,'DELETE')))await this.load();}
}
