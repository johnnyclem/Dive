// This is a CommonJS wrapper for the browser preload functionality
// It's used in development mode only

const { contextBridge, ipcRenderer } = require('electron');

// Expose a minimal Algorand-MCP wallet API to the embedded webview pages
contextBridge.exposeInMainWorld('algorandMcp', {
  /** Connect to the wallet (e.g., 'local', 'pera', etc.) and return connected addresses */
  connect: (walletType) => ipcRenderer.invoke('wallet:connect', walletType),

  /** Get the list of currently connected accounts */
  getAccounts: () => ipcRenderer.invoke('wallet:getAccounts'),

  /** Disconnect the wallet session */
  disconnect: () => ipcRenderer.invoke('wallet:disconnect'),

  /** Sign a single Algorand transaction object (serialized params) */
  signTransaction: (txn) => ipcRenderer.invoke('wallet:signTxn', txn),

  /** Sign multiple Algorand transactions (group) */
  signTransactions: (txns) => ipcRenderer.invoke('wallet:signTxns', txns),
});

// Expose stub API for future browser recording features
contextBridge.exposeInMainWorld('soulsBrowser', {
  setRecording() { /* placeholder */ },
});

// Forward basic navigation events to main
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.send('BROWSER_EVENT', { event: 'loaded', payload: { url: window.location.href } });
});

window.addEventListener('hashchange', () => {
  ipcRenderer.send('BROWSER_EVENT', { event: 'navigated', payload: { url: window.location.href } });
});

// ----- Workflow Recording Support -----
let isRecording = false

// We'll keep track of listeners installed status
let listenersInstalled = false

// Set up event listeners right away when the DOM is ready - will be activated when recording starts
window.addEventListener('DOMContentLoaded', () => {
  if (!listenersInstalled) {
    console.log('[Preload] DOMContentLoaded - setting up potential event listeners');
    setupClickCapture();
    setupInputCapture();
    listenersInstalled = true;
  }
})

// Listen for recording state changes from main process
ipcRenderer.on('WORKFLOW_SET_RECORDING', (_event, recording) => {
  console.log(`[Preload Record] Received WORKFLOW_SET_RECORDING: ${recording}`);
  isRecording = recording

  // Forcefully log the current recording state
  console.log(`[Preload Record] Current recording state: ${isRecording}`);

  // Always refresh click listeners when recording state changes
  if (recording && !listenersInstalled) {
    // Ensure one-time init of event listeners when recording starts
    console.log('[Preload Record] Setting up event listeners');
    setupClickCapture();
    setupInputCapture();
    listenersInstalled = true;
  }
})

// Use event delegation with capture phase for more reliable event capturing
function setupClickCapture() {
  // Remove any existing handlers first to avoid duplicates
  document.removeEventListener('click', handleClick, true);
  document.addEventListener('click', handleClick, true);
}

function setupInputCapture() {
  // Remove any existing handlers first to avoid duplicates
  document.removeEventListener('input', handleInput, true);
  document.addEventListener('input', handleInput, true);
}

function handleClick(e) {
  if (!isRecording) return;
  console.log('[Preload Record] Click event detected. isRecording:', isRecording);
  const selector = buildSelector(e.target);
  console.log('[Preload Record] Click selector:', selector);
  ipcRenderer.send('WORKFLOW_ACTION_CAPTURED', {
    action: 'click',
    payload: { selector },
    timestamp: Date.now(),
  });
}

function handleInput(e) {
  if (!isRecording) return;
  console.log('[Preload Record] Input event detected. isRecording:', isRecording);
  const target = e.target;
  const selector = buildSelector(target);
  console.log('[Preload Record] Input selector:', selector, 'Value:', target.value);
  ipcRenderer.send('WORKFLOW_ACTION_CAPTURED', {
    action: 'type',
    payload: { selector, value: target.value },
    timestamp: Date.now(),
  });
}

// Utility to build a more robust CSS selector leveraging id, data-testid, aria-label, name, placeholder or unique text
function buildSelector(el) {
  if (!el) return ''

  const attrs = (e) => ({
    id: e.id,
    testid: e.getAttribute('data-testid') || undefined,
    aria: e.getAttribute('aria-label') || undefined,
    name: e.getAttribute('name') || undefined,
    placeholder: e.placeholder || undefined,
  })

  const makeAttrSel = (attr, val) => `[${attr}="${CSS.escape(val)}"]`

  // 1. id unique
  const { id, testid, aria, name, placeholder } = attrs(el)
  if (id) return `#${CSS.escape(id)}`
  if (testid) return makeAttrSel('data-testid', testid)
  if (aria) return makeAttrSel('aria-label', aria)
  if (name) return makeAttrSel('name', name)
  if (placeholder) return `${el.tagName.toLowerCase()}${makeAttrSel('placeholder', placeholder)}`

  // 3. Fallback to nth-child path as before
  if (!(el instanceof Element)) return ''
  const parent = el.parentElement
  if (!parent) return el.tagName.toLowerCase()
  const index = Array.from(parent.children).indexOf(el) + 1
  const parentSelector = buildSelector(parent)
  return parentSelector
    ? `${parentSelector} > ${el.tagName.toLowerCase()}:nth-child(${index})`
    : `${el.tagName.toLowerCase()}:nth-child(${index})`
} 