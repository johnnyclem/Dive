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
  // Placeholder: In a real app, you would have a way to get the current main window.
  // For example, from Electron's `BrowserWindow.getAllWindows()` or a dedicated manager.
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    // This assumes the first window is your main window, which might not always be true.
    return windows[0]; 
  }
  return null;
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
