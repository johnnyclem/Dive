import { app, BrowserWindow, shell, ipcMain } from "electron"
import { fileURLToPath } from "node:url"
import path from "node:path"
import os from "node:os"
import dotenv from "dotenv"
import fs from "node:fs"

// Load environment variables from .env file
dotenv.config()

import AppState from "./state"
import { cleanup, initMCPClient, port } from "./service"
import { getDarwinSystemPath, modifyPath } from "./util"
import { binDirList, darwinPathList, scriptsDir } from "./constant"
import { update } from "./update"
import { ipcHandler } from "./ipc/index.js"
import { initTray } from "./tray"
import { store } from "./store"
import { initProtocol } from "./protocol"
import * as KnowledgeStore from "./knowledge-store"
import contextMenu from "electron-context-menu"
import { initBrowserManager } from './browserManager.js'
import { setupCoBrowserIPC, onAppQuit as onCoBrowserQuit } from './cobrowser'
// Get the directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Removed unused knowledge base storage definitions and exports

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..")

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron")
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist")
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1"))
  app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === "win32")
  app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Register essential IPC handlers immediately (before window creation)
ipcMain.handle('env:getResourcesPath', (_event, p: string) => {
  try {
    return app.isPackaged ? path.join(process.resourcesPath, p) : p;
  } catch (error) {
    console.error(`Failed to get resources path: ${error}`);
    return '';
  }
});

ipcMain.handle('env:port', async () => {
  // Always return the dynamic service port
  const servicePort = await port;
  console.log(`Service available on port: ${servicePort}`);
  return servicePort == 0 ? 5173 : servicePort;
});

ipcMain.handle("env:getHotkeyMap", async () => {
  return {
    submit: "CommandOrControl+Enter",
    hide: "CommandOrControl+H",
    show: "CommandOrControl+J",
    editLastMessage: "ArrowUp",
    newChat: "CommandOrControl+N",
  };
});

ipcMain.handle('env:getPlatform', () => {
  try {
    return process.platform;
  } catch (error) {
    console.error(`Failed to get platform: ${error}`);
    return '';
  }
});

// Critical fix for knowledge:list that's being called before setupKnowledgeBaseHandlers
ipcMain.handle('knowledge:list', async () => {
  console.log("Direct knowledge:list handler invoked");
  return KnowledgeStore.getAllCollections().map(collection => ({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    createdAt: new Date(),
    updatedAt: new Date()
  }));
});

// Knowledge:add handler
ipcMain.handle('knowledge:add', async (_event, name: string, description?: string) => {
  console.log(`Direct knowledge:add handler invoked: ${name}`);
  // Create a collection instead of a knowledge base
  const newCollection = KnowledgeStore.createCollection(name, description);
  return { id: newCollection.id };
});

// Knowledge:set-active handler
ipcMain.handle('knowledge:set-active', async (_event, id: string | null) => {
  console.log(`Direct knowledge:set-active handler invoked: ${id}`);
  const result = KnowledgeStore.setActiveKnowledgeBase(id);
  
  // Send a message to reconfigure tools based on active knowledge base change
  try {
    // Give the MCPServerManager a chance to reinitialize tools
    if (global.webContents) {
      global.webContents.send('knowledge:active-changed', { id });
    }
    
    // We'll also trigger a tool reconfiguration by restarting the model
    // This ensures that the LLM gets the updated tool configurations
    if (app.isPackaged) {
      // Only in packaged app to avoid disrupting development
      const serviceWindow = BrowserWindow.getAllWindows().find(win => 
        win && win.webContents && win.webContents.getURL().includes('/services')
      );
      
      if (serviceWindow) {
        serviceWindow.webContents.send('model:reconfigure-tools', { 
          reason: 'knowledge_base_change',
          activeKnowledgeBaseId: id
        });
      }
    }
  } catch (error) {
    console.error(`Error notifying about knowledge base change: ${error}`);
  }
  
  return result;
});

