import { randomUUID, createHash } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { Database, SQLInputValue } from './db.js';
import type { Server } from 'socket.io';
import {createStorage,type Storage} from './storage.js';

export type Row = Record<string, any>;
export type Identity = {id:string;name:string;email:string;coupleId:string|null;tokenHash:string;expiresAt:number};
declare global { namespace Express { interface Request { identity:Identity } } }
export class HttpError extends Error { constructor(public status:number,message:string){super(message);} }
export const id = () => randomUUID();
export const now = () => new Date().toISOString();
export const hash = (value:string) => createHash('sha256').update(value).digest('hex');

export function context(db:Database, io:Server, uploadDir:string,storage:Storage=createStorage(db)) {
  const one = (sql:string,...params:SQLInputValue[]):Promise<Row|undefined> => db.prepare(sql).get(...params);
  const all = (sql:string,...params:SQLInputValue[]):Promise<Row[]> => db.prepare(sql).all(...params);
  const run = (sql:string,...params:SQLInputValue[]) => db.prepare(sql).run(...params);
  const transaction = db.transaction;
  const identity = async(token:unknown):Promise<Identity> => {
    if(typeof token!=='string'||token.length!==64) throw new HttpError(401,'Please sign in to continue.');
    const tokenHash=hash(token),session=await storage.sessions.get(tokenHash);
    if(!session)throw new HttpError(401,'You’re signed out. Sign in to continue.');
    const user=await one(`SELECT u.id,u.name,u.email,m.couple_id AS coupleId FROM users u LEFT JOIN memberships m ON m.user_id=u.id WHERE u.id=?`,session.userId);
    if(!user) throw new HttpError(401,'You’re signed out. Sign in to continue.');
    return {...user,tokenHash,expiresAt:session.expiresAt} as Identity;
  };
  const authenticated:RequestHandler=async(req,_res,next)=>{try{req.identity=await identity(req.headers.authorization?.replace(/^Bearer /,''));next();}catch(e){next(e);}};
  const paired:RequestHandler=(req,_res,next)=>{if(!req.identity.coupleId)next(new HttpError(403,'Pair with your partner first.'));else next();};
  const owned=async(table:string,resource:string,req:Request):Promise<Row>=>{
    const row=await one(`SELECT * FROM ${table} WHERE id=? AND couple_id=?`,resource,req.identity.coupleId);
    if(!row)throw new HttpError(404,'Item not found.'); return row;
  };
  const changed=async(couple:string|null,area:string)=>{
    if(!couple)return;
    for(const socket of io.sockets.sockets.values())if(socket.data.user?.coupleId===couple){try{await identity(socket.handshake.auth.token);}catch{socket.disconnect(true);}}
    io.to(`couple:${couple}`).emit('changed',{area});
  };
  return {db,io,uploadDir,storage,one,all,run,transaction,identity,authenticated,paired,owned,changed};
}
export type Context = ReturnType<typeof context>;
