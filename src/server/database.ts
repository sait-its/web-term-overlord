import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', '..', 'logs.db');
const db = new Database(dbPath);

const TIMEZONE = process.env.TIMEZONE || 'America/Edmonton';

function getTimestamp(): string {
  const date = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZoneName: 'longOffset',
  };
  const parts = new Intl.DateTimeFormat('en-CA', options).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  const offset = get('timeZoneName').replace('GMT', '');
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}

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
    session_id TEXT,
    preferred_name TEXT
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
  preferred_name?: string;
}

const insertStmt = db.prepare(`
  INSERT INTO logs (timestamp, event_type, username, fingerprint, ip_address, user_agent, details, session_id, preferred_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const deleteOldStmt = db.prepare(`
  DELETE FROM logs WHERE timestamp < datetime('now', '-35 days')
`);

function cleanupOldLogs(): void {
  const result = deleteOldStmt.run();
  if (result.changes > 0) {
    console.log(`Cleaned up ${result.changes} log records older than 35 days`);
  }
}

// Run cleanup every 8 hours
const CLEANUP_INTERVAL_MS = 8 * 60 * 60 * 1000;
const cleanupTimer = setInterval(cleanupOldLogs, CLEANUP_INTERVAL_MS);

// Run cleanup on startup
cleanupOldLogs();

export function log(entry: LogEntry): void {
  const timestamp = getTimestamp();
  insertStmt.run(
    timestamp,
    entry.event_type,
    entry.username || null,
    entry.fingerprint || null,
    entry.ip_address || null,
    entry.user_agent || null,
    entry.details || null,
    entry.session_id || null,
    entry.preferred_name || null
  );
}

export function closeDatabase(): void {
  clearInterval(cleanupTimer);
  db.close();
}

export function queryLogsByFingerprint(fingerprint: string): any[] {
  const stmt = db.prepare(`
    SELECT timestamp, event_type, username, fingerprint, ip_address, user_agent, details, session_id
    FROM logs
    WHERE fingerprint LIKE ?
      AND event_type != 'auth_attempt'
    ORDER BY timestamp DESC
  `);
  return stmt.all(fingerprint + '%');
}

export function getTopPerformers(limit: number = 10): any[] {
  const stmt = db.prepare(`
    SELECT 
      username,
      MAX(CAST(SUBSTR(username, 9) AS INTEGER)) as level,
      fingerprint,
      MAX(timestamp) as last_seen,
      (SELECT preferred_name FROM logs 
       WHERE username = l.username 
         AND fingerprint = l.fingerprint 
         AND preferred_name IS NOT NULL 
       ORDER BY timestamp DESC LIMIT 1) as preferred_name
    FROM logs l
    WHERE event_type = 'auth_success' 
      AND username LIKE 'overlord%'
    GROUP BY username, fingerprint
    ORDER BY level DESC, last_seen DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

export function getRecentSuccessfulLogins(limit: number = 10): any[] {
  const stmt = db.prepare(`
    SELECT timestamp, username, fingerprint, ip_address
    FROM logs
    WHERE event_type = 'auth_success'
    ORDER BY timestamp DESC
    LIMIT ?
  `);
  return stmt.all(limit);
}

console.log(`SQLite database initialized at: ${dbPath}`);
