#!/bin/bash
# Database Audit - Usage Examples
# This file shows how to use the audit tools

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Database Audit Tools - Usage Guide                 ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

cat << 'USAGE'

QUICK START
===========

1. Quick Check (30 seconds)
   ./quick-check.sh

2. Full Security Audit (1 minute)
   ./check-injections.sh

3. Test Sanitization (demo)
   ./test-sanitization.sh


DETAILED USAGE
==============

1. QUICK CHECK
   -------------
   Fast security check for common issues

   Usage:
     ./quick-check.sh
     ./quick-check.sh /path/to/logs.db

   Checks:
     ✓ HTML special characters (<, >, &)
     ✓ Quotes (' and ")
     ✓ Script tags
     ✓ Length violations

   Output: Console only


2. FULL AUDIT
   -----------
   Comprehensive security audit with detailed reporting

   Usage:
     ./check-injections.sh
     ./check-injections.sh /path/to/logs.db

   Features:
     ✓ XSS detection
     ✓ SQL injection detection
     ✓ Command injection detection
     ✓ Non-ASCII character check
     ✓ Length validation
     ✓ Color-coded output
     ✓ Generates report file

   Output:
     - Console with colors
     - audit-report-YYYYMMDD-HHMMSS.txt


3. MANUAL SQL QUERIES
   -------------------
   Run custom queries against the database

   Usage:
     sqlite3 ../../logs.db
     .read sql-queries.sql

   Or run individual queries:
     sqlite3 ../../logs.db "SELECT * FROM logs WHERE preferred_name IS NOT NULL;"


4. TEST SANITIZATION
   ------------------
   Demonstrate what inputs are blocked

   Usage:
     ./test-sanitization.sh

   Shows:
     ✓ Common attack patterns
     ✓ How they're sanitized
     ✓ Safe input examples


COMMON TASKS
============

Check for XSS attempts:
  sqlite3 ../../logs.db "SELECT * FROM logs WHERE preferred_name LIKE '%<script%';"

Check for SQL injection:
  sqlite3 ../../logs.db "SELECT * FROM logs WHERE preferred_name LIKE '%''%' OR preferred_name LIKE '%;--%';"

List all unique names:
  sqlite3 ../../logs.db "SELECT DISTINCT preferred_name, COUNT(*) FROM logs WHERE preferred_name IS NOT NULL GROUP BY preferred_name;"

Track specific user:
  sqlite3 ../../logs.db "SELECT * FROM logs WHERE fingerprint LIKE 'abc123%' ORDER BY timestamp DESC;"

Export to CSV:
  sqlite3 ../../logs.db -csv -header "SELECT * FROM logs WHERE preferred_name IS NOT NULL;" > export.csv


SCHEDULING AUDITS
=================

Run daily at 2 AM:
  crontab -e
  0 2 * * * cd /home/yanh/dev/web-term/src/audit && ./check-injections.sh

Run weekly on Sunday:
  0 2 * * 0 cd /home/yanh/dev/web-term/src/audit && ./check-injections.sh

Keep last 30 days of reports:
  find /home/yanh/dev/web-term/src/audit -name "audit-report-*.txt" -mtime +30 -delete


BACKUP DATABASE
===============

Before cleaning data:
  cp ../../logs.db ../../logs.db.backup.$(date +%Y%m%d_%H%M%S)

Export to SQL:
  sqlite3 ../../logs.db .dump > logs_backup.sql

Restore from backup:
  cp logs.db.backup.20260201_015600 logs.db


TROUBLESHOOTING
===============

Scripts not running:
  chmod +x *.sh

Database not found:
  # Use full path
  ./check-injections.sh /home/yanh/dev/web-term/logs.db

Permission denied:
  # Check database permissions
  ls -la ../../logs.db

SQLite not installed:
  sudo apt-get install sqlite3  # Ubuntu/Debian
  brew install sqlite3          # macOS


SECURITY CHECKLIST
==================

Daily:
  ☐ Run quick-check.sh
  ☐ Review unique preferred names

Weekly:
  ☐ Run full audit (check-injections.sh)
  ☐ Review audit reports
  ☐ Check for unusual patterns

Monthly:
  ☐ Backup database
  ☐ Review all audit reports
  ☐ Update security measures if needed


FILES IN THIS DIRECTORY
========================

check-injections.sh      - Full security audit script
quick-check.sh          - Fast security check
sql-queries.sql         - Manual SQL query collection
test-sanitization.sh    - Sanitization demo/test
README.md              - Comprehensive documentation
audit-report-*.txt     - Generated audit reports (created by check-injections.sh)
examples.sh            - This file


SECURITY STATUS
===============

Current Protection:
  ✅ Client-side sanitization (src/client/modules/main.js)
  ✅ HTML escaping on display (src/client/modules/leaderboard.js)
  ✅ Server-side validation (src/server/index.ts)
  ✅ Parameterized SQL queries (defense against SQL injection)
  ✅ Length enforcement (16 characters max)

Database Status:
  ✅ Clean - No malicious entries detected
  ✅ 4 entries with preferred names
  ✅ All names properly sanitized


NEED HELP?
==========

Read full documentation:
  cat README.md

Run test suite:
  ./test-sanitization.sh

Check database manually:
  sqlite3 ../../logs.db
  .mode column
  .headers on
  SELECT * FROM logs LIMIT 10;

USAGE

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For detailed documentation, see: README.md"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
