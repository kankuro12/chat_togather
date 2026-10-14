import { Router } from 'express';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Context, HttpError, hash, id, now } from './context.js';

const scrypt=promisify(scryptCallback);
const credentials=z.object({email:z.email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(10).max(128)});
const register=credentials.extend({name:z.string().trim().min(1).max(60)});
async function passwordHash(password:string){const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64) as Buffer).toString('hex')}`;}
async function matches(password:string,stored:string){const [salt,key]=stored.split(':');if(!salt||!key||key.length!==128)return false;const candidate=await scrypt(password,salt,64) as Buffer;return timingSafeEqual(candidate,Buffer.from(key,'hex'));}
export function authRoutes(c:Context){
  const router=Router();
  // Brute-force protection per address; the automated test server raises it because every test signs up new couples.
  const limit=rateLimit({windowMs:15*60*1000,limit:Number(process.env.AUTH_RATE_LIMIT)||40,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many attempts. Try again in 15 minutes.'}});
  async function session(userId:string){const token=randomBytes(32).toString('hex');await c.storage.sessions.create(hash(token),userId,Date.now()+7*86400000);return token;}
  router.post('/register',limit,async(req,res)=>{
    const input=register.parse(req.body);
    if(await c.one('SELECT id FROM users WHERE email=?',input.email))throw new HttpError(409,'Email already registered.');
    const password=await passwordHash(input.password);
    const user={id:id(),name:input.name,email:input.email};
    await c.transaction(async()=>{
      if(await c.one('SELECT id FROM users WHERE email=?',input.email))throw new HttpError(409,'Email already registered.');
      await c.run('INSERT INTO users VALUES(?,?,?,?,?)',user.id,user.name,user.email,password,now());
    });
    res.status(201).json({user,token:await session(user.id),pair:null});
  });
  router.post('/login',limit,async(req,res)=>{
    const input=z.object({email:z.email().transform(s=>s.toLowerCase()),password:z.string().max(128)}).parse(req.body);
    const user=await c.one('SELECT * FROM users WHERE email=?',input.email);
    if(!user||!await matches(input.password,user.password))throw new HttpError(401,'Email or password incorrect.');
    res.json({token:await session(user.id),user:{id:user.id,name:user.name,email:user.email}});
  });
  router.get('/me',c.authenticated,async(req,res)=>{
    const {id:userId,name,email,coupleId}=req.identity;
    const pair=coupleId?{id:coupleId,members:await c.all('SELECT u.id,u.name FROM users u JOIN memberships m ON m.user_id=u.id WHERE m.couple_id=?',coupleId)}:null;
    res.json({user:{id:userId,name,email,needsProfile:!!await c.one('SELECT user_id FROM phone_profiles WHERE user_id=? AND complete=0',userId)},pair});
  });
  router.patch('/profile',c.authenticated,async(req,res)=>{
    const input=z.object({name:z.string().trim().min(1).max(60)}).safeParse(req.body);if(!input.success)throw new HttpError(400,'Enter your name (up to 60 characters).');
    await c.transaction(async()=>{await c.run('UPDATE users SET name=? WHERE id=?',input.data.name,req.identity.id);await c.run('UPDATE phone_profiles SET complete=1 WHERE user_id=?',req.identity.id);});res.json({ok:true});
  });
  router.post('/logout',c.authenticated,async(req,res)=>{
    await c.storage.sessions.delete(req.identity.tokenHash);await c.run('DELETE FROM push_tokens WHERE session_hash=?',req.identity.tokenHash);
    for(const socket of c.io.sockets.sockets.values()) if(socket.data.tokenHash===req.identity.tokenHash)socket.disconnect(true);
    res.json({ok:true});
  });
  return router;
}
export function pairRoutes(c:Context){
  const router=Router();router.use(c.authenticated,rateLimit({windowMs:15*60*1000,limit:Number(process.env.PAIR_RATE_LIMIT)||30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many invitation attempts. Try later.'}}));
  router.use(async(req,_res,next)=>{if(await c.one('SELECT user_id FROM phone_profiles WHERE user_id=? AND complete=0',req.identity.id))next(new HttpError(400,'Add your name before pairing with your partner.'));else next();});
  router.post('/invite',async(req,res)=>{
    const code=randomBytes(8).toString('hex').toUpperCase();const expiresAt=Date.now()+86400000;
    await c.transaction(async()=>{
      if(await c.one('SELECT user_id FROM memberships WHERE user_id=?',req.identity.id))throw new HttpError(409,'Already paired.');
      await c.run('DELETE FROM invitations WHERE creator_id=?',req.identity.id);
      await c.run('INSERT INTO invitations(code_hash,creator_id,expires_at) VALUES(?,?,?)',hash(code),req.identity.id,expiresAt);
    });
    res.status(201).json({code,expiresAt});
  });
  router.post('/join',async(req,res)=>{
    const input=z.object({code:z.string().trim().min(1).max(32).transform(s=>s.toUpperCase())}).safeParse(req.body);
    if(!input.success)throw new HttpError(400,'Enter your partner’s invitation code or scan their QR.');
    const {code}=input.data;
    const coupleId=await c.transaction(async()=>{
      const invite=await c.one('SELECT * FROM invitations WHERE code_hash=?',hash(code));
      if(!invite||invite.used||invite.expires_at<=Date.now())throw new HttpError(409,'Invitation unavailable or expired. Ask for a new code.');
      if(invite.creator_id===req.identity.id)throw new HttpError(400,'Your partner must use this invitation.');
      if(await c.one('SELECT user_id FROM memberships WHERE user_id IN (?,?)',req.identity.id,invite.creator_id))throw new HttpError(409,'An account is already paired.');
      const couple=id();await c.run('INSERT INTO couples VALUES(?,?)',couple,now());
      await c.run('INSERT INTO memberships VALUES(?,?),(?,?)',invite.creator_id,couple,req.identity.id,couple);
      await c.run('UPDATE invitations SET used=1 WHERE code_hash=?',hash(code));
      return couple;
    });res.json({id:coupleId});
  });return router;
}
