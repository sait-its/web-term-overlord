#!/bin/bash
# Quick database security checks
# Usage: ./quick-check.sh [path/to/logs.db]

DB_PATH="${1:-../../logs.db}"

if [ ! -f "$DB_PATH" ]; then
    echo "❌ Database not found: $DB_PATH"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Quick Database Security Check"
echo "  Database: $DB_PATH"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Count with preferred names
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name IS NOT NULL;")
echo "📊 Total entries with preferred names: $TOTAL"

# Check for dangerous characters
DANGEROUS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name LIKE '%<%' OR preferred_name LIKE '%>%' OR preferred_name LIKE '%&%';")
if [ "$DANGEROUS" -eq 0 ]; then
    echo "✅ No HTML special characters found"
else
    echo "⚠️  Found $DANGEROUS entries with HTML characters (<, >, &)"
fi

# Check for quotes
QUOTES=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name LIKE '%\"%' OR preferred_name LIKE '%''%';")
if [ "$QUOTES" -eq 0 ]; then
    echo "✅ No quotes found"
else
    echo "⚠️  Found $QUOTES entries with quotes"
fi

# Check for script tags
SCRIPTS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name LIKE '%<script%';")
if [ "$SCRIPTS" -eq 0 ]; then
    echo "✅ No script tags found"
else
    echo "🚨 Found $SCRIPTS entries with script tags!"
fi

# Check length violations
LONG=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE LENGTH(preferred_name) > 16;")
if [ "$LONG" -eq 0 ]; then
    echo "✅ All names within length limit (≤16 chars)"
else
    echo "⚠️  Found $LONG entries exceeding 16 characters"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Unique names
echo ""
echo "Unique preferred names:"
sqlite3 "$DB_PATH" "SELECT DISTINCT preferred_name FROM logs WHERE preferred_name IS NOT NULL ORDER BY preferred_name;"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Overall verdict
if [ "$DANGEROUS" -eq 0 ] && [ "$QUOTES" -eq 0 ] && [ "$SCRIPTS" -eq 0 ] && [ "$LONG" -eq 0 ]; then
    echo "✅ Database is CLEAN - No issues detected!"
else
    echo "⚠️  Database has potential issues - Run full audit for details"
    echo "   Use: ./check-injections.sh"
fi
