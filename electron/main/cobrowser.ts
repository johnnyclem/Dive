import { ipcMain, WebContents } from 'electron';
import { PuppeteerManager, Workflow } from '../../services/browser/puppeteerManager';
import workflowStorage from '../../services/browser/workflowStorage';
import logger from '../../services/utils/logger';

// Configuration for browser behavior
const BROWSER_CONFIG = {
  // Whether to prioritize interactivity over security
  interactiveMode: true,
  // How long to wait between health checks (milliseconds)
  healthCheckInterval: 10000,
  // How long to wait before considering browser unresponsive (milliseconds)
  healthCheckTimeout: 10000,
  // Screenshot update frequency (milliseconds)
  screenshotInterval: 3000,
  // Screenshot quality (1-100)
  screenshotQuality: 60
};

// Singleton instance
let browserManager: PuppeteerManager | null = null;
let rendererWebContents: WebContents | null = null;
let initializationInProgress = false;

// Initialize the browser manager
export async function initializeCoBrowser(webContents: WebContents) {
  if (initializationInProgress) {
    logger.info('Browser initialization already in progress, waiting...');
    return false;
  }

  rendererWebContents = webContents;
  
  // Ensure the webContents doesn't throttle when inactive
  if (webContents && !webContents.isDestroyed()) {
    webContents.setBackgroundThrottling(false);
  }
  
  try {
    initializationInProgress = true;
    
    // Clean up any existing instance first
    if (browserManager) {
      logger.info('Cleaning up existing browser instance before initializing a new one');
      await cleanupCoBrowser();
    }
    
    logger.info('Creating new Puppeteer browser manager instance');
    browserManager = new PuppeteerManager();
    
    // Configure the browser for interactive mode if needed
    if (BROWSER_CONFIG.interactiveMode) {
      browserManager.setOptions({
        screenshotInterval: BROWSER_CONFIG.screenshotInterval,
        screenshotQuality: BROWSER_CONFIG.screenshotQuality
      });
    }
    
    // Set up event forwarding to renderer
    setupEventForwarding();
    
    logger.info('Initializing Puppeteer browser...');
    const initialized = await browserManager.initialize();
    
    if (!initialized) {
      logger.error('Failed to initialize Puppeteer browser');
      browserManager = null;
      return false;
    }
    
    logger.info('Puppeteer browser successfully initialized');
    return true;
  } catch (error) {
    logger.error('Error initializing Puppeteer browser:', error);
    browserManager = null;
    return false;
  } finally {
    initializationInProgress = false;
  }
}

// Set up event forwarding from browser manager to renderer
function setupEventForwarding() {
  if (!browserManager) return;
  
  const forwardEvents = [
    'ready', 'navigated', 'loading', 'loaded', 'navigation_error',
    'screenshot', 'recording_started', 'recording_stopped', 'action_recorded',
    'workflow_started', 'workflow_step', 'workflow_step_completed',
    'workflow_complete', 'workflow_error', 'workflow_screenshot'
  ];
  
  forwardEvents.forEach(eventName => {
    // Remove existing listeners if any (prevents duplicates)
    browserManager?.removeAllListeners(eventName);
    
    // Add new listener
    browserManager?.on(eventName, function(data) {
      // Update timestamp when receiving screenshots to monitor browser health
      if (eventName === 'screenshot') {
        updateScreenshotTimestamp();
      }
      
      if (rendererWebContents && !rendererWebContents.isDestroyed()) {
        logger.debug(`Forwarding event to renderer: ${eventName}`);
        
        // For screenshot events, convert buffer to base64
        if (eventName === 'screenshot' && data instanceof Buffer) {
          rendererWebContents.send('co-browser-event', {
            event: eventName,
            data: {
              buffer: data.toString('base64')
            }
          });
        } else if (eventName === 'workflow_screenshot' && 
                  typeof data === 'object' && 
                  data !== null && 
                  'screenshot' in data && 
                  data.screenshot instanceof Buffer) {
          const newData = { ...data };
          newData.screenshot = data.screenshot.toString('base64');
          rendererWebContents.send('co-browser-event', {
            event: eventName,
            data: newData
          });
        } else {
          rendererWebContents.send('co-browser-event', {
            event: eventName,
            data
          });
        }
      }
    });
  });
}

