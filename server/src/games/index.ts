import { GameModule, MoveError, other } from './types.js';
export { MoveError } from './types.js';

type Players=[string,string];
const lines=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

/** Tic-tac-toe: the starter plays X and moves first. */
const ticTacToe:GameModule<{players:Players;board:(string|null)[];turn:string;winner:string|null;line:number[]|null}>={
  id:'tic-tac-toe',title:'Tic-tac-toe',emoji:'❌',description:'Three in a row wins.',
  start:players=>({players,board:Array(9).fill(null),turn:players[0],winner:null,line:null}),
  move(state,player,move){
    const cell=typeof move==='object'&&move!==null?(move as {cell?:unknown}).cell:undefined;
    if(state.winner||state.board.every(Boolean))throw new MoveError('This game is over.');if(state.turn!==player)throw new MoveError('Wait for your turn.');
    if(typeof cell!=='number'||!Number.isInteger(cell)||cell<0||cell>8||state.board[cell])throw new MoveError('Pick an empty square.');
    const board=[...state.board];board[cell]=player;const line=lines.find(l=>l.every(i=>board[i]===player))||null;
    return {...state,board,line,winner:line?player:null,turn:other(state.players,player)};
  },
  view:state=>state,
  status:state=>({finished:!!state.winner||state.board.every(Boolean),winner:state.winner,turn:state.winner||state.board.every(Boolean)?null:state.turn}),
};

/** Connect Four on a 7×6 board: drop a disc in a column; four in a row in any direction wins. */
const connectFour:GameModule<{players:Players;board:(string|null)[][];turn:string;winner:string|null;last:[number,number]|null;moves:number}>={
  id:'connect-four',title:'Connect Four',emoji:'🔴',description:'Drop discs; four in a row wins.',
  start:players=>({players,board:Array.from({length:7},()=>Array(6).fill(null)),turn:players[0],winner:null,last:null,moves:0}),
  move(state,player,move){
    const column=typeof move==='object'&&move!==null?(move as {column?:unknown}).column:undefined;
    if(state.winner||state.moves>=42)throw new MoveError('This game is over.');if(state.turn!==player)throw new MoveError('Wait for your turn.');
    if(typeof column!=='number'||!Number.isInteger(column)||column<0||column>6)throw new MoveError('Pick a column.');
    const row=state.board[column].indexOf(null);if(row<0)throw new MoveError('That column is full.');
    const board=state.board.map(col=>[...col]);board[column][row]=player;
    const count=(dc:number,dr:number)=>{let n=0,c=column+dc,r=row+dr;while(c>=0&&c<7&&r>=0&&r<6&&board[c][r]===player){n++;c+=dc;r+=dr;}return n;};
    const won=[[1,0],[0,1],[1,1],[1,-1]].some(([dc,dr])=>1+count(dc,dr)+count(-dc,-dr)>=4);
    return {...state,board,last:[column,row],moves:state.moves+1,winner:won?player:null,turn:other(state.players,player)};
  },
  view:state=>state,
  status:state=>({finished:!!state.winner||state.moves>=42,winner:state.winner,turn:state.winner||state.moves>=42?null:state.turn}),
};

type Pick='rock'|'paper'|'scissors';
const beats:Record<Pick,Pick>={rock:'scissors',paper:'rock',scissors:'paper'};
/** Rock-paper-scissors, best of five: both pick in secret; picks are revealed together. */
const rockPaperScissors:GameModule<{players:Players;picks:Record<string,Pick|null>;rounds:{picks:Record<string,Pick>;winner:string|null}[];score:Record<string,number>;winner:string|null}>={
  id:'rock-paper-scissors',title:'Rock Paper Scissors',emoji:'✊',description:'Best of five. Picks are revealed together.',
  start:players=>({players,picks:{[players[0]]:null,[players[1]]:null},rounds:[],score:{[players[0]]:0,[players[1]]:0},winner:null}),
  move(state,player,move){
    const pick=typeof move==='object'&&move!==null?(move as {pick?:unknown}).pick:undefined;
    if(state.winner)throw new MoveError('This game is over.');if(pick!=='rock'&&pick!=='paper'&&pick!=='scissors')throw new MoveError('Pick rock, paper or scissors.');
    if(state.picks[player])throw new MoveError('Wait for your partner to pick.');
    const picks={...state.picks,[player]:pick as Pick};const [a,b]=state.players;
    if(!picks[a]||!picks[b])return {...state,picks};
    const roundWinner=picks[a]===picks[b]?null:beats[picks[a]!]===picks[b]?a:b;const score={...state.score};if(roundWinner)score[roundWinner]++;
    return {...state,picks:{[a]:null,[b]:null},rounds:[...state.rounds,{picks:{[a]:picks[a]!,[b]:picks[b]!},winner:roundWinner}],score,winner:score[a]>=3?a:score[b]>=3?b:null};
  },
  // Your own pick shows straight away; your partner's only appears once the round is revealed.
  view:(state,viewer)=>({...state,picks:{mine:state.picks[viewer],partner_picked:!!state.picks[other(state.players,viewer)]}}),
  status:state=>({finished:!!state.winner,winner:state.winner,turn:null}),
};

export const GAMES:GameModule[]=[ticTacToe,connectFour,rockPaperScissors];
export const gameById=(id:string)=>GAMES.find(game=>game.id===id);
