import { ipcMain, BrowserWindow, Menu } from "electron"
import type { AlgorandMcpClient, WalletType } from 'algorand-mcp/packages/client/src/index'
import type { Transaction } from 'algosdk'
import { ipcSystemHandler } from "./system"
import { setupDocumentHandlers } from "./document"
import { setupEmbeddingsHandlers } from "./embeddings"
import { ipcEnvHandler } from "./env"
import { ipcUtilHandler } from "./util"
import { ipcLlmHandler } from "./llm"
import { ipcMenuHandler } from "./menu"
import { setupKnowledgeBaseHandlers } from "./knowledge"
import { setupTaskHandlers } from "./tasks"
import type { IpcMainInvokeEvent } from "electron"

export function ipcHandler(win: BrowserWindow) {
  console.log('Setting up all IPC handlers');
  
  let popup: BrowserWindow | null = null

  const DEFAULT_TITLE = "Souls"

  const safeHandle = (channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) => {
    try { ipcMain.handle(channel, listener) } catch {
      console.warn(`IPC handler already registered for '${channel}'`)
    }
  }

  // IPC Handlers
  safeHandle("set-title", (_event, title: string) => {
    win.setTitle(title || DEFAULT_TITLE)
  })

  // Generic context menu
  safeHandle("show-input-context-menu", (event) => {
    const menu = Menu.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" },
    ])
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! })
  })

  safeHandle("show-selection-context-menu", (event) => {
    const menu = Menu.buildFromTemplate([
      {
        label: "Cut",
        click: () => event.sender.cut(),
      },
      {
        label: "Copy",
        click: () => event.sender.copy(),
      },
      {
        label: "Paste",
        click: () => event.sender.paste(),
      },
      { type: "separator" },
      {
        label: "Select All",
        click: () => event.sender.selectAll(),
      },
    ])
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! })
  })

  // Handle popup windows (simple implementation)
  safeHandle('popup:open', (_event, options: { url: string, width?: number, height?: number, modal?: boolean }) => {
    const { url, width = 500, height = 600, modal = false } = options;
    
    // Close existing popup if it exists
    if (popup && !popup.isDestroyed()) {
      popup.show();
      return true;
    }
    
    // Create a new popup
    popup = new BrowserWindow({
      width,
      height,
      parent: modal ? win : undefined,
      modal,
      show: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false
      }
    });
    
    // Load the URL
    popup.loadURL(url);
    
    // Show when ready
    popup.once('ready-to-show', () => {
      popup?.show();
    });
    
    // Handle closed event
    popup.on('closed', () => {
      win.webContents.send('popup:closed');
      popup = null;
    });
    
    return true;
  });
  
  // Close popup window
  safeHandle('popup:close', () => {
    if (popup && !popup.isDestroyed()) {
      popup.close();
      return true;
    }
    return false;
  });
  
  // Set up document and knowledge base handlers
  setupDocumentHandlers()
  
  // Set up embedding handlers 
  setupEmbeddingsHandlers()

  ipcMain.handle("env:getPlatform", async () => {
    return process.platform
  })

  ipcEnvHandler();
  console.log('Env handlers registered');
  
  ipcSystemHandler(win);
  console.log('System handlers registered');
  
  ipcUtilHandler();
  console.log('Util handlers registered');
  
  ipcLlmHandler()
  ipcMenuHandler()
  setupKnowledgeBaseHandlers()
  setupTaskHandlers()

  // Wallet IPC handlers for embedded BrowserView
  let walletClient: AlgorandMcpClient | null = null
  async function getWalletClient() {
    if (!walletClient) {
      // Dynamically load the Algorand MCP browser SDK
      const module = await import('algorand-mcp/packages/client/src/index')
      const { AlgorandMcpClient } = module
      // Default to TestNet for embedded browser
      walletClient = new AlgorandMcpClient({ network: 'testnet' })
    }
    return walletClient
  }

  ipcMain.handle('wallet:connect', async (_event, walletType: WalletType): Promise<string[]> => {
    const client = await getWalletClient()
    return client.connect(walletType)
  })

  ipcMain.handle('wallet:getAccounts', async (): Promise<string[]> => {
    const client = await getWalletClient()
    return client.getAccounts()
  })

  ipcMain.handle('wallet:disconnect', async (): Promise<void> => {
    const client = await getWalletClient()
    return client.disconnect()
  })

  ipcMain.handle('wallet:signTxn', async (_event, txn: Transaction): Promise<Uint8Array> => {
    const client = await getWalletClient()
    return client.signTransaction(txn)
  })

  ipcMain.handle(
    'wallet:signTxns',
    async (
      _event,
      txns: Array<Array<{ txn: Transaction; message?: string }>>
    ): Promise<Uint8Array[][]> => {
      const client = await getWalletClient()
      return client.signTransactions(txns)
    }
  )

  return () => {
    // Close popup
    if (popup) {
      popup.close()
      popup = null
    }
  }
}