// Knowledge:get-active handler
ipcMain.handle('knowledge:get-active', async () => {
  console.log(`Direct knowledge:get-active handler invoked`);
  return KnowledgeStore.getActiveKnowledgeBase();
});

// Knowledge:get-documents handler
ipcMain.handle('knowledge:get-documents', async (_event, knowledgeBaseId: string) => {
  console.log(`Direct knowledge:get-documents handler invoked: ${knowledgeBaseId}`);
  // Get documents from the collection
  return KnowledgeStore.getDocumentsForCollection(knowledgeBaseId);
});

// Knowledge:search handler
ipcMain.handle('knowledge:search', async (_event, query: string, k?: number) => {
  console.log(`Direct knowledge:search handler invoked: ${query}, k=${k}`);
  
  // Get the active knowledge base ID
  const activeKnowledgeBaseId = KnowledgeStore.getActiveKnowledgeBase();
  
  // If there's an active knowledge base, search it
  if (activeKnowledgeBaseId) {
    // Use the new search function
    const searchResults = KnowledgeStore.searchKnowledgeBase(query, activeKnowledgeBaseId, k || 5);
    
    // Format the results for the frontend
    const formattedResults = searchResults.map(result => ({
      id: result.document.id,
      content: result.document.content,
      name: result.document.name,
      source: `Knowledge Base: ${result.document.name}`,
      relevance: result.score,
      snippet: result.document.content.substring(0, 200) + "..."
    }));
    
    return formattedResults;
  }
  
  // If no active knowledge base, return empty results
  return [];
});

// Knowledge:delete handler
ipcMain.handle('knowledge:delete', async (_event, id: string) => {
  console.log(`Direct knowledge:delete handler invoked: ${id}`);
  return KnowledgeStore.removeKnowledgeBase(id);
});

// Critical fix for knowledge-base handlers
ipcMain.handle('knowledge-base:list', async () => {
  console.log("Direct knowledge-base:list handler invoked");
  return KnowledgeStore.getAllCollections();
});

ipcMain.handle('knowledge-base:create', async (_event, name: string, description?: string) => {
  console.log(`Direct knowledge-base:create handler invoked: ${name}`);
  return KnowledgeStore.createCollection(name, description);
});

ipcMain.handle('knowledge-base:get-chunks', async (_event, knowledgeBaseId: number) => {
  console.log(`Direct knowledge-base:get-chunks handler invoked: ${knowledgeBaseId}`);
  const documents = KnowledgeStore.getDocumentsForCollection(knowledgeBaseId);

  // For simplicity, just return the documents as chunks
  const chunks = documents.map(doc => ({
    id: `chunk-${doc.id}`,
    text: doc.content,
    metadata: {
      documentId: doc.id,
      documentName: doc.name
    }
  }));

  return chunks;
});

let win: BrowserWindow | null = null
const preload = path.join(__dirname, "../preload/index.mjs")
const indexHtml = path.join(RENDERER_DIST, "index.html")

// Override ipcMain.handle to suppress duplicate-handler errors
const _ipcHandle = ipcMain.handle.bind(ipcMain)
ipcMain.handle = (channel: any, listener: any) => {
  try {
    return _ipcHandle(channel, listener)
  } catch (err) {
    console.warn(`IPC handler for '${channel}' already registered`)
  }
}

async function registerEssentialIpcHandlers() {
  console.log('Registering essential IPC handlers directly');

  // Register system:openScriptsDir handler
  ipcMain.handle("system:openScriptsDir", async () => {
    try {
      console.log(`Opening scripts directory at: ${scriptsDir}`);
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      await shell.openPath(scriptsDir);
      return { success: true };
    } catch (error) {
      console.error(`Failed to open scripts directory: ${error}`);
      return { success: false, error: String(error) };
    }
  });

  // Register util:fillPathToConfig handler
  ipcMain.handle("util:fillPathToConfig", async (_event, config) => {
    try {
      console.log('Filling path to config');
      // Implement the path filling logic here, or delegate to a utility function
      return config; // This is a placeholder; implement the actual logic
    } catch (error) {
      console.error(`Failed to fill path to config: ${error}`);
      return config;
    }
  });
}

