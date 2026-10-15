import { Router, type Request } from 'express';
import { z } from 'zod';
import { Context, HttpError, id, now, type Row } from './context.js';
import { GAMES, gameById, MoveError } from './games/index.js';

type Notify=(couple:string,user:string,kind:string,message?:string)=>Promise<void>;
/** Two-player games refereed on the server: every move is checked here, and each player only sees what they may. */
export function gamesRoutes(c:Context,notify?:Notify){
  const router=Router();router.use(c.authenticated,c.paired);
  const players=async(req:Request):Promise<[string,string]>=>{const partner=await c.one('SELECT user_id FROM memberships WHERE couple_id=? AND user_id!=?',req.identity.coupleId,req.identity.id);if(!partner)throw new HttpError(409,'Pair first.');return [req.identity.id,partner.user_id];};
  function present(row:Row,viewer:string){
    const game=gameById(row.game)!;const state=JSON.parse(row.state);const status=game.status(state);
    return {id:row.id,game:row.game,title:game.title,emoji:game.emoji,started_by:row.created_by,players:state.players,state:game.view(state,viewer),finished:status.finished,winner:status.winner,turn:status.turn,your_turn:status.turn===viewer,updated_at:row.updated_at};
  }
  const changed=(req:Request)=>c.changed(req.identity.coupleId,'games');
  async function start(req:Request,gameId:string,order:[string,string]){
    const game=gameById(gameId)!;const resource=id(),time=now();
    await c.run("INSERT INTO game_sessions VALUES(?,?,?,?,'active',NULL,?,?,?)",resource,req.identity.coupleId,game.id,JSON.stringify(game.start(order)),req.identity.id,time,time);
    await notify?.(req.identity.coupleId!,req.identity.id,'play',resource);await changed(req);
    return present((await c.one('SELECT * FROM game_sessions WHERE id=?',resource))!,req.identity.id);
  }
  const running=(req:Request,game:string)=>c.one("SELECT * FROM game_sessions WHERE couple_id=? AND game=? AND status='active'",req.identity.coupleId,game);
  router.get('/',async(req,res)=>{
    const rows=await c.all('SELECT * FROM game_sessions WHERE couple_id=? ORDER BY updated_at DESC LIMIT 60',req.identity.coupleId);
    const finished=rows.filter(row=>row.status==='finished');const me=req.identity.id;
    const record=(game:string)=>({wins:finished.filter(row=>row.game===game&&row.winner===me).length,losses:finished.filter(row=>row.game===game&&row.winner&&row.winner!==me).length,draws:finished.filter(row=>row.game===game&&!row.winner).length});
    res.json({catalog:GAMES.map(game=>({id:game.id,title:game.title,description:game.description,emoji:game.emoji,record:record(game.id)})),active:rows.filter(row=>row.status==='active').map(row=>present(row,me)),recent:finished.slice(0,10).map(row=>present(row,me))});
  });
  router.get('/:id',async(req,res)=>res.json(present(await c.owned('game_sessions',String(req.params.id),req),req.identity.id)));
  /** Start a game, or reopen the one already running for this pair. */
  router.post('/',async(req,res)=>{
    const {game:gameId}=z.object({game:z.string()}).parse(req.body);if(!gameById(gameId))throw new HttpError(400,'Unknown game.');
    const existing=await running(req,gameId);if(existing){res.json(present(existing,req.identity.id));return;}
    res.status(201).json(await start(req,gameId,await players(req)));
  });
  router.post('/:id/move',async(req,res)=>{
    const result=await c.transaction(async()=>{
      const row=await c.owned('game_sessions',String(req.params.id),req);if(row.status!=='active')throw new HttpError(409,'This game is over.');
      const game=gameById(row.game)!;let state;try{state=game.move(JSON.parse(row.state),req.identity.id,req.body?.move);}catch(error){if(error instanceof MoveError)throw new HttpError(400,error.message);throw error;}
      const status=game.status(state);await c.run('UPDATE game_sessions SET state=?,status=?,winner=?,updated_at=? WHERE id=?',JSON.stringify(state),status.finished?'finished':'active',status.winner,now(),row.id);
      return {row:(await c.one('SELECT * FROM game_sessions WHERE id=?',row.id))!,finished:status.finished};
    });
    if(result.finished)await notify?.(req.identity.coupleId!,req.identity.id,'play',`${result.row.id}:done`);
    await changed(req);res.json(present(result.row,req.identity.id));
  });
  /** Same game again, with the other person starting. */
  router.post('/:id/rematch',async(req,res)=>{
    const row=await c.owned('game_sessions',String(req.params.id),req);const existing=await running(req,row.game);if(existing){res.json(present(existing,req.identity.id));return;}
    const previous=JSON.parse(row.state).players as [string,string];res.status(201).json(await start(req,row.game,[previous[1],previous[0]]));
  });
  router.delete('/:id',async(req,res)=>{const row=await c.owned('game_sessions',String(req.params.id),req);if(row.status==='active')await c.run("UPDATE game_sessions SET status='finished',winner=NULL,updated_at=? WHERE id=?",now(),row.id);await changed(req);res.json({ok:true});});
  return router;
}
