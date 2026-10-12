import { Router } from 'express';
import { randomBytes, createHmac } from 'node:crypto';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { Context, HttpError, hash, id, now } from './context.js';

export type AuthOptions={phoneTestMode?:boolean;publicUrl?:string;appUrl?:string;googleClientId?:string;googleClientSecret?:string;facebookClientId?:string;facebookClientSecret?:string;facebookVersion?:string;twilioAccountSid?:string;twilioAuthToken?:string;twilioVerifyServiceSid?:string;fetch?:(url:string,init?:RequestInit)=>Promise<Response>};
const phoneInput=z.object({phone:z.string().trim().transform(value=>{const phone=value.replace(/[\s()-]/g,'');return /^9\d{9}$/.test(phone)?'+977'+phone:phone;}).pipe(z.string().regex(/^\+9779\d{9}$/,'Enter a 10-digit Nepal mobile number.')),name:z.string().trim().min(1).max(60).optional()});
const secret=()=>randomBytes(32).toString('hex');
export function externalAuthRoutes(c:Context,o:AuthOptions={}){
  const router=Router(),fetcher=o.fetch||fetch;
  const testMode=o.phoneTestMode===true;
  router.use(['/phone','/oauth'],rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many attempts. Try again later.'}}));
  async function remote(url:string,init?:RequestInit){try{const r=await fetcher(url,{...init,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();return await r.json();}catch{throw new HttpError(502,'Sign-in unavailable right now. Please try again.');}}
  async function session(userId:string){const token=secret();await c.storage.sessions.create(hash(token),userId,Date.now()+7*86400000);return {token,user:await c.one('SELECT id,name,email FROM users WHERE id=?',userId)};}
  async function account(provider:string,subject:string,name:string){const existing=await c.one('SELECT user_id FROM external_identities WHERE provider=? AND subject=?',provider,subject);if(existing)return existing.user_id as string;const user=id();await c.run('INSERT INTO users VALUES(?,?,?,?,?)',user,name||'You',`${user}@signin.invalid`,'external',now());await c.run('INSERT INTO external_identities VALUES(?,?,?)',provider,subject,user);if(provider==='phone')await c.run('INSERT INTO phone_profiles VALUES(?,?)',user,name.trim()?1:0);return user;}
  function twilioReady(){if(!o.twilioAccountSid||!o.twilioAuthToken||!o.twilioVerifyServiceSid)throw new HttpError(503,'Phone sign-in is unavailable right now. Please use email.');}
  function twilio(path:string,body:Record<string,string>){return remote(`https://verify.twilio.com/v2/Services/${encodeURIComponent(o.twilioVerifyServiceSid!)}/${path}`,{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${o.twilioAccountSid}:${o.twilioAuthToken}`).toString('base64')}`,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body).toString()});}
  router.post('/phone/send',async(req,res)=>{
    const input=phoneInput.parse(req.body);if(!testMode)twilioReady();const challenge=secret(),time=Date.now();
    await c.transaction(async()=>{await c.run('DELETE FROM phone_challenges WHERE expires_at<?',time-86400000);if(await c.one('SELECT id FROM phone_challenges WHERE phone=? AND sent_at>?',input.phone,time-60000))throw new HttpError(429,'Wait a minute before requesting another code.');if(Number((await c.one('SELECT count(*) AS n FROM phone_challenges WHERE phone=? AND sent_at>?',input.phone,time-3600000))?.n)>=5)throw new HttpError(429,'Too many codes requested. Try again in an hour.');await c.run('INSERT INTO phone_challenges(id,phone,name,expires_at,sent_at) VALUES(?,?,?,?,?)',hash(challenge),input.phone,input.name||'',time+10*60000,time);});
    const result=testMode?{sid:'local-test',status:'pending'}:await twilio('Verifications',{To:input.phone,Channel:'sms'});if(typeof result.sid!=='string'||result.status!=='pending')throw new HttpError(502,'Could not send a code. Please try again.');await c.run('UPDATE phone_challenges SET verification_sid=? WHERE id=?',result.sid,hash(challenge));res.json({challenge,retryAfter:60});
  });
  router.post('/phone/verify',async(req,res)=>{
    const input=z.object({challenge:z.string().max(128),code:z.string().regex(/^\d{4,10}$/)}).parse(req.body);
    const row=await c.transaction(async()=>{const row=await c.one('SELECT * FROM phone_challenges WHERE id=?',hash(input.challenge));if(!row||row.used||!row.verification_sid||(row.verification_sid==='local-test'&&!testMode)||row.expires_at<=Date.now()||row.attempts>=5)throw new HttpError(400,'Code expired or unavailable. Request a new one.');await c.run('UPDATE phone_challenges SET attempts=attempts+1 WHERE id=?',row.id);return row;});
    let approved=false;
    if(row.verification_sid==='local-test')approved=testMode&&input.code==='123456';
    else{twilioReady();approved=(await twilio('VerificationCheck',{VerificationSid:row.verification_sid,Code:input.code})).status==='approved';}
    if(!approved)throw new HttpError(400,'Code incorrect. Please try again.');
    const user=await c.transaction(async()=>{const updated=await c.run('UPDATE phone_challenges SET used=1 WHERE id=? AND used=0 AND expires_at>?',row.id,Date.now());if(!updated.changes)throw new HttpError(400,'Code already used or expired. Request a new one.');return account('phone',row.phone,row.name);});res.json(await session(user));
  });
  const appUrl=(o.appUrl||'http://localhost:4200').replace(/\/$/,''),publicUrl=(o.publicUrl||'http://localhost:3001').replace(/\/$/,''),version=o.facebookVersion||'v24.0';
  function provider(value:string){if(value!=='google'&&value!=='facebook')throw new HttpError(404,'Sign-in option unavailable.');const google=value==='google',clientId=google?o.googleClientId:o.facebookClientId,clientSecret=google?o.googleClientSecret:o.facebookClientSecret;if(!clientId||!clientSecret)throw new HttpError(503,`${google?'Google':'Facebook'} sign-in is unavailable right now. Please use email.`);return {google,clientId,clientSecret,callback:`${publicUrl}/api/auth/oauth/${value}/callback`};}
  router.post('/oauth/:provider/start',async(req,res)=>{
    const p=provider(req.params.provider),state=secret(),browser=secret(),verifier=z.object({verifier:z.string().regex(/^[a-f0-9]{64}$/)}).parse(req.body).verifier;await c.run('DELETE FROM oauth_states WHERE expires_at<?',Date.now());await c.run('INSERT INTO oauth_states VALUES(?,?,?,?,?)',hash(state),req.params.provider,hash(browser),Date.now()+10*60000,hash(verifier));
    res.cookie('together_oauth',browser,{httpOnly:true,secure:publicUrl.startsWith('https:'),sameSite:'lax',path:'/api/auth/oauth',maxAge:10*60000});
    const url=new URL(p.google?'https://accounts.google.com/o/oauth2/v2/auth':`https://www.facebook.com/${version}/dialog/oauth`);url.search=new URLSearchParams({client_id:p.clientId,redirect_uri:p.callback,response_type:'code',scope:p.google?'openid email profile':'public_profile,email',state}).toString();res.json({url:url.toString()});
  });
  router.get('/oauth/:provider/callback',async(req,res)=>{
    try{
      const p=provider(req.params.provider),state=z.string().max(128).parse(req.query.state),cookie=req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('together_oauth='))?.slice('together_oauth='.length);
      const row=await c.one('SELECT * FROM oauth_states WHERE state_hash=? AND provider=? AND expires_at>?',hash(state),req.params.provider,Date.now());if(!cookie||!row||row.browser_hash!==hash(cookie))throw new Error();await c.run('DELETE FROM oauth_states WHERE state_hash=?',hash(state));res.clearCookie('together_oauth',{path:'/api/auth/oauth'});if(req.query.error)throw new Error();
      const code=z.string().max(4096).parse(req.query.code),tokens=await remote(p.google?'https://oauth2.googleapis.com/token':`https://graph.facebook.com/${version}/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:p.clientId,client_secret:p.clientSecret,redirect_uri:p.callback,code,grant_type:'authorization_code'}).toString()});if(typeof tokens.access_token!=='string')throw new Error();
      const profile=p.google?await remote('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokens.access_token}`}}):await remote(`https://graph.facebook.com/${version}/me?${new URLSearchParams({fields:'id,name,email',access_token:tokens.access_token,appsecret_proof:createHmac('sha256',p.clientSecret).update(tokens.access_token).digest('hex')})}`);
      const subject=p.google?profile.sub:profile.id;if(typeof subject!=='string'||!subject||typeof profile.name!=='string'||!profile.name.trim())throw new Error();const ticket=secret();await c.transaction(async()=>{const user=await account(req.params.provider,subject,profile.name.slice(0,60));await c.run('DELETE FROM auth_tickets WHERE expires_at<?',Date.now());await c.run('INSERT INTO auth_tickets VALUES(?,?,?,?)',hash(ticket),user,Date.now()+60000,row.verifier_hash);});res.redirect(`${appUrl}/#auth_ticket=${ticket}`);
    }catch{res.redirect(`${appUrl}/#auth_error=Sign-in%20could%20not%20be%20completed.%20Please%20try%20again.`);}
  });
  router.post('/oauth/exchange',async(req,res)=>{const {ticket,verifier}=z.object({ticket:z.string().length(64),verifier:z.string().length(64)}).parse(req.body);const user=await c.transaction(async()=>{const row=await c.one('SELECT * FROM auth_tickets WHERE ticket_hash=? AND expires_at>?',hash(ticket),Date.now());if(!row||row.verifier_hash!==hash(verifier))throw new HttpError(400,'Sign-in expired. Please try again.');await c.run('DELETE FROM auth_tickets WHERE ticket_hash=?',hash(ticket));return row.user_id as string;});res.json(await session(user));});
  return router;
}

