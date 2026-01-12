import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'logs.db');
const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    event_type TEXT NOT NULL,
    username TEXT,
    fingerprint TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    session_id TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp);
  CREATE INDEX IF NOT EXISTS idx_event_type ON logs(event_type);
  CREATE INDEX IF NOT EXISTS idx_username ON logs(username);
  CREATE INDEX IF NOT EXISTS idx_fingerprint ON logs(fingerprint);
`);

interface LogEntry {
  event_type: string;
  username?: string;
  fingerprint?: string;
  ip_address?: string;
  user_agent?: string;
  details?: string;
  session_id?: string;
}

const insertStmt = db.prepare(`
  INSERT INTO logs (timestamp, event_type, username, fingerprint, ip_address, user_agent, details, session_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

export function log(entry: LogEntry): void {
  const timestamp = new Date().toISOString();
  insertStmt.run(
    timestamp,
    entry.event_type,
    entry.username || null,
    entry.fingerprint || null,
    entry.ip_address || null,
    entry.user_agent || null,
    entry.details || null,
    entry.session_id || null
  );
}

export function closeDatabase(): void {
  db.close();
}

console.log(`SQLite database initialized at: ${dbPath}`);
