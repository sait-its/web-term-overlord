import { CONFETTI_COLORS } from './config.js';

let fpPromise = null;

export async function generateFingerprint() {
  try {
    if (!fpPromise) {
      const FingerprintJS = await import('/node_modules/@fingerprintjs/fingerprintjs/dist/fp.esm.js');
      fpPromise = FingerprintJS.load();
    }
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  } catch (error) {
    console.error('Fingerprint generation error:', error);
    return 'error-' + Date.now();
  }
}

export function launchConfetti() {
  const confettiCount = 200;
  
  // Launch confetti in 3 explosive waves
  for (let wave = 0; wave < 3; wave++) {
    setTimeout(() => {
      const centerX = 50 + (Math.random() * 30 - 15);
      const centerY = 30 + (Math.random() * 20 - 10);
      
      for (let i = 0; i < confettiCount / 3; i++) {
        const confetti = document.createElement('div');
        const size = Math.random() * 12 + 6;
        confetti.style.cssText = `
          position: fixed;
          width: ${size}px;
          height: ${size}px;
          background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
          left: ${centerX}vw;
          top: ${centerY}vh;
          opacity: 1;
          pointer-events: none;
          z-index: 9999;
          border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
        `;
        document.body.appendChild(confetti);
        
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 60 + 40;
        const endX = Math.cos(angle) * velocity;
        const endY = Math.sin(angle) * velocity + 80;
        const duration = Math.random() * 2000 + 3000;
        const rotation = Math.random() * 1080 - 540;
        
        confetti.animate([
          { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
          { transform: `translate(${endX}vw, ${endY}vh) rotate(${rotation}deg) scale(0.3)`, opacity: 0 }
        ], {
          duration: duration,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }).onfinish = () => confetti.remove();
      }
    }, wave * 600);
  }
}

export function isNarrowViewport() {
  return window.innerWidth <= 640;
}

// Sanitize text input to prevent injection attacks
export function sanitizeInput(input) {
  if (typeof input !== 'string') return '';

  // Remove or replace potentially dangerous characters
  return input
    .replace(/[<>'"&]/g, '') // Remove HTML special characters
    .replace(/[^\x20-\x7E]/g, '') // Remove non-printable ASCII characters
    .trim()
    .substring(0, 16); // Enforce max length
}

// Escape HTML to prevent XSS when displaying user content
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };

  return text.replace(/[&<>"']/g, char => map[char]);
}
