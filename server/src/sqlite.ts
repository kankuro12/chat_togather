import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openSQLite(path: string) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS phone_profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),complete INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS couples(id TEXT PRIMARY KEY,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS memberships(user_id TEXT PRIMARY KEY REFERENCES users(id),couple_id TEXT NOT NULL REFERENCES couples(id));
    CREATE TABLE IF NOT EXISTS invitations(code_hash TEXT PRIMARY KEY,creator_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS media(id TEXT PRIMARY KEY,couple_id TEXT NOT NULL REFERENCES couples(id),user_id TEXT NOT NULL REFERENCES users(id),filename TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,couple_id TEXT NOT NULL REFERENCES couples(id),user_id TEXT NOT NULL REFERENCES users(id),text TEXT NOT NULL,media_id TEXT REFERENCES media(id),client_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(user_id,client_id));
    CREATE INDEX IF NOT EXISTS message_history ON messages(couple_id,created_at);
    CREATE TABLE IF NOT EXISTS message_reads(user_id TEXT PRIMARY KEY REFERENCES users(id),message_id TEXT NOT NULL REFERENCES messages(id));
    CREATE TABLE IF NOT EXISTS decisions(id TEXT PRIMARY KEY,couple_id TEXT NOT NULL REFERENCES couples(id),user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,mode TEXT NOT NULL CHECK(mode IN ('choose','rate')),created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS decision_options(id TEXT PRIMARY KEY,decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,label TEXT NOT NULL,media_id TEXT NOT NULL REFERENCES media(id),position INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS decision_votes(decision_id TEXT NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,option_id TEXT NOT NULL REFERENCES decision_options(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),rating INTEGER,PRIMARY KEY(decision_id,option_id,user_id));
    CREATE TABLE IF NOT EXISTS choice_media(media_id TEXT PRIMARY KEY REFERENCES media(id));
    CREATE TABLE IF NOT EXISTS message_decisions(message_id TEXT PRIMARY KEY REFERENCES messages(id),decision_id TEXT NOT NULL REFERENCES decisions(id),event TEXT NOT NULL CHECK(event IN ('shared','chosen')));
    CREATE TABLE IF NOT EXISTS decision_requests(user_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,decision_id TEXT NOT NULL REFERENCES decisions(id),PRIMARY KEY(user_id,client_id));
    CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,couple_id TEXT NOT NULL REFERENCES couples(id),user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,notes TEXT NOT NULL,location TEXT NOT NULL,start_at TEXT NOT NULL,end_at TEXT NOT NULL,timezone TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('planned','done')),decision_id TEXT REFERENCES decisions(id),created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS plan_responses(plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),response TEXT NOT NULL CHECK(response IN ('yes','no')),PRIMARY KEY(plan_id,user_id));
    CREATE TABLE IF NOT EXISTS trips(id TEXT PRIMARY KEY,couple_id TEXT NOT NULL REFERENCES couples(id),user_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,destination TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL,notes TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS itinerary_items(id TEXT PRIMARY KEY,trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,title TEXT NOT NULL,date TEXT NOT NULL,time TEXT NOT NULL,notes TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS checklist_items(id TEXT PRIMARY KEY,trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,title TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO migrations(version) VALUES(1);`);
  return db;
}
