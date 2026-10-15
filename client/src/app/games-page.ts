import { Component, computed, effect, inject, untracked } from '@angular/core';
import { NgComponentOutlet } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';
import { Api } from './api';
import { GamesStore } from './games/store';
import { BOARDS } from './games/boards';
import { GameSession } from './models';

/** Two-player games for the two of you. Boards come from the registry in games/boards.ts. */
@Component({selector:'games-page',standalone:true,imports:[NgComponentOutlet,IonIcon],template:`
@if(store.current();as session){
  <div class="page-heading game-heading"><button type="button" class="icon-button" aria-label="Back to games" title="Back" (click)="store.close()"><ion-icon name="arrow-back-outline"></ion-icon></button><div><h1>{{session.emoji}} {{session.title}}</h1><p role="status" class="game-status" [class.your-turn]="session.your_turn">{{status(session)}}</p></div></div>
  <section class="card game-board">@if(board(session.game);as component){<ng-container *ngComponentOutlet="component;inputs:{session}"></ng-container>}@else{<p class="fineprint">Update Together to play this game.</p>}</section>
  <div class="us-actions game-actions">@if(session.finished){<button class="primary" type="button" (click)="store.rematch()" [disabled]="store.busy()">Rematch</button>}@else{<button class="text-button danger" type="button" (click)="store.end()">End game</button>}</div>
}@else{
  <div class="page-heading"><div><h1>Games</h1><p>Play together, live, wherever you are.</p></div></div>
  @if(yourTurn().length){<section class="card us-card"><h2>Your turn</h2>@for(session of yourTurn();track session.id){<button type="button" class="game-row turn" (click)="store.open(session)"><span aria-hidden="true">{{session.emoji}}</span><strong>{{session.title}}</strong><span class="score-pill">Play</span></button>}</section>}
  <div class="games-grid">@for(game of store.lobby()?.catalog||[];track game.id){<article class="card game-card"><span class="game-emoji" aria-hidden="true">{{game.emoji}}</span><h2>{{game.title}}</h2><p>{{game.description}}</p><small>You {{game.record.wins}} · {{partnerName()}} {{game.record.losses}}@if(game.record.draws){ · {{game.record.draws}} draws}</small><button class="primary" type="button" [disabled]="store.busy()" (click)="store.play(game.id)">{{running(game.id)?'Continue':'Play with '+partnerName()}}</button></article>}</div>
  @if(store.lobby()?.recent?.length){<section class="card us-card"><h2>Recent games</h2>@for(session of store.lobby()!.recent;track session.id){<p class="game-row"><span aria-hidden="true">{{session.emoji}}</span>{{session.title}} · {{session.winner===store.me()?'You won 🏆':session.winner?partnerName()+' won':'Draw'}}</p>}</section>}
}`})
export class GamesPage {
  api=inject(Api);store=inject(GamesStore);partnerName=computed(()=>this.api.partner()?.name||'Your partner');
  yourTurn=computed(()=>(this.store.lobby()?.active||[]).filter(session=>session.your_turn||(session.game==='rock-paper-scissors'&&!session.state?.picks?.mine)));
  constructor(){effect(()=>{this.api.gamesVersion();if(this.api.pair())untracked(()=>void this.store.load().catch(()=>{}));});}
  board(id:string){return BOARDS[id]||null;}
  running(id:string){return (this.store.lobby()?.active||[]).some(session=>session.game===id);}
  status(session:GameSession){
    if(session.finished)return session.winner===this.store.me()?'You won! 🏆':session.winner?`${this.partnerName()} won`:'It’s a draw';
    if(session.game==='rock-paper-scissors')return 'Pick at the same time';
    return session.your_turn?'Your turn':`${this.partnerName()}’s turn`;
  }
}
