import {AsyncLocalStorage} from 'node:async_hooks';
import {createPool,type PoolConnection,type ResultSetHeader} from 'mysql2/promise';
import {resolve} from 'node:path';
import {openSQLite} from './sqlite.js';
import {mysqlSchema,extraSQLiteSchema} from './schema.js';

export type Row=Record<string,any>;
export type SQLInputValue=string|number|bigint|Uint8Array|null;
export type DatabaseOptions={driver?:string;url?:string;host?:string;port?:number;user?:string;password?:string;database?:string;path?:string};
export type Database={
  driver:'mysql'|'sqlite';
  prepare:(sql:string)=>{get:(...params:SQLInputValue[])=>Promise<Row|undefined>;all:(...params:SQLInputValue[])=>Promise<Row[]>;run:(...params:SQLInputValue[])=>Promise<{changes:number}>};
  exec:(sql:string)=>Promise<void>;
  transaction:<T>(fn:()=>Promise<T>)=>Promise<T>;
  close:()=>Promise<void>;
};
export function databaseOptions(root:string,env:NodeJS.ProcessEnv=process.env):DatabaseOptions{
  return {driver:env.DB_CONNECTION||'mysql',url:env.DATABASE_URL,host:env.DB_HOST||'127.0.0.1',port:Number(env.DB_PORT||3306),user:env.DB_USERNAME||'root',password:env.DB_PASSWORD||'',database:env.DB_DATABASE||'together',path:resolve(root,env.DB_PATH||'data/together.db')};
}

// Existing upserts retain their conflict keys; MySQL enforces the same unique indexes.
function mysqlSQL(sql:string){
  if(/INSERT OR IGNORE/i.test(sql)){
    const table=/INSERT OR IGNORE INTO (\w+)/i.exec(sql)?.[1];
    const key=({jobs:'id',choice_media:'media_id',phone_profiles:'user_id',migrations:'version'} as Record<string,string>)[table||''];
    if(!key)throw new Error('Unsupported duplicate insert table');
    sql=sql.replace(/INSERT OR IGNORE/i,'INSERT')+` ON DUPLICATE KEY UPDATE ${key}=${table}.${key}`;
  }
  return sql.replace(/ON CONFLICT\([^)]*\) DO UPDATE SET/gi,'ON DUPLICATE KEY UPDATE').replace(/excluded\.(\w+)/gi,'VALUES($1)');
}

export async function openDatabase(input:string|DatabaseOptions):Promise<Database>{
  const options=typeof input==='string'?{driver:'sqlite',path:input}:input;
  if(options.driver!==undefined&&options.driver!=='mysql'&&options.driver!=='sqlite')throw new Error('DB_CONNECTION must be mysql or sqlite.');
  if(options.driver==='sqlite'){
    const sqlite=openSQLite(options.path||':memory:');sqlite.exec(extraSQLiteSchema);
    for(const table of ['oauth_states','auth_tickets'])if(!sqlite.prepare(`PRAGMA table_info(${table})`).all().some(row=>row.name==='verifier_hash'))sqlite.exec(`ALTER TABLE ${table} ADD COLUMN verifier_hash TEXT NOT NULL DEFAULT ''`);
    const transactionScope=new AsyncLocalStorage<boolean>();let tail=Promise.resolve();
    const exclusive=async<T>(fn:()=>T|Promise<T>):Promise<T>=>{
      if(transactionScope.getStore())return await fn();
      const previous=tail;let unlock!:()=>void;tail=new Promise<void>(resolve=>{unlock=resolve;});await previous;
      try{return await fn();}finally{unlock();}
    };
    const sql=(value:string)=>/FROM checklist_items\b/i.test(value)?value.replace(/ORDER BY position\b/i,'ORDER BY rowid'):value;
    const db:Database={driver:'sqlite',prepare:value=>({get:(...params)=>exclusive(()=>sqlite.prepare(sql(value)).get(...params)),all:(...params)=>exclusive(()=>sqlite.prepare(sql(value)).all(...params)),run:(...params)=>exclusive(()=>({changes:Number(sqlite.prepare(sql(value)).run(...params).changes)}))}),exec:value=>exclusive(()=>sqlite.exec(value)),transaction:fn=>exclusive(()=>transactionScope.run(true,async()=>{
      sqlite.exec('BEGIN IMMEDIATE');try{const result=await fn();sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}
    })),close:()=>exclusive(()=>sqlite.close())};
    await recoverProfiles(db);return db;
  }
  const pool=createPool({...(options.url?{uri:options.url}:{host:options.host||'127.0.0.1',port:options.port||3306,user:options.user||'root',password:options.password||'',database:options.database||'together'}),charset:'utf8mb4',connectionLimit:10,connectTimeout:5000,supportBigNumbers:true,bigNumberStrings:false});
  // Reject truncation even when the server's global SQL mode is permissive.
  pool.pool.on('connection',connection=>{connection.query("SET SESSION sql_mode=CONCAT_WS(',',NULLIF(@@SESSION.sql_mode,''),'STRICT_ALL_TABLES')",error=>{if(error)connection.destroy();});});
  const transactionScope=new AsyncLocalStorage<PoolConnection>();
  const execute=async(sql:string,params:SQLInputValue[])=>{
    const [rows]=await (transactionScope.getStore()||pool).execute(mysqlSQL(sql),params.map(value=>typeof value==='bigint'?value.toString():value));return rows;
  };
  const db:Database={driver:'mysql',prepare:sql=>({get:async(...params)=>((await execute(sql,params)) as Row[])[0],all:async(...params)=>(await execute(sql,params)) as Row[],run:async(...params)=>({changes:(await execute(sql,params) as ResultSetHeader).affectedRows})}),exec:async sql=>{for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean))await (transactionScope.getStore()||pool).query(mysqlSQL(statement));},transaction:async fn=>{
    if(transactionScope.getStore())throw new Error('Nested database transaction');
    for(let attempt=0;;attempt++){
      const connection=await pool.getConnection();
      try{
        // Read locks protect single-use invitations, OTPs and OAuth tickets too.
        await connection.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');await connection.beginTransaction();
        const result=await transactionScope.run(connection,fn);await connection.commit();return result;
      }catch(error:any){
        await connection.rollback();if(attempt>=2||!['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(error.code))throw error;
      }finally{connection.release();}
    }
  },close:async()=>{await pool.end();}};
  try{
    for(let statement of mysqlSchema.split(';').map(s=>s.trim()).filter(Boolean)){
      if(statement.startsWith('CREATE TABLE'))statement+=' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
      await pool.query(statement);
    }
    await recoverProfiles(db);return db;
  }catch(error){await pool.end();throw error;}
}
async function recoverProfiles(db:Database){
  await db.prepare("INSERT OR IGNORE INTO phone_profiles(user_id,complete) SELECT u.id,0 FROM users u JOIN external_identities e ON e.user_id=u.id WHERE e.provider='phone' AND u.name='You' AND NOT EXISTS(SELECT 1 FROM memberships m WHERE m.user_id=u.id)").run();
}
