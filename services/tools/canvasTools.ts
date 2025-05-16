import logger from '../utils/logger'; // Adjusted path assuming logger is in utils
// import { ipcMain } from 'electron'; // No longer needed here
import { getCanvasContents } from '../../electron/main/ipc/canvas';
import { BrowserWindow } from 'electron'; // Required for type, and to get main window

// Define a generic type for IPC responses
interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Define a type for the CanvasElement data that tools might return or receive
// This should ideally match or be compatible with CanvasElement from canvasInteraction.ts
interface CanvasElementData {
  id: string;
  type: string; // 'primitive', 'image', 'url', 'embed' etc.
  data: unknown; // Changed from any to unknown
  // Add other common fields if necessary
}

interface ImageElementSpecificData {
    src: string;
    mimeType?: string;
    // other image-specific fields if necessary
}

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
      let canvasContents: CanvasElementData[] | null = null;
      if (result.data && Array.isArray(result.data)) {
        canvasContents = result.data as CanvasElementData[];
      }
      
      // Redact image data from canvas contents
      if (canvasContents && Array.isArray(canvasContents)) {
        canvasContents = canvasContents.map(element => {
          if (element && element.type === 'image' && element.data) {
            const imageData = element.data as ImageElementSpecificData;
            if (typeof imageData.src === 'string') {
              return {
                ...element,
                data: {
                  src: `[Image Data (id: ${element.id}, type: ${imageData.mimeType || 'unknown'}) - Not included in LLM context]`,
                  mimeType: imageData.mimeType,
                }
              };
            }
          }
          return element;
        });
      }

      const summary = canvasContents
        ? `Canvas contains ${canvasContents.length} elements.`
        : (result.data ? 'Canvas contains content (format not array or not as expected).' : 'Canvas is empty or content format unrecognized.');
      
      return {
        summary: summary,
        data: canvasContents, // Return processed (redacted) canvas contents
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

interface AddImageToCanvasIPCArgs {
  imageDataUrl: string;
  position?: { x: number; y: number };
  options?: {
    size?: { width: number; height: number };
    rotation?: number;
    file_name?: string;
    mime_type?: string;
  };
}

// Helper function for IPC, similar to fetchCanvasDataViaIPC
async function addImageToCanvasViaIPC(mainWindow: BrowserWindow, ipcArgs: AddImageToCanvasIPCArgs): Promise<IPCResponse<CanvasElementData>> {
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

    const listener = (_event: Electron.IpcMainEvent, responseArgs: IPCResponse<CanvasElementData>) => {
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

  const ipcRelayArgs: AddImageToCanvasIPCArgs = {
    imageDataUrl,
    position: args.position,
    options: args.options
  };

  try {
    logger.info('[AI Tool Impl - add_image_to_canvas] Relaying to addImageToCanvasViaIPC with:', ipcRelayArgs);
    const result = await addImageToCanvasViaIPC(mainWindow, ipcRelayArgs);
    logger.info('[AI Tool Impl - add_image_to_canvas] Result from addImageToCanvasViaIPC:', result);

    if (result.success && result.data) {
      // Redact image data before returning to AI
      let processedData = result.data as CanvasElementData; // result.data is CanvasElementData | undefined, ensure it's defined.
      
      if (processedData.type === 'image' && processedData.data) {
        // Assuming if type is 'image', then 'data' conforms to something with a 'src'
        // For type safety, we should cast or validate the structure of processedData.data
        const imageData = processedData.data as ImageElementSpecificData;
        if (typeof imageData.src === 'string') {
            processedData = {
                ...processedData,
                data: {
                    // ...imageData, // Spread the known image data properties
                    src: `[Image Data (id: ${processedData.id}, type: ${imageData.mimeType || 'unknown'}) - Not included in LLM context]`,
                    // Preserve other properties from imageData if necessary, by explicitly listing them or by careful spreading
                    // For now, only replacing src and including mimeType in the message
                    mimeType: imageData.mimeType, // keep other relevant fields if needed
                }
            };
        }
      }
      return {
        summary: `Image successfully added to canvas. Element ID: ${processedData?.id || 'N/A'}`,
        data: processedData, // Return processed data
        success: true
      };
    } else {
      return {
        summary: `Failed to add image to canvas via IPC: ${result.error || 'Unknown error from IPC relay.'}`,
        success: false,
        error: result.error || 'Unknown error from IPC relay.'
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AI Tool Impl - add_image_to_canvas] Critical error during IPC relay or processing result:', errorMessage);
    return {
      summary: `Critical error during add_image_to_canvas tool execution: ${errorMessage}`,
      success: false,
      error: errorMessage
    };
  }
}

interface AddUrlToCanvasArgs {
  url: string;
  position?: { x: number; y: number };
  options?: {
    title?: string;
    description?: string;
  };
}

interface AddUrlToCanvasIPCArgs {
  url: string;
  position?: { x: number; y: number };
  options?: {
    title?: string;
    description?: string;
  };
}

async function addUrlToCanvasViaIPC(mainWindow: BrowserWindow, ipcArgs: AddUrlToCanvasIPCArgs): Promise<IPCResponse<CanvasElementData>> {
  const { ipcMain } = await import('electron');
  const logger = (await import('../utils/logger.js')).default;

  if (!mainWindow || mainWindow.isDestroyed()) {
    logger.error('[MainIPC-Core-AddUrl] addUrlToCanvasViaIPC: Main window not available.');
    return { success: false, error: 'Main window not available to add URL' };
  }

  return new Promise((resolve) => {
    const requestId = `canvas-add-url-request-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const requestChannel = 'canvas:add-url-request-from-main'; // To renderer
    const responseChannel = `canvas:add-url-response-from-renderer-${requestId}`; // From renderer
    const timeoutMs = 10000;

    logger.info(`[MainIPC-Core-AddUrl] Sending ${requestChannel} with ID: ${requestId}, Args: ${JSON.stringify(ipcArgs)}`);

    const timeoutHandle = setTimeout(() => {
      ipcMain.removeListener(responseChannel, listener);
      logger.error(`[MainIPC-Core-AddUrl] Timeout (${timeoutMs}ms) waiting for ${responseChannel}`);
      resolve({ success: false, error: `Timeout waiting for canvas add URL response (ID: ${requestId})` });
    }, timeoutMs);

    const listener = (_event: Electron.IpcMainEvent, responseArgs: IPCResponse<CanvasElementData>) => {
      clearTimeout(timeoutHandle);
      ipcMain.removeListener(responseChannel, listener);
      if (responseArgs.success) {
        logger.info(`[MainIPC-Core-AddUrl] Received success response for ${responseChannel}`);
        resolve({ success: true, data: responseArgs.data });
      } else {
        logger.error(`[MainIPC-Core-AddUrl] Received error response for ${responseChannel}: ${responseArgs.error}`);
        resolve({ success: false, error: responseArgs.error || `Failed to add URL from renderer (ID: ${requestId})` });
      }
    };

    ipcMain.on(responseChannel, listener);
    mainWindow.webContents.send(requestChannel, { ...ipcArgs, requestId });
  });
}

export async function add_url_to_canvas_tool_implementation(args: AddUrlToCanvasArgs) {
  const logger = (await import('../utils/logger.js')).default;
  logger.info('[AI Tool Impl - add_url_to_canvas] Preparing to add URL to canvas with args:', args);
  const mainWindow = getMainWindow();

  if (!mainWindow) {
    logger.error('[AI Tool Impl - add_url_to_canvas] Main window not available.');
    return {
      summary: 'Main window not available to add URL to canvas.',
      success: false,
      error: 'Main window not found'
    };
  }
  if (!mainWindow.webContents) {
    logger.error('[AI Tool Impl - add_url_to_canvas] mainWindow.webContents is undefined or null.');
    return {
      summary: 'WebContents not available on the main window.',
      success: false,
      error: 'mainWindow.webContents is not available'
    };
  }

  const ipcRelayArgs: AddUrlToCanvasIPCArgs = {
    url: args.url,
    position: args.position,
    options: args.options
  };

  try {
    logger.info('[AI Tool Impl - add_url_to_canvas] Relaying to addUrlToCanvasViaIPC with:', ipcRelayArgs);
    const result = await addUrlToCanvasViaIPC(mainWindow, ipcRelayArgs);
    logger.info('[AI Tool Impl - add_url_to_canvas] Result from addUrlToCanvasViaIPC:', result);

    if (result.success) {
      return {
        summary: `URL successfully added to canvas. Element ID: ${result.data?.id || 'N/A'}`,
        data: result.data,
        success: true
      };
    } else {
      return {
        summary: `Failed to add URL to canvas via IPC: ${result.error || 'Unknown error from IPC relay.'}`,
        success: false,
        error: result.error || 'Unknown error from IPC relay.'
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AI Tool Impl - add_url_to_canvas] Critical error during IPC relay or processing result:', errorMessage);
    return {
      summary: `Critical error during add_url_to_canvas tool execution: ${String(errorMessage)}`,
      success: false,
      error: String(errorMessage)
    };
  }
}

interface AddEmbedToCanvasArgs {
  url: string; // URL for the iframe/embed content
  position?: { x: number; y: number };
  options?: {
    width?: number;
    height?: number;
    description?: string;
  };
}

interface AddEmbedToCanvasIPCArgs {
  position?: { x: number; y: number }; // Position is optional at IPC level, CanvasInteraction handles default
  options: { // Options are not optional, as URL is required within options
    url: string;
    width?: number;
    height?: number;
    description?: string;
  };
}

async function addEmbedToCanvasViaIPC(mainWindow: BrowserWindow, ipcArgs: AddEmbedToCanvasIPCArgs): Promise<IPCResponse<CanvasElementData>> {
  const { ipcMain } = await import('electron');
  const logger = (await import('../utils/logger.js')).default;

  if (!mainWindow || mainWindow.isDestroyed()) {
    logger.error('[MainIPC-Core-AddEmbed] addEmbedToCanvasViaIPC: Main window not available.');
    return { success: false, error: 'Main window not available to add embed' };
  }

  return new Promise((resolve) => {
    const requestId = `canvas-add-embed-request-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const requestChannel = 'canvas:add-embed-request-from-main'; // To renderer
    const responseChannel = `canvas:add-embed-response-from-renderer-${requestId}`; // From renderer
    const timeoutMs = 10000;

    logger.info(`[MainIPC-Core-AddEmbed] Sending ${requestChannel} with ID: ${requestId}, Args: ${JSON.stringify(ipcArgs)}`);

    const timeoutHandle = setTimeout(() => {
      ipcMain.removeListener(responseChannel, listener);
      logger.error(`[MainIPC-Core-AddEmbed] Timeout (${timeoutMs}ms) waiting for ${responseChannel}`);
      resolve({ success: false, error: `Timeout waiting for canvas add embed response (ID: ${requestId})` });
    }, timeoutMs);

    const listener = (_event: Electron.IpcMainEvent, responseArgs: IPCResponse<CanvasElementData>) => {
      clearTimeout(timeoutHandle);
      ipcMain.removeListener(responseChannel, listener);
      if (responseArgs.success) {
        logger.info(`[MainIPC-Core-AddEmbed] Received success response for ${responseChannel}`);
        resolve({ success: true, data: responseArgs.data });
      } else {
        logger.error(`[MainIPC-Core-AddEmbed] Received error response for ${responseChannel}: ${responseArgs.error}`);
        resolve({ success: false, error: responseArgs.error || `Failed to add embed from renderer (ID: ${requestId})` });
      }
    };

    ipcMain.on(responseChannel, listener);
    mainWindow.webContents.send(requestChannel, { ...ipcArgs, requestId });
  });
}

export async function add_embed_to_canvas_tool_implementation(args: AddEmbedToCanvasArgs) {
  const logger = (await import('../utils/logger.js')).default;
  logger.info('[AI Tool Impl - add_embed_to_canvas] Preparing to add embed to canvas with args:', args);
  const mainWindow = getMainWindow();

  if (!mainWindow) {
    logger.error('[AI Tool Impl - add_embed_to_canvas] Main window not available.');
    return {
      summary: 'Main window not available to add embed to canvas.',
      success: false,
      error: 'Main window not found'
    };
  }
  if (!mainWindow.webContents) {
    logger.error('[AI Tool Impl - add_embed_to_canvas] mainWindow.webContents is undefined or null.');
    return {
      summary: 'WebContents not available on the main window.',
      success: false,
      error: 'mainWindow.webContents is not available'
    };
  }

  const ipcRelayArgs: AddEmbedToCanvasIPCArgs = {
    position: args.position,
    options: {
      url: args.url,
      width: args.options?.width,
      height: args.options?.height,
      description: args.options?.description,
    }
  };

  try {
    logger.info('[AI Tool Impl - add_embed_to_canvas] Relaying to addEmbedToCanvasViaIPC with:', ipcRelayArgs);
    const result = await addEmbedToCanvasViaIPC(mainWindow, ipcRelayArgs);
    logger.info('[AI Tool Impl - add_embed_to_canvas] Result from addEmbedToCanvasViaIPC:', result);

    if (result.success) {
      return {
        summary: `Embed successfully added to canvas. Element ID: ${result.data?.id || 'N/A'}`,
        data: result.data,
        success: true
      };
    } else {
      return {
        summary: `Failed to add embed to canvas via IPC: ${result.error || 'Unknown error from IPC relay.'}`,
        success: false,
        error: result.error || 'Unknown error from IPC relay.'
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[AI Tool Impl - add_embed_to_canvas] Critical error during IPC relay or processing result:', errorMessage);
    return {
      summary: `Critical error during add_embed_to_canvas tool execution: ${errorMessage}`,
      success: false,
      error: errorMessage
    };
  }
}