// Clean up browser manager
export async function cleanupCoBrowser() {
  if (browserManager) {
    logger.info('Cleaning up Puppeteer browser instance');
    try {
      await browserManager.cleanup();
      browserManager = null;
      return true;
    } catch (error) {
      logger.error('Error cleaning up Puppeteer browser:', error);
      browserManager = null;
      return false;
    }
  }
  return true;
}

// Reset browser functionality
ipcMain.handle('co-browser-reset', async () => {
  logger.info('Received request to reset browser');
  
  try {
    // Clean up existing browser
    await cleanupCoBrowser();
    
    // Wait a bit before reinitializing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Create new browser manager
    browserManager = new PuppeteerManager();
    
    // Set up event forwarding
    setupEventForwarding();
    
    // Initialize browser
    logger.info('Reinitializing browser after reset');
    const success = await browserManager.initialize();
    
    if (!success) {
      logger.error('Failed to reinitialize browser');
      browserManager = null;
      return { success: false, error: 'Failed to reinitialize browser' };
    }
    
    logger.info('Browser reset successful');
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error resetting browser:', errorMessage);
    return { success: false, error: errorMessage };
  }
});

// Add health check mechanism to auto-recover frozen browser
let lastScreenshotTime = Date.now();
let healthCheckInterval: NodeJS.Timeout | null = null;

function startHealthCheck() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  healthCheckInterval = setInterval(async () => {
    if (!browserManager) return;
    
    const currentTime = Date.now();
    const timeSinceLastScreenshot = currentTime - lastScreenshotTime;
    
    // Check if browser is healthy (has received screenshot in last 10 seconds)
    if (timeSinceLastScreenshot > 10000) {
      logger.warn(`Browser health check: No screenshots for ${timeSinceLastScreenshot/1000}s, resetting browser`);
      
      try {
        await cleanupCoBrowser();
        
        // Wait a bit before reinitializing
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create new browser manager
        browserManager = new PuppeteerManager();
        
        // Set up event forwarding
        setupEventForwarding();
        
        // Initialize browser
        const success = await browserManager.initialize();
        
        if (success && rendererWebContents && !rendererWebContents.isDestroyed()) {
          rendererWebContents.send('co-browser-event', {
            event: 'browser_reset',
            data: { automatic: true }
          });
          
          lastScreenshotTime = Date.now(); // Reset timer
        }
      } catch (error) {
        logger.error('Error during automatic browser reset:', error);
      }
    }
  }, 5000); // Check every 5 seconds
}

// Update screenshot timestamp when receiving screenshots
function updateScreenshotTimestamp() {
  lastScreenshotTime = Date.now();
}

