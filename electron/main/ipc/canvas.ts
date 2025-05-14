import { ipcMain, BrowserWindow } from 'electron';
import * as logging from './logging'; // Assuming you have this from your tasks.ts example

// Core logic to get canvas contents, callable from within the main process
async function fetchCanvasDataViaIPC(mainWindow: BrowserWindow): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!mainWindow || mainWindow.isDestroyed()) {
    logging.error('[MainIPC-Core] fetchCanvasDataViaIPC: Main window not available.');
    return { success: false, error: 'Main window not available to request canvas contents' };
  }

  return new Promise((resolve, reject) => {
    const requestId = `canvas-read-request-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const responseChannel = `canvas-read-response-${requestId}`;
    const requestChannel = 'canvas:read-contents-request-from-main';
    const timeoutMs = 10000;

    logging.info(`[MainIPC-Core] Sending ${requestChannel} with ID: ${requestId}`);

    const timeoutHandle = setTimeout(() => {
      ipcMain.removeListener(responseChannel, listener);
      logging.error(`[MainIPC-Core] Timeout (${timeoutMs}ms) waiting for ${responseChannel}`);
      // Resolve with error object, don't reject Promise here directly for ipc.handle consistency
      resolve({ success: false, error: `Timeout waiting for canvas contents response (ID: ${requestId})` });
    }, timeoutMs);

    const listener = (_event: Electron.IpcMainEvent, responseArgs: { success: boolean; data?: any; error?: string }) => {
      clearTimeout(timeoutHandle);
      ipcMain.removeListener(responseChannel, listener);
      if (responseArgs.success) {
        logging.info(`[MainIPC-Core] Received success response for ${responseChannel}`);
        resolve({ success: true, data: responseArgs.data });
      } else {
        logging.error(`[MainIPC-Core] Received error response for ${responseChannel}: ${responseArgs.error}`);
        resolve({ success: false, error: responseArgs.error || `Failed from renderer (ID: ${requestId})` });
      }
    };

    ipcMain.on(responseChannel, listener);
    mainWindow.webContents.send(requestChannel, { requestId });
  });
}

export function setupCanvasIPC(mainWindow: BrowserWindow) {
  logging.info('[MainIPC] Setting up canvas IPC handlers.');

  ipcMain.handle('tool:read-canvas-invoke', async () => {
    logging.info('[MainIPC] ipcMain.handle tool:read-canvas-invoke was called.');
    // This now directly calls the core logic and returns its result.
    return fetchCanvasDataViaIPC(mainWindow);
  });
}

// This is the function your AI tool implementation (e.g. in services/tools/canvasTools.ts)
// should ultimately call. It ensures the IPC bridge is used correctly.
// It needs access to the mainWindow, which implies it should be part of a class or passed around.
// For simplicity, if services/tools/canvasTools.ts runs in main and can get mainWindow, it calls this.
// Or, this function itself becomes the tool implementation given to the AI framework.
export async function getCanvasContents(mainWindow: BrowserWindow): Promise<{ success: boolean; data?: any; error?: string }> {
    logging.info('[MainIPC-Exported] getCanvasContents called.');
    return fetchCanvasDataViaIPC(mainWindow);
} 