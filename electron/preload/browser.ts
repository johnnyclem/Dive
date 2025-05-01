import { contextBridge, ipcRenderer } from 'electron';

// Expose a minimal Algorand-MCP wallet API to the embedded webview pages
contextBridge.exposeInMainWorld('algorandMcp', {
  /** Connect to the wallet (e.g., 'local', 'pera', etc.) and return connected addresses */
  connect: (walletType: string): Promise<string[]> => ipcRenderer.invoke('wallet:connect', walletType),

  /** Get the list of currently connected accounts */
  getAccounts: (): Promise<string[]> => ipcRenderer.invoke('wallet:getAccounts'),

  /** Disconnect the wallet session */
  disconnect: (): Promise<void> => ipcRenderer.invoke('wallet:disconnect'),

  /** Sign a single Algorand transaction object (serialized params) */
  signTransaction: (txn: unknown): Promise<Uint8Array> => ipcRenderer.invoke('wallet:signTxn', txn),

  /** Sign multiple Algorand transactions (group) */
  signTransactions: (txns: unknown[][]): Promise<Uint8Array[]> => ipcRenderer.invoke('wallet:signTxns', txns),
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

// Listen for recording state changes from main process
ipcRenderer.on('WORKFLOW_SET_RECORDING', (_event, recording: boolean) => {
  console.log(`[Preload Record] Received WORKFLOW_SET_RECORDING: ${recording}`);
  isRecording = recording
})

// Utility to build a more robust CSS selector leveraging id, data-testid, aria-label, name, placeholder or unique text
function buildSelector(el: Element | null): string {
  if (!el) return ''

  const attrs = (e: Element) => ({
    id: (e as HTMLElement).id,
    testid: e.getAttribute('data-testid') || undefined,
    aria: e.getAttribute('aria-label') || undefined,
    name: e.getAttribute('name') || undefined,
    placeholder: (e as HTMLInputElement).placeholder || undefined,
  })

  const makeAttrSel = (attr: string, val: string) => `[${attr}="${CSS.escape(val)}"]`

  // 1. id unique
  const { id, testid, aria, name, placeholder } = attrs(el)
  if (id) return `#${CSS.escape(id)}`
  if (testid) return makeAttrSel('data-testid', testid)
  if (aria) return makeAttrSel('aria-label', aria)
  if (name) return makeAttrSel('name', name)
  if (placeholder) return `${el.tagName.toLowerCase()}${makeAttrSel('placeholder', placeholder)}`

  // 2. Skip text-based selector heuristics to avoid brittle selectors

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

// Capture click events
window.addEventListener('click', (e) => {
  if (!isRecording) return
  console.log('[Preload Record] Click event detected. isRecording:', isRecording);
  const selector = buildSelector(e.target as Element)
  console.log('[Preload Record] Click selector:', selector);
  ipcRenderer.send('WORKFLOW_ACTION_CAPTURED', {
    action: 'click',
    payload: { selector },
    timestamp: Date.now(),
  })
})

// Capture input events (typing)
window.addEventListener('input', (e) => {
  if (!isRecording) return
  console.log('[Preload Record] Input event detected. isRecording:', isRecording);
  const target = e.target as HTMLInputElement | HTMLTextAreaElement
  const selector = buildSelector(target)
  console.log('[Preload Record] Input selector:', selector, 'Value:', target.value);
  ipcRenderer.send('WORKFLOW_ACTION_CAPTURED', {
    action: 'type',
    payload: { selector, value: target.value },
    timestamp: Date.now(),
  })
})

// Notify main when navigation events occur (already above) will also be recorded by workflow manager if recording. 