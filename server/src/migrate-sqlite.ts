import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {openDatabase,databaseOptions} from './db.js';
import {importSQLite} from './sqlite-import.js';
const root=resolve(import.meta.dirname,'..');
if(existsSync(resolve(root,'.env')))process.loadEnvFile(resolve(root,'.env'));
const source=resolve(root,process.argv[2]||process.env.DB_PATH||'data/together.db');
if(!existsSync(source))throw new Error('SQLite source file does not exist.');
const target=await openDatabase({...databaseOptions(root),driver:'mysql'});
try{console.table(await importSQLite(source,target));console.log('SQLite data imported. Source file unchanged.');}
finally{await target.close();}
