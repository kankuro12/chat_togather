import { Component, Type, computed, inject, input } from '@angular/core';
import { GameSession } from '../models';
import { GamesStore } from './store';

/** Tic-tac-toe: the starter is ❌, the other player ⭕. */
@Component({selector:'game-tic-tac-toe',standalone:true,template:`
<div class="ttt-board" role="grid" aria-label="Tic-tac-toe board">@for(cell of session().state.board;track $index){<button type="button" role="gridcell" class="ttt-cell" [class.win]="session().state.line?.includes($index)" [disabled]="!!cell||!session().your_turn||store.busy()" [attr.aria-label]="'Square '+($index+1)+(cell?(cell===session().players[0]?', cross':', nought'):', empty')" (click)="store.move({cell:$index})">{{cell?(cell===session().players[0]?'❌':'⭕'):''}}</button>}</div>`})
export class TicTacToeBoard {session=input.required<GameSession>();store=inject(GamesStore);}

/** Connect Four: tap a column to drop your disc. */
@Component({selector:'game-connect-four',standalone:true,template:`
<div class="c4-board" role="grid" aria-label="Connect Four board">@for(column of session().state.board;track $index;let c=$index){<button type="button" class="c4-column" [disabled]="!session().your_turn||column[5]!==null||store.busy()" [attr.aria-label]="'Drop in column '+(c+1)" (click)="store.move({column:c})">@for(row of rows;track row){<span class="c4-slot"><i [class.mine]="column[row]===me()" [class.theirs]="column[row]&&column[row]!==me()" [class.last]="session().state.last?.[0]===c&&session().state.last?.[1]===row"></i></span>}</button>}</div>`})
export class ConnectFourBoard {session=input.required<GameSession>();store=inject(GamesStore);rows=[5,4,3,2,1,0];me=computed(()=>this.store.me());}

/** Rock paper scissors, best of five: picks stay hidden until both have chosen. */
@Component({selector:'game-rock-paper-scissors',standalone:true,template:`
<div class="rps">
  <p class="rps-score"><strong>You {{session().state.score[me()]||0}}</strong> · <strong>{{store.partnerName()}} {{session().state.score[partner()]||0}}</strong> <small>(first to 3)</small></p>
  @if(!session().finished){@if(session().state.picks.mine;as pick){<p class="fineprint" role="status">You picked {{emoji[pick]}}. @if(session().state.picks.partner_picked){Revealing…}@else{Waiting for {{store.partnerName()}}…}</p>}
  @else{<div class="rps-picks">@for(pick of picks;track pick){<button type="button" class="rps-pick" [attr.aria-label]="pick" [disabled]="store.busy()" (click)="store.move({pick})">{{emoji[pick]}}</button>}</div>@if(session().state.picks.partner_picked){<p class="fineprint">{{store.partnerName()}} has picked. Your turn!</p>}}}
  <ol class="rps-rounds" reversed>@for(round of rounds();track $index){<li>{{emoji[round.picks[me()]]}} vs {{emoji[round.picks[partner()]]}} · {{round.winner===me()?'You won':round.winner?store.partnerName()+' won':'Draw'}}</li>}</ol>
</div>`})
export class RockPaperScissorsBoard {
  session=input.required<GameSession>();store=inject(GamesStore);picks=['rock','paper','scissors'];emoji:Record<string,string>={rock:'✊',paper:'✋',scissors:'✌️'};
  me=computed(()=>this.store.me());partner=computed(()=>this.session().players.find(p=>p!==this.me())||'');rounds=computed(()=>[...this.session().state.rounds].reverse());
}

/** Board for each game the server offers. To add a game: write its rules on the server (server/src/games) and its board here. */
export const BOARDS:Record<string,Type<unknown>>={'tic-tac-toe':TicTacToeBoard,'connect-four':ConnectFourBoard,'rock-paper-scissors':RockPaperScissorsBoard};
