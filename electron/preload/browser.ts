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