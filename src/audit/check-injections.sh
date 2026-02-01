#!/bin/bash
# Database Security Audit Script for Preferred Names
# Checks for potential injection attempts in the logs database

set -e

# Configuration
DB_PATH="${1:-../../logs.db}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database not found at: $DB_PATH${NC}"
    echo "Usage: $0 [path/to/logs.db]"
    exit 1
fi

echo "╔════════════════════════════════════════════════════════════╗"
echo "║         Database Security Audit - Preferred Names          ║"
echo "╟────────────────────────────────────────────────────────────╢"
echo "║ Database: $DB_PATH"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# 1. Statistics
echo -e "${BLUE}📊 STATISTICS${NC}"
echo "─────────────────────────────────────────────────────────────"
sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
SELECT
    'Total with preferred_name' as metric,
    COUNT(*) as count
FROM logs
WHERE preferred_name IS NOT NULL
UNION ALL
SELECT
    'With angle brackets (<>)' as metric,
    COUNT(*) as count
FROM logs
WHERE preferred_name LIKE '%<%' OR preferred_name LIKE '%>%'
UNION ALL
SELECT
    'With quotes' as metric,
    COUNT(*) as count
FROM logs
WHERE preferred_name LIKE '%''%' OR preferred_name LIKE '%"%'
UNION ALL
SELECT
    'With ampersand (&)' as metric,
    COUNT(*) as count
FROM logs
WHERE preferred_name LIKE '%&%'
UNION ALL
SELECT
    'With script tags' as metric,
    COUNT(*) as count
FROM logs
WHERE preferred_name LIKE '%<script%';
SQL
echo ""

# 2. All unique preferred names
echo -e "${BLUE}📝 ALL UNIQUE PREFERRED NAMES${NC}"
echo "─────────────────────────────────────────────────────────────"
sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
.width 20 5 20 20
SELECT
    preferred_name,
    COUNT(*) as uses,
    MIN(datetime(timestamp)) as first_used,
    MAX(datetime(timestamp)) as last_used
FROM logs
WHERE preferred_name IS NOT NULL
GROUP BY preferred_name
ORDER BY uses DESC
LIMIT 20;
SQL
echo ""

# 3. Suspicious entries
echo -e "${YELLOW}⚠️  SUSPICIOUS ENTRIES (Potential Injection Attempts)${NC}"
echo "─────────────────────────────────────────────────────────────"
SUSPICIOUS=$(sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
.width 20 12 16 12 15
SELECT
    datetime(timestamp) as time,
    username,
    preferred_name,
    SUBSTR(fingerprint, 1, 12) as fingerprint,
    event_type
FROM logs
WHERE preferred_name IS NOT NULL
  AND (
    preferred_name LIKE '%<%' OR
    preferred_name LIKE '%>%' OR
    preferred_name LIKE '%<script%' OR
    preferred_name LIKE '%javascript:%' OR
    preferred_name LIKE '%onclick%' OR
    preferred_name LIKE '%onerror%' OR
    preferred_name LIKE '%onload%' OR
    preferred_name LIKE '%''%' OR
    preferred_name LIKE '%"%' OR
    preferred_name LIKE '%OR%1=1%' OR
    preferred_name LIKE '%DROP%' OR
    preferred_name LIKE '%DELETE%' OR
    preferred_name LIKE '%&%' OR
    preferred_name LIKE '%\%' OR
    preferred_name LIKE '%`%' OR
    preferred_name LIKE '%$(%'
  )
ORDER BY timestamp DESC
LIMIT 50;
SQL
)

if [ -z "$SUSPICIOUS" ]; then
    echo -e "${GREEN}✅ No suspicious entries found!${NC}"
else
    echo "$SUSPICIOUS"
fi
echo ""

# 4. Count suspicious entries
SUSPICIOUS_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name IS NOT NULL AND (preferred_name LIKE '%<%' OR preferred_name LIKE '%>%' OR preferred_name LIKE '%&%' OR preferred_name LIKE '%\"%' OR preferred_name LIKE '%''%');")

# 5. Check for non-ASCII characters
echo -e "${BLUE}🌍 NON-ASCII CHARACTERS${NC}"
echo "─────────────────────────────────────────────────────────────"
NON_ASCII=$(sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
SELECT
    preferred_name,
    COUNT(*) as count
FROM logs
WHERE preferred_name IS NOT NULL
  AND preferred_name GLOB '*[^[:print:]]*'
GROUP BY preferred_name;
SQL
)

if [ -z "$NON_ASCII" ]; then
    echo -e "${GREEN}✅ All preferred names contain only printable ASCII${NC}"
else
    echo "$NON_ASCII"
fi
echo ""

# 6. Check for excessive length (should never happen with sanitization)
echo -e "${BLUE}📏 LENGTH VIOLATIONS (>16 characters)${NC}"
echo "─────────────────────────────────────────────────────────────"
LONG_NAMES=$(sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
SELECT
    preferred_name,
    LENGTH(preferred_name) as length,
    COUNT(*) as count
FROM logs
WHERE preferred_name IS NOT NULL
  AND LENGTH(preferred_name) > 16
GROUP BY preferred_name;
SQL
)

if [ -z "$LONG_NAMES" ]; then
    echo -e "${GREEN}✅ All preferred names are within length limit${NC}"
else
    echo -e "${RED}⚠️  Found names exceeding 16 characters:${NC}"
    echo "$LONG_NAMES"
fi
echo ""

# Summary
echo "═════════════════════════════════════════════════════════════"
echo -e "${BLUE}SUMMARY${NC}"
echo "─────────────────────────────────────────────────────────────"
if [ "$SUSPICIOUS_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅ Database is clean - no injection attempts detected${NC}"
else
    echo -e "${YELLOW}⚠️  Found $SUSPICIOUS_COUNT entries with special characters${NC}"
    echo "   These entries may need review or cleaning."
fi
echo ""

# Generate report file
REPORT_FILE="$SCRIPT_DIR/audit-report-$(date +%Y%m%d-%H%M%S).txt"
echo "📄 Detailed report saved to: $REPORT_FILE"

# Create detailed report
{
    echo "Database Security Audit Report"
    echo "Generated: $(date)"
    echo "Database: $DB_PATH"
    echo ""
    echo "="
    echo ""

    sqlite3 "$DB_PATH" << 'SQL'
.mode list
SELECT
    'Total entries with preferred_name: ' || COUNT(*)
FROM logs
WHERE preferred_name IS NOT NULL;

SELECT
    'Suspicious entries: ' || COUNT(*)
FROM logs
WHERE preferred_name IS NOT NULL
  AND (preferred_name LIKE '%<%' OR preferred_name LIKE '%>%' OR preferred_name LIKE '%&%');

.mode column
.headers on

SELECT char(10) || '--- All Unique Preferred Names ---' || char(10);

SELECT preferred_name, COUNT(*) as uses
FROM logs
WHERE preferred_name IS NOT NULL
GROUP BY preferred_name
ORDER BY uses DESC;

SELECT char(10) || '--- Recent Activity ---' || char(10);

SELECT
    datetime(timestamp) as time,
    username,
    preferred_name,
    event_type
FROM logs
WHERE preferred_name IS NOT NULL
ORDER BY timestamp DESC
LIMIT 20;
SQL
} > "$REPORT_FILE"

echo -e "${GREEN}✅ Audit complete!${NC}"
