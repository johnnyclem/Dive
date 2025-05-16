import logger from '../utils/logger'; // Adjusted path assuming logger is in utils
// import { ipcMain } from 'electron'; // No longer needed here
import { getCanvasContents } from '../../electron/main/ipc/canvas';
import { BrowserWindow } from 'electron'; // Required for type, and to get main window

/**
 * This is the actual function called by the AI agent framework when the "read_canvas" tool is selected.
 * It runs in the Electron Main process and uses an established IPC handler 
 * ('tool:read-canvas-invoke') to get data from the Renderer process.
 */

// Function to get the main window. This is a placeholder and needs a real implementation.
// In a real scenario, mainWindow is usually managed in your main Electron file (e.g., electron/main/index.ts)
// and might be passed around or accessed via a global/singleton if necessary.
function getMainWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow();
}

export async function read_canvas_tool_implementation() {
  logger.info('[AI Tool Impl - read_canvas] Preparing to get canvas contents.');
  const mainWindow = getMainWindow();

  if (!mainWindow) {
    logger.error('[AI Tool Impl - read_canvas] Main window not available.');
    return {
      summary: 'Main window not available to read canvas.',
      data: null,
      success: false
    };
  }

  try {
    const result = await getCanvasContents(mainWindow); // Call the exported function

    if (result.success) {
      logger.info('[AI Tool Impl - read_canvas] Success from getCanvasContents:', result.data);
      const canvasContents = result.data;
      const summary = canvasContents && Array.isArray(canvasContents)
        ? `Canvas contains ${canvasContents.length} elements.`
        : (canvasContents ? 'Canvas contains content (format not array).' : 'Canvas is empty or content format unrecognized.');
      
      return {
        summary: summary,
        data: canvasContents,
        success: true
      };
    } else {
      logger.error('[AI Tool Impl - read_canvas] Error from getCanvasContents:', result.error);
      return {
        summary: `Failed to read canvas: ${result.error}`,
        data: null,
        success: false
      };
    }
  } catch (error) {
    logger.error('[AI Tool Impl - read_canvas] Critical error calling getCanvasContents:', error);
    return {
      summary: `Critical error during read_canvas tool execution: ${error.message}`,
      data: null,
      success: false
    };
  }
}

interface AddImageToCanvasArgs {
  image_source: string;
  position?: { x: number; y: number };
  options?: {
    size?: { width: number; height: number };
    rotation?: number;
    file_name?: string;
    mime_type?: string;
  };
}

