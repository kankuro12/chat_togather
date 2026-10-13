import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {openDatabase,databaseOptions} from './db.js';
import {createStorage,storageOptions} from './storage.js';
import {firebaseOptions} from './firebase.js';
import {pushHandler} from './push-job.js';
import {notifier} from './notify.js';
import {usJobHandlers} from './us-jobs.js';
const root=resolve(import.meta.dirname,'..');if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'));
const sender=firebaseOptions().sendPush;
if(!sender){console.error('Worker needs FCM_PROJECT_ID and Firebase credentials. Jobs remain saved.');process.exit(1);}
const db=await openDatabase(databaseOptions(root)),storage=createStorage(db,storageOptions()),queue=storage.queue;
await storage.ready();
let stopping=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stopping=true;});
console.log('Together worker started');
const handlers={push:pushHandler(db,sender,storage.sessions),...usJobHandlers(db,queue,notifier(db,storage.sessions,queue))};
try{while(!stopping){if(!await queue.runOne(handlers))await new Promise(resolve=>setTimeout(resolve,1000));}}
finally{await storage.close();await db.close();}
