import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from './api';
import { KnowGame, PackState, QuizResults } from './models';
import { localDay } from './us-dates';

type Quiz={id:'love-language'|'communication';title:string;intro:string;categories:Record<string,{label:string;tip:string}>;items:{prompt:string;options:{text:string;category:string}[]}[]};
/** Short, playful versions of familiar relationship quizzes; scored on the phone, only the scores are saved. */
export const QUIZZES:Quiz[]=[
  {id:'love-language',title:'Love language',intro:'Pick the one that feels more like love to you.',
   categories:{words:{label:'Words',tip:'Say it out loud: compliments, thanks, little notes.'},time:{label:'Quality time',tip:'Phones away, full attention, plans together.'},touch:{label:'Touch',tip:'Hugs, holding hands, sitting close.'},gifts:{label:'Gifts',tip:'Small surprises that show you were thinking of them.'},service:{label:'Help',tip:'Doing a chore or errand so their day is easier.'}},
   items:[
    {prompt:'Which means more?',options:[{text:'Hearing “I am proud of you”',category:'words'},{text:'A long hug',category:'touch'}]},
    {prompt:'Which means more?',options:[{text:'An evening with no phones',category:'time'},{text:'A surprise gift',category:'gifts'}]},
    {prompt:'Which means more?',options:[{text:'You make dinner for me',category:'service'},{text:'A sweet message',category:'words'}]},
    {prompt:'Which means more?',options:[{text:'Holding hands while walking',category:'touch'},{text:'A planned date',category:'time'}]},
    {prompt:'Which means more?',options:[{text:'A small souvenir from your day',category:'gifts'},{text:'You fix something for me',category:'service'}]},
    {prompt:'Which means more?',options:[{text:'A love note to find later',category:'words'},{text:'Time just talking',category:'time'}]},
    {prompt:'Which means more?',options:[{text:'A back rub',category:'touch'},{text:'You handle a task I dread',category:'service'}]},
    {prompt:'Which means more?',options:[{text:'Flowers for no reason',category:'gifts'},{text:'A compliment in front of others',category:'words'}]},
    {prompt:'Which means more?',options:[{text:'A weekend trip together',category:'time'},{text:'Cuddling on the sofa',category:'touch'}]},
    {prompt:'Which means more?',options:[{text:'You remember what I wanted',category:'gifts'},{text:'You help without being asked',category:'service'}]},
   ]},
  {id:'communication',title:'Communication style',intro:'Pick what sounds most like you.',
   categories:{direct:{label:'Direct',tip:'Get to the point; they appreciate honesty and clear next steps.'},gentle:{label:'Gentle',tip:'Start soft and reassure them before tough topics.'},thinker:{label:'Thinker',tip:'Give them time to think before expecting an answer.'},expressive:{label:'Expressive',tip:'Let them share feelings fully before solving anything.'}},
   items:[
    {prompt:'When something bothers me I…',options:[{text:'Say it straight away',category:'direct'},{text:'Hint at it kindly',category:'gentle'},{text:'Think it over first',category:'thinker'},{text:'Show how I feel',category:'expressive'}]},
    {prompt:'In an argument I need…',options:[{text:'A clear solution',category:'direct'},{text:'To feel safe',category:'gentle'},{text:'Some quiet time',category:'thinker'},{text:'To be heard',category:'expressive'}]},
    {prompt:'Good news? I…',options:[{text:'Tell you the facts',category:'direct'},{text:'Wait for a good moment',category:'gentle'},{text:'Explain every detail',category:'thinker'},{text:'Celebrate loudly',category:'expressive'}]},
    {prompt:'When you are upset I…',options:[{text:'Try to fix it',category:'direct'},{text:'Comfort you',category:'gentle'},{text:'Ask what happened',category:'thinker'},{text:'Feel it with you',category:'expressive'}]},
    {prompt:'Big decisions, I prefer…',options:[{text:'Decide quickly',category:'direct'},{text:'Agree together slowly',category:'gentle'},{text:'Compare every option',category:'thinker'},{text:'Follow my heart',category:'expressive'}]},
    {prompt:'My messages are usually…',options:[{text:'Short and clear',category:'direct'},{text:'Warm and careful',category:'gentle'},{text:'Long and detailed',category:'thinker'},{text:'Full of emojis',category:'expressive'}]},
   ]},
];

