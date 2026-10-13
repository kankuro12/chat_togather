import {DatabaseSync} from 'node:sqlite';
import type {Database} from './db.js';

const tables=['users','couples','phone_profiles','memberships','sessions','invitations','media','media_previews','messages','message_reads','decisions','decision_options','decision_votes','choice_media','message_decisions','message_replies','message_reactions','message_changes','message_pins','message_view_once','message_views','media_waveforms','decision_requests','plans','plan_responses','trips','itinerary_items','checklist_items','external_identities','phone_challenges','oauth_states','auth_tickets','push_tokens','notification_settings','special_dates','shared_lists','list_items','wishes','wish_claims','daily_answers','love_notes','nudges','incoming_calls','jobs','chat_reading'];

export async function importSQLite(path:string,target:Database){
  if(target.driver!=='mysql')throw new Error('SQLite import requires a MySQL target.');
  const source=new DatabaseSync(path,{readOnly:true});
  try{
    source.exec('BEGIN');
    const present=new Set(source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name as string));
    for(const table of present)if(table!=='migrations'&&!tables.includes(table))throw new Error('Unknown source table: '+table);
    return await target.transaction(async()=>{
      for(const table of tables)if(Number((await target.prepare(`SELECT count(*) AS n FROM ${table}`).get())?.n))throw new Error('MySQL target must be empty; found data in '+table+'.');
      const counts:Record<string,number>={};
      for(const table of tables){
        if(!present.has(table))continue;
        const sourceColumns=source.prepare(`PRAGMA table_info(${table})`).all().map(row=>row.name as string);
        const targetColumns=await target.prepare(`SHOW COLUMNS FROM ${table}`).all();
        const columns=sourceColumns.filter(name=>targetColumns.some(row=>row.Field===name&&!String(row.Extra).includes('GENERATED')));
        if(columns.length!==sourceColumns.length)throw new Error('Source schema differs from MySQL table '+table+'.');
        const rows=source.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
        const statement=target.prepare(`INSERT INTO ${table} (${columns.map(name=>'`'+name+'`').join(',')}) VALUES(${columns.map(()=>'?').join(',')})`);
        for(const row of rows)await statement.run(...columns.map(name=>row[name]));
        counts[table]=rows.length;
      }
      return counts;
    });
  }finally{source.close();}
}
