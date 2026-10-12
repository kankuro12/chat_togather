import {databaseOptions} from './db.js';
import {storageOptions} from './storage.js';
import { firebaseOptions } from './firebase.js';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createApp } from './app.js';
// Run from server workspace or root; paths always resolve from this package.
const root=resolve(import.meta.dirname,'..');
const envPath=resolve(root,'.env');
if(existsSync(envPath))process.loadEnvFile(envPath);
const port=Number(process.env.PORT||3001);
const webDir=resolve(root,'../client/www');
const system=await createApp({storage:storageOptions(),communication:{...firebaseOptions(),...(process.env.WEBRTC_ICE_SERVERS?{iceServers:JSON.parse(process.env.WEBRTC_ICE_SERVERS)}:{})},auth:{phoneTestMode:process.env.PHONE_TEST_MODE==='true',publicUrl:process.env.PUBLIC_URL,appUrl:process.env.APP_URL,googleClientId:process.env.GOOGLE_CLIENT_ID,googleClientSecret:process.env.GOOGLE_CLIENT_SECRET,facebookClientId:process.env.FACEBOOK_CLIENT_ID,facebookClientSecret:process.env.FACEBOOK_CLIENT_SECRET,facebookVersion:process.env.FACEBOOK_GRAPH_VERSION,twilioAccountSid:process.env.TWILIO_ACCOUNT_SID,twilioAuthToken:process.env.TWILIO_AUTH_TOKEN,twilioVerifyServiceSid:process.env.TWILIO_VERIFY_SERVICE_SID},database:databaseOptions(root),uploadDir:resolve(root,'data/uploads'),origins:(process.env.ALLOWED_ORIGINS||'http://localhost:4200,http://127.0.0.1:4200,http://localhost,https://localhost,capacitor://localhost').split(',').map(s=>s.trim()),webDir:existsSync(resolve(webDir,'index.html'))?webDir:undefined});
await system.storage.ready();
system.server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Together API listening on ${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>system.io.close(async()=>{await system.storage.close();await system.db.close();process.exit(0);}));