/** Play together: question packs, quizzes and "How well do you know me?". */
@Component({selector:'us-play',standalone:true,imports:[FormsModule],template:`
<section class="card us-card" aria-labelledby="packs-title">
  <div class="us-card-heading"><h2 id="packs-title">Question packs</h2></div>
  <div class="segmented list-tabs us-tabs" role="tablist">@for(pack of packs();track pack.pack){<button type="button" role="tab" [class.active]="packId()===pack.pack" [attr.aria-selected]="packId()===pack.pack" (click)="packId.set(pack.pack)">{{pack.title}}</button>}</div>
  @if(activePack();as pack){
    <p class="fineprint">{{pack.done}} of {{pack.total}} answered together</p>
    @if(pack.current;as q){<p class="question-text">{{q.question}}</p>
      @if(q.mine===null){<form class="answer-form" (ngSubmit)="answerPack(pack.pack,q.idx)"><textarea name="packAnswer" [(ngModel)]="packAnswer" aria-label="Your answer to this pack question" rows="2" maxlength="1000"></textarea><div class="us-actions">@if(q.partner_answered){<span class="fineprint">{{partnerName()}} answered. Share yours to see it.</span>}<button class="primary" type="submit" [disabled]="!packAnswer.trim()">Answer</button></div></form>}
      @else{<p class="fineprint">You answered: “{{q.mine}}”. Waiting for {{partnerName()}}.</p>}}
    @else{<p class="fineprint">You finished this pack together 🎉</p>}
    @if(pack.history.length){<details class="question-history"><summary>Your answers so far</summary>@for(item of pack.history;track item.idx){<p><strong>{{item.question}}</strong><br>You: {{item.mine}}<br>{{partnerName()}}: {{item.partner}}</p>}</details>}
  }
</section>

<section class="card us-card" aria-labelledby="know-title">
  <div class="us-card-heading"><h2 id="know-title">How well do you know me?</h2><span class="score-pill" title="Your correct guesses">{{game()?.score?.mine||0}}/{{game()?.score?.mine_total||0}}</span></div>
  @for(round of game()?.to_guess||[];track round.id){<div class="know-round"><p><strong>{{partnerName()}}:</strong> {{round.question}}</p><div class="know-options">@for(option of round.options;track $index){<button type="button" class="secondary" (click)="guess(round.id,$index)">{{option}}</button>}</div></div>}
  @if(lastResult();as r){<p class="know-result" [class.correct]="r.correct" role="status">{{r.correct?'Correct! 🎉':'Not quite — it was “'+r.answer+'”'}}</p>}
  @if(game()?.next;as next){<div class="know-round mine"><p><strong>About you:</strong> {{next.question}}</p><div class="know-options">@for(option of next.options;track $index){<button type="button" class="secondary" (click)="answerAboutMe(next.index,$index)">{{option}}</button>}</div><small class="fineprint">{{partnerName()}} will try to guess your answer.</small></div>}
  @if(game()?.waiting?.length){<p class="fineprint">{{game()!.waiting.length}} waiting for {{partnerName()}} to guess.</p>}
  @for(round of game()?.results||[];track round.id){<p class="know-history"><span aria-hidden="true">{{round.correct?'✅':'❌'}}</span>{{round.about_me?partnerName()+' guessed about you':'You guessed about '+partnerName()}}: {{round.question}} <em>{{round.options[round.answer!]}}</em></p>}
</section>

<section class="card us-card" aria-labelledby="quiz-title">
  <div class="us-card-heading"><h2 id="quiz-title">Quizzes</h2></div>
  @if(taking();as quiz){
    <p class="fineprint">{{quiz.intro}} ({{step()+1}} of {{quiz.items.length}})</p><p class="question-text">{{quiz.items[step()].prompt}}</p>
    <div class="know-options">@for(option of quiz.items[step()].options;track option.text){<button type="button" class="secondary" (click)="choose(quiz,option.category)">{{option.text}}</button>}</div>
    <button class="text-button" type="button" (click)="taking.set(null)">Stop</button>
  }@else{
    @for(quiz of quizzes;track quiz.id){<div class="quiz-result"><div class="us-card-heading"><strong>{{quiz.title}}</strong><button class="text-button" type="button" (click)="start(quiz)">{{results()?.mine?.[quiz.id]?'Retake':'Take quiz'}}</button></div>
      <div class="quiz-columns">@for(who of ['mine','partner'];track who){<div><small>{{who==='mine'?'You':partnerName()}}</small>@if(top(quiz,who);as best){<strong>{{quiz.categories[best].label}}</strong>@for(bar of bars(quiz,who);track bar.id){<div class="quiz-bar"><span>{{bar.label}}</span><i [style.width.%]="bar.percent"></i></div>}}@else{<p class="fineprint">Not taken yet</p>}</div>}</div>
      @if(top(quiz,'partner');as theirs){<p class="fineprint">💡 For {{partnerName()}}: {{quiz.categories[theirs].tip}}</p>}</div>}
  }
</section>`})
export class UsPlay {
  api=inject(Api);quizzes=QUIZZES;partnerName=computed(()=>this.api.partner()?.name||'Your partner');
  packs=signal<PackState[]>([]);packId=signal('deep');activePack=computed(()=>this.packs().find(pack=>pack.pack===this.packId())||null);packAnswer='';
  game=signal<KnowGame|null>(null);lastResult=signal<{correct:boolean;answer:string}|null>(null);results=signal<QuizResults|null>(null);
  constructor(){effect(()=>{this.api.usVersion();if(this.api.pair())untracked(()=>void this.load());});}
  async load(){try{const [packs,game,results]=await Promise.all([this.api.request<PackState[]>('/us/packs'),this.api.request<KnowGame>('/us/game'),this.api.request<QuizResults>('/us/quizzes')]);this.packs.set(packs);this.game.set(game);this.results.set(results);}catch{/* shown elsewhere */}}
  private async run(work:()=>Promise<unknown>){try{await work();await this.load();}catch(error){this.api.error.set((error as Error).message);}}
  answerPack(pack:string,idx:number){const answer=this.packAnswer.trim();if(!answer)return;this.packAnswer='';void this.run(()=>this.api.request(`/us/packs/${pack}/${idx}`,{answer}));}
  answerAboutMe(question:number,answer:number){this.lastResult.set(null);void this.run(()=>this.api.request('/us/game',{question,answer}));}
  guess(id:string,guess:number){const round=this.game()?.to_guess.find(r=>r.id===id);void this.run(async()=>{const result=await this.api.request<{correct:boolean;answer:number}>(`/us/game/${id}/guess`,{guess});this.lastResult.set({correct:result.correct,answer:round?.options[result.answer]||''});});}
  // Quizzes
  taking=signal<Quiz|null>(null);step=signal(0);private tally:Record<string,number>={};
  start(quiz:Quiz){this.tally=Object.fromEntries(Object.keys(quiz.categories).map(key=>[key,0]));this.step.set(0);this.taking.set(quiz);}
  choose(quiz:Quiz,category:string){this.tally[category]++;if(this.step()<quiz.items.length-1){this.step.update(n=>n+1);return;}this.taking.set(null);const scores={...this.tally};void this.run(()=>this.api.request(`/us/quizzes/${quiz.id}`,{scores},'PUT'));}
  private scores(quiz:Quiz,who:string){return this.results()?.[who as 'mine'|'partner']?.[quiz.id]?.scores;}
  top(quiz:Quiz,who:string){const scores=this.scores(quiz,who);if(!scores)return null;return Object.entries(scores).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;}
  bars(quiz:Quiz,who:string){const scores=this.scores(quiz,who)||{};const total=Object.values(scores).reduce((a,b)=>a+b,0)||1;return Object.keys(quiz.categories).map(id=>({id,label:quiz.categories[id].label,percent:Math.round((scores[id]||0)*100/total)}));}
}
