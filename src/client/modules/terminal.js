import { init, Terminal, FitAddon } from '/node_modules/ghostty-web/dist/ghostty-web.js';

export let term;
export let fitAddon;
let wasmReady = false;

export async function preloadWasm() {
  await init();
  wasmReady = true;
  return true;
}

export function isWasmReady() { return wasmReady; }

export function initTerminal(containerElement, options = {}) {
  term = new Terminal({
    cursorBlink: true,
    fontSize: options.fontSize || 16,
    fontFamily: '"Inconsolata", Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
    },
    scrollback: 10000,
  });

  fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(containerElement);
  fitAddon.fit();
  fitAddon.observeResize();

  // Scrollbar auto-hide logic
  let scrollbarTimeout;
  
  // Note: .xterm-viewport is created by xterm.js inside the container
  // We might need to wait for it or assume it's there after open()
  setTimeout(() => {
    const viewport = containerElement.querySelector('.xterm-viewport');
    if (viewport) {
        const showScrollbar = () => {
        viewport.classList.add('scrollbar-visible');
        clearTimeout(scrollbarTimeout);
        scrollbarTimeout = setTimeout(() => {
            viewport.classList.remove('scrollbar-visible');
            fitAddon.fit();
        }, 3000);
        };
        viewport.addEventListener('scroll', showScrollbar);
        viewport.addEventListener('mouseenter', showScrollbar);
        viewport.addEventListener('mouseleave', () => {
        clearTimeout(scrollbarTimeout);
        scrollbarTimeout = setTimeout(() => {
            viewport.classList.remove('scrollbar-visible');
            fitAddon.fit();
        }, 3000);
        });
    }
  }, 0);

  window.addEventListener('resize', () => fitAddon.fit());
  
  return term;
}

export function fit() {
    if (fitAddon) fitAddon.fit();
}

export function focus() {
    if (term) term.focus();
}

export function getDims() {
    return term ? { cols: term.cols, rows: term.rows } : null;
}
