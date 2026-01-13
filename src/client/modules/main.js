import { MIN_FONT_SIZE, MAX_FONT_SIZE } from './config.js';
import { generateFingerprint } from './utils.js';
import * as ui from './ui.js';
import * as terminal from './terminal.js';
import * as connection from './connection.js';

// State
let fontSize = 16;
let browserFingerprint = '';
let maxOverlordLevel = 15;
let instructionsData = null;

// Initialize
async function init() {
  // Preload WASM
  await terminal.preloadWasm();
  
  // Initialize UI events
  setupEventListeners();
  
  // Load instructions
  loadInstructions();
  
  // Check for previous errors
  ui.restoreLoginState();
  
  // Init Fingerprint (lazy or proactive?)
  // Original turned it into a promise. We'll do it on connect or click.
  
  // Setup callback for UI resize to fit terminal
  ui.setFitCallback(() => terminal.fit());
}

async function loadInstructions() {
  try {
    const response = await fetch('/instructions.txt');
    if (response.ok) {
      instructionsData = await response.text();
      // Find max overlord level from instructions
      const matches = instructionsData.matchAll(/^===========overlord(\d+)=+$/gm);
      for (const match of matches) {
        const level = parseInt(match[1], 10);
        if (level > maxOverlordLevel) {
          maxOverlordLevel = level;
        }
      }
    }
  } catch (e) {
    console.error('Failed to load instructions:', e);
  }
}

async function getFingerprint() {
    if (!browserFingerprint) {
        browserFingerprint = await generateFingerprint();
    }
    return browserFingerprint;
}

function setupEventListeners() {
    // Login
    ui.elements.loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        ui.elements.loginError.classList.add('hidden');
        
        const username = ui.elements.usernameInput.value;
        const password = ui.elements.passwordInput.value;
        
        await connectToOverlord(username, password);
    });
    
    // Reconnect
    ui.elements.reconnectBtn.addEventListener('click', () => {
        window.location.reload();
    });

    // Font controls
    ui.elements.fontDecreaseBtn.addEventListener('click', () => {
        if (fontSize > MIN_FONT_SIZE) {
            fontSize -= 2;
            terminal.term.options.fontSize = fontSize;
            terminal.fit();
            ui.updateFontButtonStates(fontSize);
            ui.setInstructionsFontSize(fontSize);
        }
    });

    ui.elements.fontIncreaseBtn.addEventListener('click', () => {
        if (fontSize < MAX_FONT_SIZE) {
            fontSize += 2;
            terminal.term.options.fontSize = fontSize;
            terminal.fit();
            ui.updateFontButtonStates(fontSize);
            ui.setInstructionsFontSize(fontSize);
        }
    });
    
    // Instructions
    ui.elements.instructionsBtn.addEventListener('click', () => {
        ui.toggleInstructions();
        terminal.focus();
    });
    
    // Fingerprint
    ui.elements.fingerprintBtn.addEventListener('click', async () => {
        const fp = await getFingerprint();
        ui.initFingerprintUI(fp);
    });
    
    ui.elements.fingerprintCloseBtn.addEventListener('click', ui.closeFingerprintDialog);
    
    ui.elements.fingerprintCopyBtn.addEventListener('click', async () => {
        const fp = await getFingerprint();
        ui.copyFingerprint(fp);
    });
    
    document.addEventListener('keydown', (e) => {
        if (!ui.elements.fingerprintDialog.classList.contains('hidden') && (e.key === 'q' || e.key === 'Q')) {
            ui.closeFingerprintDialog();
        }
    });
}

async function connectToOverlord(username, password) {
    if (!terminal.isWasmReady()) {
        ui.showLoginError('Still loading, please wait...');
        return;
    }
    
    // Initialize terminal if needed
    if (!terminal.term) {
        terminal.initTerminal(ui.elements.terminalWrapper, { fontSize });
        ui.updateFontButtonStates(fontSize);
        
        // Setup terminal callbacks
        terminal.term.onResize((size) => {
            connection.sendResize(size.cols, size.rows);
        });
        
        terminal.term.onData((data) => {
            connection.send(data);
        });
    }
    
    const fp = await getFingerprint();
    
    connection.connect(username, password, terminal.getDims(), fp, {
        setStatus: ui.setStatus,
        onAuthSuccess: (user) => {
            ui.onLoginSuccess();
            ui.showProgress(user, maxOverlordLevel);
            ui.showInstructionsForUser(user, instructionsData);
            terminal.focus();
        },
        onData: (data) => terminal.term.write(data),
        showLoginError: ui.onLoginFailure,
        onOpen: () => {}, // ui handles 'connected' via auth success? connection.js sets 'connecting'
    });
}


// Start
init();