async function onReady() {
  if (process.platform === "win32") {
    binDirList.forEach(modifyPath)
  } else if (process.platform === "darwin") {
    if (!process.env.PATH) {
      process.env.PATH = await getDarwinSystemPath().catch(() => "")
    }

    darwinPathList.forEach(modifyPath)
  }

  // Add sample knowledge base data for testing
  KnowledgeStore.addSampleData();

  // Start MCP client and protocol loading **before** opening the renderer window
  // so that the internal web server is up and we have a valid port ready when
  // the UI issues its first `/api/*` requests.  This prevents the renderer from
  // falling back to an incorrect default port (3000) and throwing
  // `net::ERR_CONNECTION_REFUSED` in packaged builds.
  try {
    await initMCPClient();
    initProtocol();
    // Wait for the internal web server to start and resolve its port
    const servicePort = await port;
    console.log(`Internal web server listening on port: ${servicePort}`);
  } catch (err) {
    console.error('Failed to initialise background services or port', err);
  }

  // Register critical IPC handlers early
  registerEssentialIpcHandlers();

  // Setup co-browser IPC handlers
  setupCoBrowserIPC();

  // Open UI after services and port are ready
  createWindow()

  // initialise BrowserView manager once window exists
  if (win) {
    initBrowserManager(win)
  }

  contextMenu({
    window: win, // Pass the window object
    showInspectElement: true // Explicitly enable inspect element
  });
}

async function createWindow() {
  // Disable sandbox for the renderer so dev HMR scripts can execute
  win = new BrowserWindow({
    title: "Souls",
    icon: path.join(process.env.VITE_PUBLIC, "souls-icon-black-bg.jpg"),
    width: 1680,
    height: 1051,
    minHeight: 900,
    minWidth: 1440,
    webPreferences: {
      sandbox: false,
      preload,
      // Enable embedded <webview> tags
      webviewTag: true,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })

  // resolve cors
  win.webContents.session.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      // console.log("onBeforeSendHeaders", details.requestHeaders)
      callback({ requestHeaders: { ...details.requestHeaders, Origin: '*' } });
    },
  );

  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // 'Access-Control-Allow-Origin': ['*'],
        'Access-Control-Allow-Credentials': ['true'],
        'Access-Control-Allow-Methods': ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        'Access-Control-Allow-Headers': ['Content-Type', 'Authorization'],
      },
    });
  });

  // Register all IPC handlers before loading content
  ipcHandler(win)
  // In development, use the Vite dev server; in production (packaged), load the local file
  if (!app.isPackaged && VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTools when running locally
    win.webContents.openDevTools()
  } else {
    win.setMenu(null)
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:"))
      shell.openExternal(url)

    return { action: "deny" }
  })

  win.on("close", (event) => {
    if (!AppState.isQuitting) {
      event.preventDefault()
      win?.hide()
      return false
    }

    return true
  })

  // Auto update
  update(win)

  // Tray
  const shouldminimalToTray = store.get("minimalToTray")
  if (process.platform !== "darwin" && shouldminimalToTray) {
    initTray(win)
    AppState.setIsQuitting(false)
  }

  const shouldAutoLaunch = store.get("autoLaunch")
  app.setLoginItemSettings({
    openAtLogin: shouldAutoLaunch,
    openAsHidden: false
  })
}

app.whenReady().then(onReady)

app.on("window-all-closed", async () => {
  win = null

  if (process.platform !== "darwin" && AppState.isQuitting) {
    await cleanup()
    app.quit()
  }
})

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized())
      win.restore()

    win.focus()
  }
})

app.on("before-quit", async () => {
  AppState.setIsQuitting(true)
  
  // Clean up co-browser
  await onCoBrowserQuit();
})

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    if (win) {
      win.show()
    } else {
      createWindow()
    }
  }
})

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
