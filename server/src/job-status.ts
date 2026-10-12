import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {openDatabase} from './db.js';
import {createStorage,storageOptions} from './storage.js';
const root=resolve(import.meta.dirname,'..');
if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'));
const db=openDatabase(resolve(root,process.env.DB_PATH||'data/together.db')),storage=createStorage(db,storageOptions());
try{await storage.ready();const status=await storage.queue.status();console.table(status.counts);console.table(status.jobs);}
finally{await storage.close();db.close();}
