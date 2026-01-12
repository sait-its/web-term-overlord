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
│   │   ├── instructions.txt  # Per-user instructions file
│   │   └── assets/           # UI icons (fingerprint, copy, font controls)
│   └── server/
│       ├── index.ts          # WebSocket server with SSH client
│       └── database.ts       # SQLite logging module
├── logs.db                   # SQLite database for auth logs
├── package.json
├── tsconfig.json
├── Dockerfile                # Uses Bun as runtime
└── README.md
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
2. Frontend generates browser fingerprint using FingerprintJS
3. Frontend connects via WebSocket to backend
4. Backend sends `auth_required` message
5. Frontend sends credentials with fingerprint
6. Backend logs auth attempt to SQLite database
7. Backend establishes SSH connection
8. On success: terminal session starts, title changes to "Overlord", progress bar shown, auth success logged
9. On failure: auth failure logged, page reloads, username preserved via sessionStorage

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
- Press `q` key to close
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
