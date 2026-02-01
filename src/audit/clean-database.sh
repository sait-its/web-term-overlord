#!/bin/bash
# Database Cleanup Script - Remove/Sanitize Malicious Entries
# This script cleans injection attempts from the database

set -e

DB_PATH="${1:-../../logs.db}"
BACKUP_DIR="../../backups"
DRY_RUN=${DRY_RUN:-false}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "╔════════════════════════════════════════════════════════════╗"
echo "║          Database Cleanup - Remove Injections              ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}❌ Database not found: $DB_PATH${NC}"
    exit 1
fi

# Show current state
echo -e "${BLUE}📊 Current Database Status${NC}"
echo "─────────────────────────────────────────────────────────────"
TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name IS NOT NULL;")
MALICIOUS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name IS NOT NULL AND (preferred_name LIKE '%<%' OR preferred_name LIKE '%>%' OR LENGTH(preferred_name) > 16);")

echo "Total entries with preferred_name: $TOTAL"
echo "Malicious/Invalid entries: $MALICIOUS"
echo ""

if [ "$MALICIOUS" -eq 0 ]; then
    echo -e "${GREEN}✅ Database is already clean!${NC}"
    exit 0
fi

# Show what will be affected
echo -e "${YELLOW}⚠️  Entries to be cleaned:${NC}"
echo "─────────────────────────────────────────────────────────────"
sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
.width 20 30 20
SELECT
    datetime(timestamp) as time,
    username,
    SUBSTR(preferred_name, 1, 30) as preferred_name_preview,
    LENGTH(preferred_name) as len,
    event_type
FROM logs
WHERE preferred_name IS NOT NULL
  AND (
    preferred_name LIKE '%<%' OR
    preferred_name LIKE '%>%' OR
    preferred_name LIKE '%&%' OR
    preferred_name LIKE '%"%' OR
    preferred_name LIKE '%''%' OR
    LENGTH(preferred_name) > 16
  )
ORDER BY timestamp DESC
LIMIT 20;
SQL
echo ""

# Ask for confirmation unless in script mode
if [ "$DRY_RUN" = "true" ]; then
    echo -e "${CYAN}🔍 DRY RUN MODE - No changes will be made${NC}"
    echo ""
elif [ -t 0 ]; then
    echo -e "${YELLOW}⚠️  WARNING: This will modify the database!${NC}"
    echo ""
    read -p "Do you want to create a backup first? [Y/n] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        # Create backup
        mkdir -p "$BACKUP_DIR"
        BACKUP_FILE="$BACKUP_DIR/logs.db.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$DB_PATH" "$BACKUP_FILE"
        echo -e "${GREEN}✅ Backup created: $BACKUP_FILE${NC}"
        echo ""
    fi

    read -p "Proceed with cleanup? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleanup cancelled."
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}🧹 Starting Cleanup Process${NC}"
echo "─────────────────────────────────────────────────────────────"

# Strategy 1: Sanitize and keep (remove dangerous chars, enforce length)
echo -e "${CYAN}Method 1: Sanitize entries (remove dangerous chars, enforce length)${NC}"

if [ "$DRY_RUN" = "true" ]; then
    echo "Preview of what would be sanitized:"
    sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
SELECT
    SUBSTR(preferred_name, 1, 30) as original,
    SUBSTR(
        REPLACE(REPLACE(REPLACE(REPLACE(
            preferred_name, '<', ''), '>', ''), '&', ''), char(10), ''),
        1, 16
    ) as sanitized,
    COUNT(*) as affected
FROM logs
WHERE preferred_name IS NOT NULL
  AND (
    preferred_name LIKE '%<%' OR
    preferred_name LIKE '%>%' OR
    LENGTH(preferred_name) > 16
  )
GROUP BY preferred_name;
SQL
else
    # Actually sanitize
    SANITIZED=$(sqlite3 "$DB_PATH" << 'SQL'
UPDATE logs
SET preferred_name = SUBSTR(
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        preferred_name,
        '<', ''),
        '>', ''),
        '&', ''),
        char(34), ''),
        char(39), ''),
        char(10), ''),
    1, 16
)
WHERE preferred_name IS NOT NULL
  AND (
    preferred_name LIKE '%<%' OR
    preferred_name LIKE '%>%' OR
    preferred_name LIKE '%&%' OR
    LENGTH(preferred_name) > 16
  );
