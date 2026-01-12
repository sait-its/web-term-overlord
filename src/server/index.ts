import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { Client, ClientChannel } from 'ssh2';

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
};

interface Session {
  ssh: Client;
  stream: ClientChannel | null;
}

const sessions = new Map<WebSocket, Session>();

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

  const ssh = new Client();
  sessions.set(ws, { ssh, stream: null });

  let authenticated = false;

  ws.on('message', (data) => {
    const message = data.toString('utf8');

    if (!authenticated) {
      try {
        const auth = JSON.parse(message);
        if (auth.type === 'auth') {
          ssh.on('ready', () => {
            authenticated = true;
            ssh.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
              if (err) {
                ws.send(`\r\n\x1b[31mFailed to start shell: ${err.message}\x1b[0m\r\n`);
                ws.close();
                return;
              }

              const session = sessions.get(ws);
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
            ws.send(`\r\n\x1b[31mSSH Error: ${err.message}\x1b[0m\r\n`);
            ws.close();
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
  process.exit(0);
});
