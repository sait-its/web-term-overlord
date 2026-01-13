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
    entry.session_id || null
  );
}

export function closeDatabase(): void {
  clearInterval(cleanupTimer);
  db.close();
}

console.log(`SQLite database initialized at: ${dbPath}`);
