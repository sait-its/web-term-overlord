# Overlord

A web-based SSH terminal client using [ghostty-web](https://github.com/coder/ghostty-web) for terminal emulation.

## Features

- Full terminal emulation via ghostty-web (WASM-based, xterm.js compatible)
- SSH connection to local or remote servers
- Adjustable font size (+/- buttons)
- Dark theme
- Connection status indicator
- Auto-reconnect support
- Docker support
- **Instructions panel** - Toggleable left pane with per-user instructions
- **Progress bar** - Shows user progress through overlord levels (e.g., 5/15)
- Resizable instructions pane (drag to resize, 20-40% viewport width)

## Quick Start

### Prerequisites

- Node.js 24+ or Bun 1.3.5+
- An SSH server running on port 2222 (configurable)

### Installation

```bash
# Using npm
npm install

# Using bun
bun install
```

### Running

```bash
# Development mode (npm)
npm run dev

# Development mode (bun)
bun run src/server/index.ts

# Production mode (npm)
npm run build
npm start

# Production mode (bun)
bun run src/server/index.ts
```

Open http://localhost:8080 in your browser.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEB_TERM_PORT` | 8080 | HTTP server port |
| `BACKEND_SSH_HOST` | localhost | SSH server hostname |
| `BACKEND_SSH_PORT` | 2222 | SSH server port |

## Docker

The Docker image uses Bun as the runtime for better performance.

### Build

```bash
docker build -t overlord .
```

### Run

```bash
# Connect to host's SSH server
docker run -p 8080:8080 --add-host=host.docker.internal:host-gateway overlord

# Or specify a different SSH server
docker run -p 8080:8080 -e BACKEND_SSH_HOST=192.168.1.100 -e BACKEND_SSH_PORT=22 overlord

# Custom web port
docker run -p 3000:3000 -e WEB_TERM_PORT=3000 overlord
```

## Usage

1. Open http://localhost:8080
2. Enter your SSH username and password
3. Click "Connect"

### UI Features

- **Font size**: Use +/- buttons in the title bar to adjust terminal font size (8-32px)
- **Instructions**: Click "Instructions" button to toggle the left panel with user-specific guidance
- **Progress bar**: Shows current level progress (e.g., "5/15" for overlord5)
- **Reconnect**: Click "Reconnect" button to re-establish connection

### Instructions File

The `src/client/instructions.txt` file contains per-user instructions:

```
General instructions here (shown to all users)

===========overlord0======================
Instructions specific to overlord0

===========overlord1======================
Instructions specific to overlord1
```

- Text before the first `=====overlordX=====` marker is general instructions
- Each user sees general instructions + their specific section
- The highest overlord number determines the progress bar maximum

## Architecture

The application consists of two main components:

### Server (`src/server/index.ts`)
- HTTP server serving static files (HTML, CSS, JS, WASM)
- WebSocket server handling terminal connections
- SSH client (ssh2) connecting to backend SSH server
- Session management for multiple concurrent users
- Terminal resize handling

### Client (`src/client/index.html`)
- Single-page application with embedded styles and scripts
- ghostty-web terminal emulator (WASM-based)
- Login form with username/password authentication
- Instructions panel with per-user content parsing
- Progress bar showing user level advancement
- Font size controls and reconnection handling

```
┌─────────────────┐     WebSocket      ┌─────────────────┐      SSH       ┌─────────────────┐
│                 │ ◄────────────────► │                 │ ◄────────────► │                 │
│  Browser        │                    │  Node.js/Bun    │                │  SSH Server     │
│  (ghostty-web)  │                    │  Server         │                │  (port 2222)    │
│                 │                    │                 │                │                 │
└─────────────────┘                    └─────────────────┘                └─────────────────┘
```

## License

MIT
