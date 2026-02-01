# AGENTS.md

## Project Overview

Overlord is a web-based SSH terminal client built with [ghostty-web](https://github.com/coder/ghostty-web) for terminal emulation and Node.js/Bun for the backend SSH proxy.

## Architecture

```
Browser (ghostty-web) <--WebSocket--> Node.js/Bun Server <--SSH--> SSH Server (port 2222)
```

## Project Structure

```
web-term/
├── src/
│   ├── client/
│   │   ├── index.html        # Frontend with ghostty-web terminal
│   │   ├── leaderboard.html  # Leaderboard page
│   │   ├── instructions.txt  # Per-user instructions file
│   │   ├── assets/           # UI icons (fingerprint, copy, font controls)
│   │   ├── modules/          # Client-side JavaScript modules
│   │   │   ├── main.js       # Main entry point, login handling
│   │   │   ├── connection.js # WebSocket connection management
│   │   │   ├── terminal.js   # Terminal initialization and management
│   │   │   ├── ui.js         # UI state and event handlers
│   │   │   ├── utils.js      # Utilities (fingerprint, sanitization)
│   │   │   └── leaderboard.js # Leaderboard functionality
│   │   └── style.css         # Global styles
│   ├── server/
│   │   ├── index.ts          # WebSocket server with SSH client
│   │   └── database.ts       # SQLite logging module
│   └── audit/                # Security audit tools ⭐
│       ├── check-injections.sh      # Full security audit
│       ├── quick-check.sh           # Fast security check
│       ├── clean-database.sh        # Database cleanup script
│       ├── verify-truncation.sh     # Verify 16-char limit
│       ├── test-sanitization.sh     # Test sanitization
│       ├── sql-queries.sql          # Manual SQL queries
│       ├── examples.sh              # Usage examples
│       ├── summary.sh               # Audit summary
│       ├── README.md                # Audit documentation
│       ├── CLEANUP_REPORT.md        # Cleanup details
│       ├── TRUNCATION_VERIFICATION.md # Truncation verification
│       └── audit-report-*.txt       # Generated reports
├── backups/                  # Database backups (auto-created)
├── logs.db                   # SQLite database for auth logs
├── package.json
├── tsconfig.json
├── Dockerfile                # Uses Bun as runtime
├── README.md
└── AGENTS.md                 # This file
```

## Key Technologies

- **Frontend**: ghostty-web (WASM-based terminal emulator with xterm.js API compatibility)
- **Backend**: Node.js or Bun with TypeScript
- **SSH**: ssh2 library
- **WebSocket**: ws library
- **Database**: better-sqlite3 for logging
- **Fingerprinting**: @fingerprintjs/fingerprintjs
- **Container**: Bun-based Docker image

## Development Commands

```bash
# Install dependencies (npm)
npm install

# Install dependencies (bun)
bun install

# Run development server (npm)
npm run dev

# Run development server (bun)
bun run src/server/index.ts

# Build TypeScript
npm run build

# Run production server
npm start
```

## Environment Variables

- `WEB_TERM_PORT` - HTTP server port (default: 8080)
- `BACKEND_SSH_HOST` - SSH server hostname (default: localhost)
- `BACKEND_SSH_PORT` - SSH server port (default: 2222)

## Code Conventions

- TypeScript for server code
- ES modules
- Monospace fonts: Monaco, Menlo, 'Courier New'
- Dark theme colors: background #1e1e1e, foreground #d4d4d4
- Accent color: #27c93f (green)

## Authentication Flow

1. User enters username/password in login form
2. If username is overlord12+, optional preferred name field appears (max 16 chars)
3. Frontend generates browser fingerprint using FingerprintJS
4. Frontend connects via WebSocket to backend
5. Backend sends `auth_required` message
6. Frontend sends credentials with fingerprint and optional preferred name
7. Backend logs auth attempt to SQLite database (including preferred name)
8. Backend establishes SSH connection
9. On success: terminal session starts, title changes to "Overlord", progress bar shown, auth success logged with preferred name
10. On failure: auth failure logged, page reloads, username preserved via sessionStorage

## Terminal Features

- Font size adjustment (+/- buttons, range 12-28px)
- Fingerprint button - shows browser fingerprint dialog
- Auto-resize on window resize
- Reconnect button
- Connection status indicator
- Flashing error messages in title bar

## Fingerprint Dialog

- Click fingerprint icon in title bar to open
- Displays first 12 characters of browser fingerprint
- Copy icon next to fingerprint - click to copy to clipboard (turns green, then closes dialog)
- Round X button at top-right to close
- Press `ESC` or `q` key to close
- Click outside dialog to close
- Uses FingerprintJS library for reliable browser identification

## Instructions Panel

- Toggle button appears after login (if user has instructions)
- Left pane with resizable width (20-40% viewport, drag handle on right edge)
- Parses `src/client/instructions.txt` for per-user content
- Format: general text, then `===========overlordX=====` markers for each user section
- Username highlighted in green in the greeting line

## Progress Bar

- Displayed in title bar after login for overlordX users
- Shows current level vs max level (e.g., "5/15")
- Max level auto-detected from instructions.txt markers
- Green fill (#27c93f) indicates progress percentage

## Preferred Names

- Optional field appears in login form for overlord12+ users
- Max 16 characters (enforced on client and server)
- Stored in logs table with each auth attempt/success
- Displayed on leaderboard instead of fingerprint
- Hover over preferred name on leaderboard to reveal fingerprint
- Click to search by fingerprint

### Security & Sanitization

**Multi-layer protection against injection attacks:**

1. **Client-side Sanitization** (`src/client/modules/main.js:72`)
   - Removes HTML special characters: `<`, `>`, `'`, `"`, `&`
   - Strips non-printable ASCII characters
   - Enforces 16 character maximum length
   - Applied before sending to server

2. **HTML Input Constraint** (`src/client/index.html:66`)
   - Browser-enforced `maxlength="16"` attribute
   - Prevents typing more than 16 characters

3. **Server-side Validation** (`src/server/index.ts:60-74`)
   - Final defense layer (cannot be bypassed)
   - Sanitizes all input before database insertion
   - Removes dangerous characters
   - Truncates to 16 characters
   - Returns `undefined` if empty after sanitization

4. **HTML Escaping on Display** (`src/client/modules/leaderboard.js`)
   - Escapes HTML entities when rendering names
   - Prevents XSS attacks even if malicious data exists

**Protected against:**
- ✅ XSS (Cross-Site Scripting)
- ✅ HTML Injection
- ✅ SQL Injection (via parameterized queries)
- ✅ Command Injection
- ✅ Length-based attacks

## Database Audit Tools

Security audit scripts located in `src/audit/`:

### Quick Commands

```bash
# Daily quick check (30 seconds)
cd src/audit && ./quick-check.sh

# Weekly full audit (1 minute)
cd src/audit && ./check-injections.sh

# Clean malicious entries
cd src/audit && ./clean-database.sh

# Preview cleanup (dry-run)
cd src/audit && DRY_RUN=true ./clean-database.sh

# Verify truncation working
cd src/audit && ./verify-truncation.sh

# Test sanitization demo
cd src/audit && ./test-sanitization.sh

# View summary
cd src/audit && ./summary.sh
```

### Audit Scripts

| Script | Purpose | Output |
|--------|---------|--------|
| `check-injections.sh` | Full security audit | Console + report file |
| `quick-check.sh` | Fast security check | Console only |
| `clean-database.sh` | Remove/sanitize malicious entries | Interactive cleanup |
| `verify-truncation.sh` | Verify 16-char limit enforced | Statistics |
| `test-sanitization.sh` | Demo blocked attack patterns | Test results |
| `sql-queries.sql` | Manual SQL query collection | SQL commands |
| `examples.sh` | Usage guide and examples | Help text |
| `summary.sh` | Show audit summary | Summary report |

### Audit Checks

**Detects:**
- HTML tags: `<script>`, `<iframe>`, `<img>`, `<h1>`, etc.
- XSS patterns: `javascript:`, `onerror=`, `onclick=`, etc.
- SQL injection: `' OR '1'='1`, `'; DROP TABLE`, etc.
- Command injection: `$(command)`, backticks, pipes
- Special characters: `<`, `>`, `&`, `"`, `'`
- Length violations: Names exceeding 16 characters
- Non-ASCII characters: Emojis, control characters

### Documentation

- `src/audit/README.md` - Comprehensive audit guide
- `src/audit/CLEANUP_REPORT.md` - Database cleanup details
- `src/audit/TRUNCATION_VERIFICATION.md` - Truncation verification
- `src/audit/audit-report-*.txt` - Audit history (auto-generated)

### Scheduled Audits

```bash
# Add to crontab for automatic security checks
crontab -e

# Daily quick check at 2 AM
0 2 * * * cd /home/yanh/dev/web-term/src/audit && ./quick-check.sh

# Weekly full audit on Sunday at 3 AM
0 3 * * 0 cd /home/yanh/dev/web-term/src/audit && ./check-injections.sh
```