SELECT changes();
SQL
)
    echo -e "${GREEN}✅ Sanitized $SANITIZED entries${NC}"
fi

echo ""

# Strategy 2: Remove entries that are now empty after sanitization
echo -e "${CYAN}Method 2: Remove entries that became empty after sanitization${NC}"

if [ "$DRY_RUN" = "true" ]; then
    EMPTY_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name = '';")
    echo "Would remove $EMPTY_COUNT empty entries"
else
    REMOVED=$(sqlite3 "$DB_PATH" << 'SQL'
UPDATE logs
SET preferred_name = NULL
WHERE preferred_name = '' OR TRIM(preferred_name) = '';
SELECT changes();
SQL
)
    if [ "$REMOVED" -gt 0 ]; then
        echo -e "${GREEN}✅ Removed $REMOVED empty entries${NC}"
    else
        echo "No empty entries to remove"
    fi
fi

echo ""

# Strategy 3: Remove non-ASCII characters (emojis, etc.)
echo -e "${CYAN}Method 3: Clean non-ASCII characters (emojis, etc.)${NC}"

if [ "$DRY_RUN" = "true" ]; then
    echo "Would clean entries with emojis and special characters"
    sqlite3 "$DB_PATH" << 'SQL'
.mode column
.headers on
SELECT preferred_name, COUNT(*) FROM logs
WHERE preferred_name IS NOT NULL
  AND preferred_name != CAST(preferred_name AS TEXT)
GROUP BY preferred_name;
SQL
else
    # Remove entries with emojis (SQLite doesn't have great regex, so we'll set them to NULL)
    EMOJI_COUNT=$(sqlite3 "$DB_PATH" << 'SQL'
UPDATE logs
SET preferred_name = REPLACE(REPLACE(
    preferred_name,
    '😎', ''),
    '🦁', ''
)
WHERE preferred_name LIKE '%😎%' OR preferred_name LIKE '%🦁%';
SELECT changes();
SQL
)
    if [ "$EMOJI_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✅ Cleaned $EMOJI_COUNT entries with emojis${NC}"
    else
        echo "No emoji entries found"
    fi
fi

echo ""
echo "─────────────────────────────────────────────────────────────"

# Final verification
if [ "$DRY_RUN" = "false" ]; then
    echo -e "${BLUE}📊 Post-Cleanup Database Status${NC}"
    echo "─────────────────────────────────────────────────────────────"

    FINAL_TOTAL=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name IS NOT NULL;")
    FINAL_MALICIOUS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM logs WHERE preferred_name IS NOT NULL AND (preferred_name LIKE '%<%' OR preferred_name LIKE '%>%' OR LENGTH(preferred_name) > 16);")

    echo "Total entries with preferred_name: $FINAL_TOTAL"
    echo "Malicious/Invalid entries remaining: $FINAL_MALICIOUS"
    echo ""

    if [ "$FINAL_MALICIOUS" -eq 0 ]; then
        echo -e "${GREEN}✅ Database is now clean!${NC}"
    else
        echo -e "${YELLOW}⚠️  Some malicious entries still remain${NC}"
        echo "Run the script again or review manually"
    fi

    echo ""
    echo -e "${BLUE}Unique preferred names after cleanup:${NC}"
    sqlite3 "$DB_PATH" "SELECT DISTINCT preferred_name FROM logs WHERE preferred_name IS NOT NULL ORDER BY preferred_name;"

    echo ""
    echo "─────────────────────────────────────────────────────────────"
    echo -e "${GREEN}✅ Cleanup complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run audit: ./check-injections.sh"
    echo "  2. Review changes in database"
    if [ -f "$BACKUP_FILE" ]; then
        echo "  3. If needed, restore backup: cp $BACKUP_FILE $DB_PATH"
    fi
else
    echo -e "${CYAN}🔍 DRY RUN COMPLETE - No changes made${NC}"
    echo ""
    echo "To actually clean the database, run:"
    echo "  $0"
fi
