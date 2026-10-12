import { randomUUID, createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import type { Server } from 'socket.io';

export type Row = Record<string, any>;
export type Identity = {id:string;name:string;email:string;coupleId:string|null;tokenHash:string;expiresAt:number};
declare global { namespace Express { interface Request { identity:Identity } } }
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (value:string) => createHash('sha256').update(value).digest('hex');

export function context(db:DatabaseSync, io:Server, uploadDir:string) {
  const one = (sql:string,...params:SQLInputValue[]):Row|undefined => db.prepare(sql).get(...params);
  const all = (sql:string,...params:SQLInputValue[]):Row[] => db.prepare(sql).all(...params);
  const run = (sql:string,...params:SQLInputValue[]) => db.prepare(sql).run(...params);
  const transaction = <T>(fn:()=>T):T => {
    db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(error){db.exec('ROLLBACK');throw error;}
  };
  const identity = (token:unknown):Identity => {
    if(typeof token!=='string'||token.length!==64) throw new HttpError(401,'Please sign in to continue.');
    const user=one(`SELECT u.id,u.name,u.email,m.couple_id AS coupleId,s.token_hash AS tokenHash,s.expires_at AS expiresAt FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN memberships m ON m.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?`,hash(token),Date.now());
    if(!user) throw new HttpError(401,'You’re signed out. Sign in to continue.');
    return user as Identity;
  };
  const authenticated:RequestHandler=(req,_res,next)=>{try{req.identity=identity(req.headers.authorization?.replace(/^Bearer /,''));next();}catch(e){next(e);}};
  const paired:RequestHandler=(req,_res,next)=>{if(!req.identity.coupleId)next(new HttpError(403,'Pair with your partner first.'));else next();};
  const owned=(table:string,resource:string,req:Request):Row=>{
    const row=one(`SELECT * FROM ${table} WHERE id=? AND couple_id=?`,resource,req.identity.coupleId);
    if(!row)throw new HttpError(404,'Item not found.'); return row;
  };
  const changed=(couple:string|null,area:string)=>{
    if(!couple)return;
    for(const socket of io.sockets.sockets.values())if(socket.data.user?.coupleId===couple){try{identity(socket.handshake.auth.token);}catch{socket.disconnect(true);}}
    io.to(`couple:${couple}`).emit('changed',{area});
  };
  return {db,io,uploadDir,one,all,run,transaction,identity,authenticated,paired,owned,changed};
}
export type Context = ReturnType<typeof context>;
