import { Injectable, inject, signal } from '@angular/core';
import { Api } from '../api';
import { GameLobby, GameSession } from '../models';

/** Shared by the games page and every board: the lobby, the open game, and sending moves. */
@Injectable({providedIn:'root'})
export class GamesStore {
  private api=inject(Api);lobby=signal<GameLobby|null>(null);current=signal<GameSession|null>(null);busy=signal(false);
  me(){return this.api.user()?.id||'';}
  partnerName(){return this.api.partner()?.name||'Your partner';}
  async load(){
    const token=this.api.token;const lobby=await this.api.request<GameLobby>('/games');if(token!==this.api.token)return;this.lobby.set(lobby);
    const open=this.current();if(open)this.current.set(await this.api.request<GameSession>('/games/'+open.id));
  }
  async play(game:string){await this.run(async()=>this.current.set(await this.api.request<GameSession>('/games',{game})));}
  open(session:GameSession){this.current.set(session);}
  close(){this.current.set(null);void this.load().catch(()=>{});}
  /** Every board sends its move through here; the server checks it and returns the new state. */
  async move(move:unknown){const session=this.current();if(!session)return;await this.run(async()=>this.current.set(await this.api.request<GameSession>(`/games/${session.id}/move`,{move})));}
  async rematch(){const session=this.current();if(!session)return;await this.run(async()=>this.current.set(await this.api.request<GameSession>(`/games/${session.id}/rematch`,{})));}
  async end(){const session=this.current();if(!session)return;await this.run(async()=>{await this.api.request('/games/'+session.id,undefined,'DELETE');this.close();});}
  private async run(work:()=>Promise<void>){if(this.busy())return;this.busy.set(true);try{await work();}catch(error){this.api.error.set((error as Error).message);}finally{this.busy.set(false);}}
}
