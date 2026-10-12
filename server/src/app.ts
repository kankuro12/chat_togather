import express from 'express';
import { communication, CommunicationOptions } from './communication.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { openDatabase } from './db.js';
import { context, HttpError } from './context.js';
import { authRoutes, pairRoutes } from './auth.js';
import { chatRoutes, realtime } from './chat.js';
import { mediaRoutes } from './media.js';
import { decisionsRoutes } from './decisions.js';
import { plansRoutes } from './plans.js';
import { tripsRoutes } from './trips.js';
import multer from 'multer';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { resolve } from 'node:path';
import { externalAuthRoutes, AuthOptions } from './external-auth.js';
import {createStorage,validateStorage,type StorageOptions} from './storage.js';
export function createApp(options: {databasePath:string;uploadDir:string;origins:string[];webDir?:string;auth?:AuthOptions;communication?:CommunicationOptions;storage?:StorageOptions}) {
  validateStorage(options.storage||{});
  const app=express();
  app.set('trust proxy',1);
  app.disable('x-powered-by'); app.use(helmet({contentSecurityPolicy:{directives:{imgSrc:["'self'",'data:','blob:'],connectSrc:["'self'",'https://firebaseinstallations.googleapis.com','https://fcmregistrations.googleapis.com'],mediaSrc:["'self'",'blob:'],upgradeInsecureRequests:null}}}),cors({origin:options.origins,credentials:true}),express.json({limit:'64kb'}));
  const server=createServer(app); const io=new Server(server,{cors:{origin:options.origins},maxHttpBufferSize:64*1024});
  const db=openDatabase(options.databasePath),storage=createStorage(db,options.storage); const c=context(db,io,options.uploadDir,storage);const comm=communication(c,options.communication);
  app.use('/api',(_req,res,next)=>{res.set('Cache-Control','no-store');next();});
  app.get('/api/health',(_req,res)=>res.json({ok:true}));
  app.use('/api/auth',externalAuthRoutes(c,options.auth));
  app.use('/api/auth',authRoutes(c)); app.use('/api/pair',pairRoutes(c));
  app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false,keyGenerator:async req=>{
    try{return `account:${(await c.identity(req.headers.authorization?.replace(/^Bearer /,''))).id}`;}
    catch{return ipKeyGenerator(req.ip||'unknown');}
  },message:{error:'Too many requests. Try again shortly.'}}));
  app.use('/api/communication',comm.router);app.use('/api/notifications',comm.notifications);
  app.use('/api/messages',chatRoutes(c,comm.notify));app.use('/api/media',mediaRoutes(c));app.use('/api/decisions',decisionsRoutes(c,comm.notify));app.use('/api/plans',plansRoutes(c));app.use('/api/trips',tripsRoutes(c));
  realtime(c,comm.bind);
  app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  if(options.webDir){app.use(express.static(options.webDir));app.get('/{*path}',(_req,res)=>res.sendFile(resolve(options.webDir!,'index.html')));}
  app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
    if(error instanceof ZodError){res.status(400).json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});return;}
    if(error instanceof HttpError){res.status(error.status).json({error:error.message});return;}
    if(error instanceof multer.MulterError){res.status(error.code==='LIMIT_FILE_SIZE'?413:400).json({error:error.code==='LIMIT_FILE_SIZE'?'Media must be smaller than 15 MB.':'Upload exactly one file.'});return;}
    if(error.status===413){res.status(413).json({error:'Request too large.'});return;}
    if(error instanceof SyntaxError){res.status(400).json({error:'Invalid JSON.'});return;}
    console.error('Request failed:',error.message);res.status(500).json({error:'Something went wrong. Please try again.'});
  });
  return {app,server,io,db,storage};
}

