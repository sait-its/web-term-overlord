import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { Client, ClientChannel } from 'ssh2';
import { log, closeDatabase } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HTTP_PORT = process.env.WEB_TERM_PORT || 8080;
const SSH_HOST = process.env.BACKEND_SSH_HOST || 'localhost';
const SSH_PORT = parseInt(process.env.BACKEND_SSH_PORT || '2222', 10);

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

interface Session {
  ssh: Client;
  stream: ClientChannel | null;
  sessionId: string;
  username?: string;
  fingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

const sessions = new Map<WebSocket, Session>();

function generateSessionId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
  }
  return req.socket.remoteAddress || 'unknown';
}

function getUserAgent(req: http.IncomingMessage): string {
  return req.headers['user-agent'] || 'unknown';
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  let pathname = url.pathname;

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const clientDir = path.join(__dirname, '..', 'client');
  let filePath = path.join(clientDir, pathname);

  // Serve ghostty-web from node_modules
  if (pathname.startsWith('/node_modules/')) {
    filePath = path.join(__dirname, '..', '..', pathname);
  }

  // Serve assets from client/assets
  if (pathname.startsWith('/assets/')) {
    filePath = path.join(clientDir, pathname);
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const cols = parseInt(url.searchParams.get('cols') || '80', 10);
  const rows = parseInt(url.searchParams.get('rows') || '24', 10);

  const sessionId = generateSessionId();
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  const ssh = new Client();
  sessions.set(ws, { 
    ssh, 
    stream: null, 
    sessionId,
    ipAddress,
    userAgent
  });

  let authenticated = false;

  ws.on('message', (data) => {
    const message = data.toString('utf8');

    if (!authenticated) {
      try {
        const auth = JSON.parse(message);
        if (auth.type === 'auth') {
          const session = sessions.get(ws);
          if (session) {
            session.username = auth.username;
            session.fingerprint = auth.fingerprint;
          }

          log({
            event_type: 'auth_attempt',
            username: auth.username,
            fingerprint: auth.fingerprint,
            ip_address: session?.ipAddress,
            user_agent: session?.userAgent,
            session_id: session?.sessionId,
            details: 'Authentication attempt'
          });

          ssh.on('ready', () => {
            authenticated = true;

            log({
              event_type: 'auth_success',
              username: auth.username,
              fingerprint: auth.fingerprint,
              ip_address: session?.ipAddress,
              user_agent: session?.userAgent,
              session_id: session?.sessionId,
              details: 'SSH authentication successful'
            });

            ssh.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
              if (err) {
                log({
                  event_type: 'error',
                  username: auth.username,
                  fingerprint: auth.fingerprint,
                  ip_address: session?.ipAddress,
                  user_agent: session?.userAgent,
                  session_id: session?.sessionId,
                  details: `Failed to start shell: ${err.message}`
                });
                ws.send(`\r\n\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
                ws.close();
                return;
              }

              if (session) {
                session.stream = stream;
              }

              stream.on('data', (chunk: Buffer) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(chunk.toString('utf8'));
                }
              });

              stream.on('close', () => {
                ws.close();
              });

              stream.stderr.on('data', (chunk: Buffer) => {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(chunk.toString('utf8'));
                }
              });
            });
          });

          ssh.on('error', (err) => {
            const isConnectionError = err.message.includes('ECONNREFUSED') || 
                                      err.message.includes('ETIMEDOUT') ||
                                      err.message.includes('ENOTFOUND') ||
                                      err.message.includes('EHOSTUNREACH');
            
            const eventType = isConnectionError ? 'connection_error' : 'auth_failure';
            const userMessage = isConnectionError 
              ? 'Connection refused - SSH server may not be running'
              : 'Authentication failed';

            log({
              event_type: eventType,
              username: auth.username,
              fingerprint: auth.fingerprint,
              ip_address: session?.ipAddress,
              user_agent: session?.userAgent,
              session_id: session?.sessionId,
              details: `SSH error: ${err.message}`
            });
            ws.send(JSON.stringify({ type: 'error', error: userMessage }), () => {
              ws.close();
            });
          });

          ssh.connect({
            host: SSH_HOST,
            port: SSH_PORT,
            username: auth.username,
            password: auth.password,
          });
        }
      } catch {
        // Not JSON, ignore before auth
      }
      return;
    }

    // Handle resize
    if (message.startsWith('{')) {
      try {
        const msg = JSON.parse(message);
        if (msg.type === 'resize') {
          const session = sessions.get(ws);
          if (session?.stream) {
            session.stream.setWindow(msg.rows, msg.cols, 0, 0);
          }
          return;
        }
      } catch {
        // Not JSON, send to SSH
      }
    }

    const session = sessions.get(ws);
    if (session?.stream) {
      session.stream.write(message);
    }
  });

  ws.on('close', () => {
    const session = sessions.get(ws);
    if (session) {
      session.stream?.close();
      session.ssh.end();
      sessions.delete(ws);
    }
  });

  ws.on('error', () => {
    // Ignore
  });

  // Send auth prompt
  ws.send(JSON.stringify({ type: 'auth_required' }));
});

httpServer.listen(HTTP_PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  Web Terminal Server');
  console.log('='.repeat(60));
  console.log(`\n  Open: http://localhost:${HTTP_PORT}`);
  console.log(`  SSH Target: ${SSH_HOST}:${SSH_PORT}`);
  console.log(`\n  Press Ctrl+C to stop.\n`);
});

process.on('SIGINT', () => {
  console.log('\n\nShutting down...');
  for (const [ws, session] of sessions.entries()) {
    session.stream?.close();
    session.ssh.end();
    ws.close();
  }
  wss.close();
  closeDatabase();
  process.exit(0);
});
