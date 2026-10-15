/** A two-player game the server referees. Add a game by writing one of these and listing it in games/index.ts
 *  (plus a board component in the app's game registry). State is plain JSON so it can be stored as-is. */
export interface GameModule<State=any> {
  id:string;title:string;description:string;emoji:string;
  /** players[0] started the game. */
  start(players:[string,string]):State;
  /** Apply a move or throw MoveError; must not change `state` in place. */
  move(state:State,player:string,move:unknown):State;
  /** What one player may see: hide anything secret (for example a pick that is not revealed yet). */
  view(state:State,viewer:string):unknown;
  status(state:State):{finished:boolean;winner:string|null;turn:string|null};
}
export class MoveError extends Error {}
export const other=(players:[string,string],player:string)=>players[0]===player?players[1]:players[0];
