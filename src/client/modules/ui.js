import { MAX_FONT_SIZE, MIN_FONT_SIZE, LOGGED_IN_TITLE } from './config.js';
import { launchConfetti } from './utils.js';

export const elements = {
  statusDot: document.getElementById('status-dot'),
  statusText: document.getElementById('status-text'),
  reconnectBtn: document.getElementById('reconnect-btn'),
  fontDecreaseBtn: document.getElementById('font-decrease'),
  fontIncreaseBtn: document.getElementById('font-increase'),
  titleBarError: document.getElementById('title-bar-error'),
  titleText: document.getElementById('title-text'),
  progressContainer: document.getElementById('progress-container'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  instructionsBtn: document.getElementById('instructions-btn'),
  instructionsPane: document.getElementById('instructions-pane'),
  instructionsContent: document.getElementById('instructions-content'),
  resizeHandle: document.getElementById('resize-handle'),
  terminalWrapper: document.getElementById('terminal-wrapper'),
  loginOverlay: document.getElementById('login-overlay'),
  loginForm: document.getElementById('login-form'),
  loginError: document.getElementById('login-error'),
  usernameInput: document.getElementById('username'),
  passwordInput: document.getElementById('password'),
  fingerprintBtn: document.getElementById('fingerprint-btn'),
  fingerprintDialog: document.getElementById('fingerprint-dialog'),
  fingerprintValue: document.getElementById('fingerprint-value'),
  fingerprintCloseBtn: document.getElementById('fingerprint-close-btn'),
  fingerprintCopyBtn: document.getElementById('fingerprint-copy-btn'),
  terminalContainer: document.getElementById('terminal-container'),
};

let fitCallback = null;
let instructionsPaneVisible = false;

export function setFitCallback(cb) {
  fitCallback = cb;
}

export function updateFontButtonStates(fontSize) {
  elements.fontDecreaseBtn.disabled = fontSize <= MIN_FONT_SIZE;
  elements.fontIncreaseBtn.disabled = fontSize >= MAX_FONT_SIZE;
}

export function setInstructionsFontSize(fontSize) {
  elements.instructionsPane.style.fontSize = fontSize + 'px';
}

export function setStatus(status, text) {
  elements.statusDot.className = 'status-dot ' + status;
  elements.statusText.textContent = text;
}

export function showTitleBarError(message) {
  elements.titleBarError.textContent = message;
  elements.titleBarError.classList.remove('hidden');
  setTimeout(() => {
    elements.titleBarError.classList.add('hidden');
  }, 3000);
}

export function showLoginError(message) {
  sessionStorage.setItem('loginError', message);
  sessionStorage.setItem('lastUsername', elements.usernameInput.value);
  window.location.reload();
}

export function restoreLoginState() {
  const storedError = sessionStorage.getItem('loginError');
  const storedUsername = sessionStorage.getItem('lastUsername');
  if (storedError) {
    elements.loginError.textContent = storedError;
    elements.loginError.classList.remove('hidden');
    sessionStorage.removeItem('loginError');
  } else {
    elements.loginError.classList.add('hidden');
  }
  if (storedUsername) {
    elements.usernameInput.value = storedUsername;
    sessionStorage.removeItem('lastUsername');
  } else {
    elements.usernameInput.value = '';
  }
  elements.passwordInput.value = '';
  if (storedUsername) {
    elements.passwordInput.focus();
  } else {
    elements.usernameInput.focus();
  }
}

export function getOverlordLevel(username) {
  const match = username.match(/^overlord(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

export function showProgress(username, maxOverlordLevel) {
  const level = getOverlordLevel(username);
  if (level !== null) {
    // Update title with username and gradient color
    const ratio = level / 15;
    const green = { r: 39, g: 201, b: 63 }; // #27c93f
    const gold = { r: 255, g: 215, b: 0 }; // #ffd700
    const r = Math.round(green.r + (gold.r - green.r) * ratio);
    const g = Math.round(green.g + (gold.g - green.g) * ratio);
    const b = Math.round(green.b + (gold.b - green.b) * ratio);
    const color = `rgb(${r}, ${g}, ${b})`;
    const glow = level === 15 ? `text-shadow: 0 0 10px ${color};` : '';
    elements.titleText.innerHTML = `<span style="color: ${color}; ${glow}">${username}</span>`;
    
    const percentage = (level / maxOverlordLevel) * 100;
    elements.progressFill.style.width = percentage + '%';
    elements.progressText.textContent = `${level}/${maxOverlordLevel}`;
    elements.progressContainer.classList.add('visible');
    
    // Check if max level reached
    if (level === maxOverlordLevel) {
      elements.titleText.classList.add('gold');
      elements.progressFill.classList.add('gold');
      elements.progressText.classList.add('gold');
      launchConfetti();
    }
  } else {
    elements.progressContainer.classList.remove('visible');
  }
}

export function onLoginSuccess() {
  elements.loginOverlay.classList.add('hidden');
  setStatus('connected', 'Connected');
  elements.titleText.innerHTML = LOGGED_IN_TITLE;
}

export function onLoginFailure(lastError) {
  setStatus('disconnected', 'Disconnected');
  showLoginError(lastError || 'Authentication failed');
}

export function toggleInstructions() {
  instructionsPaneVisible = !instructionsPaneVisible;
  if (instructionsPaneVisible) {
    elements.instructionsPane.classList.remove('hidden');
    elements.instructionsBtn.classList.add('active');
    elements.terminalContainer.classList.add('instructions-visible');
    elements.terminalWrapper.classList.add('instructions-visible');
  } else {
    elements.instructionsPane.classList.add('hidden');
    elements.instructionsBtn.classList.remove('active');
    elements.terminalContainer.classList.remove('instructions-visible');
    elements.terminalWrapper.classList.remove('instructions-visible');
  }
  if (fitCallback) setTimeout(() => fitCallback(), 50);
}

export function showInstructionsForUser(username, instructionsData) {
  // Logic to parse instructions... moved from original
  if (!instructionsData) return;
  
  const lines = instructionsData.split('\n');
  let generalInstructions = '';
  let userInstructions = '';
  let currentSection = 'general';
  let foundUser = false;
  
  for (const line of lines) {
    const match = line.match(/^===========(\w+)=+$/);
    if (match) {
      const sectionUser = match[1];
      if (sectionUser === username) {
        currentSection = 'user';
        foundUser = true;
      } else if (foundUser) {
        break;
      } else {
        currentSection = 'other';
      }
    } else {
      if (currentSection === 'general') {
        generalInstructions += line + '\n';
      } else if (currentSection === 'user') {
        userInstructions += line + '\n';
      }
    }
  }
  
  if (foundUser) {
      const generalHtml = generalInstructions.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    
    const userHtml = userInstructions.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    
      const modifiedInstructions = 
      `Hi, <span class="username-highlight">${username}</span>. ${generalHtml}` +
      '<hr style="border: none; border-top: 1px solid #3a3a3a; margin: 20px 0;">' +
      userHtml;
    
      elements.instructionsContent.innerHTML = modifiedInstructions;
      elements.instructionsBtn.classList.remove('hidden');
  } else {
      elements.instructionsBtn.classList.add('hidden');
      elements.instructionsPane.classList.add('hidden');
      instructionsPaneVisible = false;
  }
}

// Fingerprint logic
export function initFingerprintUI(fingerprint) {
  const shortFingerprint = fingerprint.substring(0, 12);
  elements.fingerprintValue.textContent = shortFingerprint;
  elements.fingerprintDialog.classList.remove('hidden');
  
  // Auto-copy
  navigator.clipboard.writeText(shortFingerprint).catch(e => console.error('Failed to copy clipboard', e));
}

export function closeFingerprintDialog() {
  elements.fingerprintDialog.classList.add('hidden');
}

// Resize handle drag logic
export function initResizeHandle() {
  const handle = elements.resizeHandle;
  const pane = elements.instructionsPane;
  let isDragging = false;

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const containerRect = elements.terminalContainer.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;

    if (isMobile) {
      // Vertical resize on mobile
      const containerHeight = containerRect.height;
      const offsetFromBottom = containerRect.bottom - e.clientY;
      const percentage = (offsetFromBottom / containerHeight) * 100;
      const clampedPercentage = Math.min(60, Math.max(20, percentage));
      pane.style.height = clampedPercentage + 'vh';
    } else {
      // Horizontal resize on desktop
      const containerWidth = containerRect.width;
      const offsetFromLeft = e.clientX - containerRect.left;
      const percentage = (offsetFromLeft / containerWidth) * 100;
      const clampedPercentage = Math.min(40, Math.max(20, percentage));
      pane.style.width = clampedPercentage + 'vw';
    }

    if (fitCallback) fitCallback();
  };

  const onMouseUp = () => {
    isDragging = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    e.preventDefault();
    document.body.style.cursor = window.innerWidth <= 640 ? 'ns-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });
}

export async function copyFingerprint(fingerprint) {
    const shortFingerprint = fingerprint.substring(0, 12);
    try {
        await navigator.clipboard.writeText(shortFingerprint);
        elements.fingerprintCopyBtn.style.filter = 'brightness(0) saturate(100%) invert(58%) sepia(85%) saturate(1352%) hue-rotate(75deg) brightness(98%) contrast(86%)';
        setTimeout(() => {
            closeFingerprintDialog();
        }, 2000);
        return true;
    } catch (e) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = shortFingerprint;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            document.body.removeChild(textArea);
            elements.fingerprintCopyBtn.style.filter = 'brightness(0) saturate(100%) invert(58%) sepia(85%) saturate(1352%) hue-rotate(75deg) brightness(98%) contrast(86%)';
            setTimeout(() => {
                closeFingerprintDialog();
            }, 2000);
            return true;
        } catch (err) {
            document.body.removeChild(textArea);
            return false;
        }
    }
}
