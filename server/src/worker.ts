import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {openDatabase} from './db.js';
import {jobQueue} from './jobs.js';
import {firebaseOptions} from './firebase.js';
import {pushHandler} from './push-job.js';
const root=resolve(import.meta.dirname,'..');if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'));
const sender=firebaseOptions().sendPush;
if(!sender){console.error('Worker needs FCM_PROJECT_ID and Firebase credentials. Jobs remain saved.');process.exit(1);}
const db=openDatabase(resolve(root,process.env.DB_PATH||'data/together.db')),queue=jobQueue(db);
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
console.log('Together worker started');
while(!stopping){if(!await queue.runOne({push:pushHandler(db,sender)}))await new Promise(resolve=>setTimeout(resolve,1000));}
db.close();
