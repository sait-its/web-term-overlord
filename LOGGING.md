# Logging System Documentation

## Overview

The web terminal includes authentication logging with browser fingerprinting. All auth-related events are stored in a SQLite database (`logs.db`) in the project root.

## Features

### Browser Fingerprinting
The client generates a unique fingerprint using the [FingerprintJS](https://github.com/fingerprintjs/fingerprintjs) library, which collects:
- Canvas rendering fingerprint
- WebGL vendor/renderer information
- Audio context properties
- Screen resolution, color depth, pixel ratio
- Timezone offset
- Language preferences
- Platform and hardware concurrency
- Touch support detection
- Font detection
- And many other browser signals

The fingerprint is a stable visitor ID that remains consistent across sessions.

### Logged Events

| Event Type | Description |
|------------|-------------|
| `auth_attempt` | User submitted credentials |
| `auth_success` | SSH authentication succeeded |
| `auth_failure` | SSH authentication failed |

### Database Schema

```sql
CREATE TABLE logs (
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
```

## Fingerprint Viewer

Users can view their browser fingerprint by clicking the fingerprint icon in the title bar:

- Displays first 12 characters of the fingerprint
- Click the copy icon to copy to clipboard
- Dialog closes automatically after copying (with green highlight feedback)
- Press `q` or click X button to close manually

## Usage

### Viewing Logs

```bash
# View all logs
sqlite3 logs.db "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 20;"

# View logs for specific user
sqlite3 logs.db "SELECT * FROM logs WHERE username='overlord0' ORDER BY timestamp DESC;"

# View authentication attempts
sqlite3 logs.db "SELECT timestamp, username, ip_address, event_type FROM logs WHERE event_type LIKE 'auth%' ORDER BY timestamp DESC;"

# View logs by fingerprint
sqlite3 logs.db "SELECT * FROM logs WHERE fingerprint LIKE 'abc123%' ORDER BY timestamp DESC;"

# Count events by type
sqlite3 logs.db "SELECT event_type, COUNT(*) as count FROM logs GROUP BY event_type;"

# View failed authentication attempts
sqlite3 logs.db "SELECT timestamp, username, ip_address, fingerprint FROM logs WHERE event_type='auth_failure' ORDER BY timestamp DESC;"
```

### Log Format

Each log entry contains:
- `id`: Auto-incrementing unique identifier
- `timestamp`: ISO 8601 format (UTC)
- `event_type`: Type of event (see table above)
- `username`: SSH username
- `fingerprint`: FingerprintJS visitor ID
- `ip_address`: Client IP address (supports X-Forwarded-For)
- `user_agent`: Browser user agent string
- `details`: Additional event-specific information
- `session_id`: Unique session identifier (format: `ws-{timestamp}-{random}`)

### Example Log Entry

```
id: 1
timestamp: 2026-01-11T20:00:00.000Z
event_type: auth_success
username: overlord0
fingerprint: abc123def456
ip_address: 192.168.1.100
user_agent: Mozilla/5.0 (X11; Linux x86_64)...
details: SSH authentication successful
session_id: ws-1736625600000-abc123def456
```

## Privacy Considerations

- Fingerprints are generated client-side using FingerprintJS
- IP addresses are logged for security monitoring
- User agents are stored for compatibility tracking
- All timestamps are in UTC

## Maintenance

### Database Backup

```bash
sqlite3 logs.db ".backup logs_backup.db"
```

### Clear Old Logs

```bash
# Delete logs older than 30 days
sqlite3 logs.db "DELETE FROM logs WHERE timestamp < datetime('now', '-30 days');"

# Vacuum to reclaim space
sqlite3 logs.db "VACUUM;"
```

### Export Logs

```bash
# Export to CSV
sqlite3 -header -csv logs.db "SELECT * FROM logs;" > logs.csv

# Export to JSON
sqlite3 logs.db "SELECT json_group_array(json_object('timestamp', timestamp, 'event_type', event_type, 'username', username, 'fingerprint', fingerprint)) FROM logs;" > logs.json
```