// Set up IPC handlers
export function setupCoBrowserIPC() {
  // Start health check
  startHealthCheck();
  
  // Browser control
  ipcMain.handle('co-browser-initialize', async (event) => {
    logger.info('Received request to initialize browser');
    return await initializeCoBrowser(event.sender);
  });
  
  ipcMain.handle('co-browser-navigate', async (_, url: string) => {
    logger.info(`Received request to navigate to: ${url}`);
    if (!browserManager) {
      logger.error('Cannot navigate: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const success = await browserManager.navigate(url);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error navigating to ${url}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-click', async (_, selector: string) => {
    logger.info(`Received request to click selector: ${selector}`);
    if (!browserManager) {
      logger.error('Cannot click: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const success = await browserManager.click(selector);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error clicking on ${selector}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-type', async (_, selector: string, text: string) => {
    logger.info(`Received request to type into selector: ${selector}`);
    if (!browserManager) {
      logger.error('Cannot type: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const success = await browserManager.type(selector, text);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error typing into ${selector}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-get-screenshot', async () => {
    if (!browserManager) {
      logger.error('Cannot get screenshot: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const screenshot = await browserManager.getScreenshot();
      if (screenshot) {
        updateScreenshotTimestamp(); // Update timestamp when getting a screenshot
        return { 
          success: true, 
          data: Buffer.from(screenshot).toString('base64')
        };
      }
      return { success: false, error: 'Failed to get screenshot' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting screenshot:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-get-content', async () => {
    if (!browserManager) {
      logger.error('Cannot get content: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const content = await browserManager.getContent();
      return { success: true, data: content };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting page content:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  // Workflow recording
  ipcMain.handle('co-browser-start-recording', () => {
    logger.info('Received request to start workflow recording');
    if (!browserManager) {
      logger.error('Cannot start recording: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const result = browserManager.startRecording();
      return { success: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error starting recording:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-stop-recording', () => {
    logger.info('Received request to stop workflow recording');
    if (!browserManager) {
      logger.error('Cannot stop recording: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const workflow = browserManager.stopRecording();
      return { success: !!workflow, workflow };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error stopping recording:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  // Workflow storage
  ipcMain.handle('co-browser-save-workflow', (_, workflow: Workflow) => {
    logger.info(`Received request to save workflow: ${workflow.name}`);
    try {
      const success = workflowStorage.saveWorkflow(workflow);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error saving workflow:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-get-workflows', () => {
    logger.info('Received request to list all workflows');
    try {
      const workflows = workflowStorage.getAllWorkflows();
      return { success: true, workflows };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Error getting workflows:', errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-get-workflow', (_, id: string) => {
    logger.info(`Received request to get workflow: ${id}`);
    try {
      const workflow = workflowStorage.getWorkflow(id);
      return { success: !!workflow, workflow };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error getting workflow ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-delete-workflow', (_, id: string) => {
    logger.info(`Received request to delete workflow: ${id}`);
    try {
      const success = workflowStorage.deleteWorkflow(id);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error deleting workflow ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  ipcMain.handle('co-browser-update-workflow', (_, id: string, updates: Partial<Workflow>) => {
    logger.info(`Received request to update workflow: ${id}`);
    try {
      const success = workflowStorage.updateWorkflow(id, updates);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error updating workflow ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
  
  // Workflow execution
  ipcMain.handle('co-browser-execute-workflow', async (_, id: string, params?: Record<string, string | number | boolean>) => {
    logger.info(`Received request to execute workflow: ${id}`);
    if (!browserManager) {
      logger.error('Cannot execute workflow: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const workflow = workflowStorage.getWorkflow(id);
      if (!workflow) {
        logger.error(`Workflow with ID ${id} not found`);
        return { success: false, error: `Workflow with ID ${id} not found` };
      }
      
      logger.info(`Executing workflow ${workflow.name} with ${workflow.steps.length} steps`);
      const success = await browserManager.executeWorkflow(workflow, params);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error executing workflow ${id}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });

  // Browser cleanup
  ipcMain.handle('co-browser-cleanup', async () => {
    logger.info('Received request to clean up browser instance');
    return await cleanupCoBrowser();
  });

  // Add click position handler to IPC
  ipcMain.handle('co-browser-click-position', async (_, x: number, y: number) => {
    logger.info(`Received request to click at position: x=${x}, y=${y}`);
    if (!browserManager) {
      logger.error('Cannot click: Browser not initialized');
      return { success: false, error: 'Browser not initialized' };
    }
    
    try {
      const success = await browserManager.clickAtPosition(x, y);
      return { success };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error clicking at position (${x}, ${y}):`, errorMessage);
      return { success: false, error: errorMessage };
    }
  });
}

// Export a cleanup function for app shutdown
export async function onAppQuit() {
  await cleanupCoBrowser();
} 