// Helper function for IPC, similar to fetchCanvasDataViaIPC
async function addImageToCanvasViaIPC(mainWindow: BrowserWindow, ipcArgs: any): Promise<{ success: boolean; data?: any; error?: string }> {
  const { ipcMain } = await import('electron');
  const logger = (await import('../utils/logger.js')).default;

  if (!mainWindow || mainWindow.isDestroyed()) {
    logger.error('[MainIPC-Core-AddImage] addImageToCanvasViaIPC: Main window not available.');
    return { success: false, error: 'Main window not available to add image' };
  }

  return new Promise((resolve) => {
    const requestId = `canvas-add-image-request-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const requestChannel = 'canvas:add-image-request-from-main'; // To renderer
    const responseChannel = `canvas:add-image-response-from-renderer-${requestId}`; // From renderer
    const timeoutMs = 15000; // Increased timeout for potential image processing

    logger.info(`[MainIPC-Core-AddImage] Sending ${requestChannel} with ID: ${requestId}, Args: ${JSON.stringify(ipcArgs)}`);

    const timeoutHandle = setTimeout(() => {
      ipcMain.removeListener(responseChannel, listener);
      logger.error(`[MainIPC-Core-AddImage] Timeout (${timeoutMs}ms) waiting for ${responseChannel}`);
      resolve({ success: false, error: `Timeout waiting for canvas add image response (ID: ${requestId})` });
    }, timeoutMs);

    const listener = (_event: Electron.IpcMainEvent, responseArgs: { success: boolean; data?: any; error?: string }) => {
      clearTimeout(timeoutHandle);
      ipcMain.removeListener(responseChannel, listener);
      if (responseArgs.success) {
        logger.info(`[MainIPC-Core-AddImage] Received success response for ${responseChannel}`);
        resolve({ success: true, data: responseArgs.data });
      } else {
        logger.error(`[MainIPC-Core-AddImage] Received error response for ${responseChannel}: ${responseArgs.error}`);
        resolve({ success: false, error: responseArgs.error || `Failed to add image from renderer (ID: ${requestId})` });
      }
    };

    ipcMain.on(responseChannel, listener);
    // Send the request ID so the renderer can use it in the response channel
    mainWindow.webContents.send(requestChannel, { ...ipcArgs, requestId });
  });
}

export async function add_image_to_canvas_tool_implementation(args: AddImageToCanvasArgs) {
  const logger = (await import('../utils/logger.js')).default;
  logger.info('[AI Tool Impl - add_image_to_canvas] Preparing to add image to canvas with args:', args);
  const mainWindow = getMainWindow();

  // Enhanced logging to debug mainWindow and webContents
  if (!mainWindow) {
    logger.error('[AI Tool Impl - add_image_to_canvas] Main window not available (getMainWindow() returned null).');
    return {
      summary: 'Main window not available to add image to canvas.',
      success: false,
      error: 'Main window not found (returned null)'
    };
  }
  logger.info('[AI Tool Impl - add_image_to_canvas] getMainWindow() returned:', typeof mainWindow, 'ID:', mainWindow.id);
  if (!mainWindow.webContents) {
    logger.error('[AI Tool Impl - add_image_to_canvas] mainWindow.webContents is undefined or null. Window ID:', mainWindow.id);
    return {
      summary: 'WebContents not available on the main window.',
      success: false,
      error: 'mainWindow.webContents is not available'
    };
  }
  // No longer checking for invoke, as we are switching to send/on

  let imageDataUrl = args.image_source;

  try {
    if (!imageDataUrl.startsWith('data:') && !imageDataUrl.startsWith('http')) {
      const fs = await import('fs');
      if (fs.existsSync(imageDataUrl)) {
        logger.info(`[AI Tool Impl - add_image_to_canvas] Converting local file path to data URI: ${imageDataUrl}`);
        const imageUtils = await import('../utils/image.js'); 
        imageDataUrl = await imageUtils.imageToBase64(imageDataUrl);
        logger.info('[AI Tool Impl - add_image_to_canvas] Conversion to data URI successful.');
      } else {
        logger.warn(`[AI Tool Impl - add_image_to_canvas] image_source looks like a path but not found: ${imageDataUrl}`);
      }
    }
  } catch (pathError: any) {
    logger.error(`[AI Tool Impl - add_image_to_canvas] Error checking or converting file path ${args.image_source}:`, pathError.message);
  }

  const ipcRelayArgs = {
    imageDataUrl,
    position: args.position,
    options: args.options
  };

  try {
    logger.info('[AI Tool Impl - add_image_to_canvas] Relaying to addImageToCanvasViaIPC with:', ipcRelayArgs);
    const result = await addImageToCanvasViaIPC(mainWindow, ipcRelayArgs);
    logger.info('[AI Tool Impl - add_image_to_canvas] Result from addImageToCanvasViaIPC:', result);

    if (result.success) {
      return {
        summary: `Image successfully added to canvas. Element ID: ${result.data?.id || 'N/A'}`,
        data: result.data,
        success: true
      };
    } else {
      return {
        summary: `Failed to add image to canvas via IPC: ${result.error || 'Unknown error from IPC relay.'}`,
        success: false,
        error: result.error || 'Unknown error from IPC relay.'
      };
    }
  } catch (error: any) {
    logger.error('[AI Tool Impl - add_image_to_canvas] Critical error during IPC relay or processing result:', error.message);
    return {
      summary: `Critical error during add_image_to_canvas tool execution: ${error.message}`,
      success: false,
      error: error.message
    };
  }
}
