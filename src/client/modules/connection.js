export let ws;
let lastUsername = '';
let lastPassword = '';

export function getLastCredentials() { 
    return { username: lastUsername, password: lastPassword }; 
}

export function connect(username, password, terminalDims, fingerprint, callbacks) {
    // callbacks schema:
    // { setStatus, onAuthSuccess, onData, showLoginError }
    
    lastUsername = username;
    lastPassword = password;
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?cols=${terminalDims.cols}&rows=${terminalDims.rows}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    callbacks.setStatus('connecting', 'Connecting...');
    ws = new WebSocket(wsUrl);
    
    let authSuccess = false;
    let lastError = '';

    ws.onopen = () => {
        console.log('WebSocket opened');
    };

    ws.onmessage = (event) => {
        try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'auth_required') {
                console.log('Auth required, sending credentials');
                ws.send(JSON.stringify({ type: 'auth', username, password, fingerprint }));
                return;
            }
            if (msg.type === 'error') {
                lastError = msg.error;
                return;
            }
        } catch {
            // Not JSON, treat as terminal data
        }
        
        // If we received data (or non-auth/error JSON), we are authenticated.
        // We rely on the fact that the server sends something upon connection/auth.
        if (!authSuccess) {
             authSuccess = true;
             callbacks.onAuthSuccess(username);
        }
        
        callbacks.onData(event.data);
    };
    
    ws.onerror = (error) => {
         console.error('WebSocket error:', error);
         callbacks.setStatus('disconnected', 'Error');
    };
    
    ws.onclose = () => {
         console.log('WebSocket closed');
         callbacks.setStatus('disconnected', 'Disconnected');
         if (!authSuccess) {
             callbacks.showLoginError(lastError || 'Authentication failed');
         } else {
             // Reload page to reset terminal state completely
             window.location.reload();
         }
    };
}

export function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
    }
}

export function sendResize(cols, rows) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
}

export function close() {
    if (ws) ws.close();
}
