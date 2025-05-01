import puppeteer, { Browser, Page } from 'puppeteer';
import EventEmitter from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { ipcMain } from 'electron';

// Define workflow interfaces
export interface WorkflowStep {
  action: 'navigate' | 'click' | 'type' | 'wait' | 'waitForSelector' | 'screenshot' | 'conditional';
  payload: any;
  timestamp: number;
  description?: string;
  paramName?: string;
  retryOptions?: {
    maxRetries: number;
    delay: number;
  };
  conditionalBranch?: {
    condition: string;
    trueSteps: WorkflowStep[];
    falseSteps?: WorkflowStep[];
  };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  steps: WorkflowStep[];
  parameters?: { [key: string]: { description: string; type: 'string' | 'number' } };
}

export class PuppeteerManager extends EventEmitter {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isRecording = false;
  private currentWorkflow: Workflow | null = null;
  private screenshotInterval: NodeJS.Timeout | null = null;
  private options = {
    screenshotInterval: 2000,
    screenshotQuality: 70
  };

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { 
          width: 1280, 
          height: 800,
          deviceScaleFactor: 1, // Reduced to prevent performance issues
          hasTouch: false
        },
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--js-flags="--max-old-space-size=512"', // Limit memory usage
          '--enable-features=NetworkService',
          '--allow-running-insecure-content'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Improve page performance
      await this.page.setRequestInterception(true);
      this.page.on('request', (request) => {
        // Block unnecessary resources to improve performance
        const resourceType = request.resourceType();
        if (['media', 'font', 'websocket'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Improve page error handling
      this.page.setDefaultNavigationTimeout(60000);
      this.page.setDefaultTimeout(30000);
      
      // Set up event listeners for page events
      this.setupEventListeners();
      
      // Start periodic screenshots for UI updates
      this.startScreenshotUpdates();
      
      // Navigate to blank page to ensure browser is ready
      await this.page.goto('about:blank');
      
      this.emit('ready');
      logger.info('Puppeteer browser initialized successfully in headless mode');
      return true;
    } catch (error) {
      logger.error('Failed to initialize Puppeteer browser:', error);
      return false;
    }
  }
  
  private setupEventListeners() {
    if (!this.page) return;
    
    // Listen for navigation events
    this.page.on('framenavigated', async frame => {
      if (frame === this.page?.mainFrame()) {
        const url = frame.url();
        logger.debug(`Page navigated to: ${url}`);
        this.emit('navigated', { url });
        
        // Record navigation if recording is active
        if (this.isRecording && this.currentWorkflow) {
          this.currentWorkflow.steps.push({
            action: 'navigate',
            payload: { url },
            timestamp: Date.now()
          });
        }
        
        // Ensure page is usable after navigation
        try {
          await this.page?.evaluate(() => {
            // Make page scrollable
            if (document.documentElement) {
              document.documentElement.style.overflow = 'auto';
            }
            return true;
          });
        } catch (err) {
          // Silently ignore evaluation errors
        }
      }
    });
    
    // Listen for console messages
    this.page.on('console', msg => {
      const text = msg.text();
      // Only forward non-verbose console messages
      if (msg.type() === 'error' || msg.type() === 'warning') {
        logger.debug(`Browser console ${msg.type()}: ${text}`);
      }
    });
    
    // Listen for page errors
    this.page.on('pageerror', error => {
      logger.error('Browser page error:', error);
    });
    
    // Listen for load events
    this.page.on('load', () => {
      this.emit('loaded');
      logger.debug('Page loaded');
    });
  }
  
  private startScreenshotUpdates() {
    // Clear any existing interval
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    
    let screenshotInProgress = false;
    
    // Take screenshots with debouncing to prevent performance issues
    this.screenshotInterval = setInterval(async () => {
      if (screenshotInProgress || !this.page || this.page.isClosed()) return;
      
      try {
        screenshotInProgress = true;
        const screenshot = await this.page.screenshot({ 
          type: 'jpeg',
          quality: 70, // Lower quality for better performance
          encoding: 'binary',
          fullPage: false,
          captureBeyondViewport: false,
          omitBackground: false
        });
        this.emit('screenshot', screenshot);
      } catch (error) {
        // Only log serious errors, not just temporary screenshot failures
        if (error instanceof Error && 
            !error.message.includes('Target closed') && 
            !error.message.includes('Session closed')) {
          logger.error('Screenshot error:', error);
        }
      } finally {
        screenshotInProgress = false;
      }
    }, 2000); // Increased interval to prevent freezing and reduce CPU load
  }
  
  async cleanup() {
    logger.info('Cleaning up Puppeteer browser resources');
    
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
    
    if (this.page) {
      try {
        // Remove all listeners to prevent memory leaks
        this.page.removeAllListeners();
        await this.page.close().catch(() => {/* ignore errors */});
        this.page = null;
      } catch (error) {
        logger.warn('Error closing page:', error);
      }
    }
    
    if (this.browser) {
      try {
        const pages = await this.browser.pages().catch(() => []);
        // Close any remaining pages
        for (const page of pages) {
          await page.close().catch(() => {/* ignore errors */});
        }
        
        await this.browser.close().catch(() => {/* ignore errors */});
        this.browser = null;
      } catch (error) {
        logger.warn('Error closing browser:', error);
      }
    }
    
    // Remove all event listeners from this instance
    this.removeAllListeners();
    
    logger.info('Puppeteer browser cleaned up');
  }
  
  // Browser control methods
  async navigate(url: string) {
    if (!this.page) throw new Error('Browser not initialized');
    logger.info(`Navigating to ${url}`);
    this.emit('loading', { url });
    
    try {
      // Make sure URL has proper format
      let formattedUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        formattedUrl = `https://${url}`;
      }
      
      logger.info(`Formatted URL: ${formattedUrl}`);
      
      // Set a longer navigation timeout and use domcontentloaded instead of networkidle2
      // which can sometimes hang indefinitely
      await this.page.goto(formattedUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000  // Reduced timeout to avoid long hanging
      });
      
      // Continue loading in background without blocking
      setTimeout(() => {
        this.page?.evaluate(() => {
          // Dummy evaluation to ensure page is interactive
          return document.readyState;
        }).catch(e => logger.debug('Background page evaluation error:', e));
      }, 500);
      
      // Report successful navigation
      this.emit('navigated', { url: formattedUrl });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Navigation failed to ${url}:`, errorMessage);
      this.emit('navigation_error', { url, error: errorMessage });
      
      // Try to recover by forcing the page to be interactive
      try {
        await this.page.evaluate(() => window.stop());
        this.emit('navigated', { url: formattedUrl, partial: true });
      } catch (e) {
        logger.debug('Failed to stop navigation:', e);
      }
      
      return false;
    }
  }
  
  async click(selector: string) {
    if (!this.page) throw new Error('Browser not initialized');
    logger.info(`Clicking on selector: ${selector}`);
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      
      // Highlight the element before clicking
      await this.highlightElement(selector);
      
      // Use evaluate for more reliable clicking
      await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.click();
          return true;
        }
        return false;
      }, selector);
      
      // Record click if recording is active
      if (this.isRecording && this.currentWorkflow) {
        this.currentWorkflow.steps.push({
          action: 'click',
          payload: { selector },
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      logger.error(`Click failed on selector ${selector}:`, error);
      return false;
    }
  }
  
  async type(selector: string, text: string) {
    if (!this.page) throw new Error('Browser not initialized');
    logger.info(`Typing "${text}" into selector: ${selector}`);
    
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      
      // Highlight the element before typing
      await this.highlightElement(selector);
      
      // Clear the field first
      await this.page.evaluate((sel) => {
        document.querySelector(sel)?.setAttribute('value', '');
      }, selector);
      
      // Type with a human-like delay
      await this.page.type(selector, text, { delay: 30 });
      
      // Record type action if recording is active
      if (this.isRecording && this.currentWorkflow) {
        this.currentWorkflow.steps.push({
          action: 'type',
          payload: { selector, text },
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      logger.error(`Type failed on selector ${selector}:`, error);
      return false;
    }
  }
  
  async getScreenshot() {
    if (!this.page) throw new Error('Browser not initialized');
    try {
      return await this.page.screenshot({ 
        type: 'jpeg',
        quality: 80,
        encoding: 'binary'
      });
    } catch (error) {
      logger.error('Screenshot failed:', error);
      return null;
    }
  }
  
  async getContent() {
    if (!this.page) throw new Error('Browser not initialized');
    try {
      return await this.page.content();
    } catch (error) {
      logger.error('Failed to get page content:', error);
      return null;
    }
  }
  
  private async highlightElement(selector: string) {
    if (!this.page) return;
    
    try {
      // Add a temporary highlight effect to the element
      await this.page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          const originalOutline = element.style.outline;
          const originalBoxShadow = element.style.boxShadow;
          
          element.style.outline = '2px solid red';
          element.style.boxShadow = '0 0 10px rgba(255, 0, 0, 0.5)';
          
          setTimeout(() => {
            element.style.outline = originalOutline;
            element.style.boxShadow = originalBoxShadow;
          }, 500);
        }
      }, selector);
    } catch (error) {
      // Silently fail on highlight errors
    }
  }
  
  // Workflow recording methods
  startRecording() {
    this.isRecording = true;
    this.currentWorkflow = {
      id: uuidv4(),
      name: `Workflow ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      createdAt: Date.now(),
      steps: []
    };
    
    logger.info('Started recording workflow');
    this.emit('recording_started', { workflowId: this.currentWorkflow.id });
    
    this.setupRecordingListeners();
    
    return true;
  }
  
  private setupRecordingListeners() {
    if (!this.page) return;
    
    // Inject event listeners into the page
    this.page.evaluate(() => {
      // Create a global record function that will be called from event listeners
      window.__recordAction = function(action, payload) {
        // Send the recorded action to the Node.js process
        console.log(`__WORKFLOW_ACTION__:${JSON.stringify({ action, payload })}`);
      };
      
      // Add click listener
      document.addEventListener('click', function(e) {
        if (!window.__recordAction) return;
        
        // Generate a selector for the element
        const target = e.target;
        if (!(target instanceof Element)) return;
        
        // Simple selector generation
        let selector = '';
        if (target.id) {
          selector = `#${target.id}`;
        } else if (target.className && typeof target.className === 'string') {
          const classes = target.className.split(' ').filter(c => c.trim().length > 0);
          if (classes.length > 0) {
            selector = `.${classes.join('.')}`;
          }
        }
        
        // If we couldn't generate a good selector, try a more complex approach
        if (!selector) {
          let element = target;
          let path = [];
          while (element && element.nodeType === Node.ELEMENT_NODE) {
            let selector = element.nodeName.toLowerCase();
            if (element.id) {
              selector += `#${element.id}`;
              path.unshift(selector);
              break;
            } else {
              let sibling = element;
              let nth = 1;
              while (sibling = sibling.previousElementSibling) {
                if (sibling.nodeName.toLowerCase() === selector) nth++;
              }
              if (nth !== 1) selector += `:nth-of-type(${nth})`;
            }
            path.unshift(selector);
            element = element.parentNode;
          }
          selector = path.join(' > ');
        }
        
        window.__recordAction('click', { selector });
      }, true);
      
      // Add input listener for text fields
      document.addEventListener('change', function(e) {
        if (!window.__recordAction) return;
        
        const target = e.target;
        if (!(target instanceof HTMLInputElement) && 
            !(target instanceof HTMLTextAreaElement) && 
            !(target instanceof HTMLSelectElement)) return;
        
        let selector = '';
        if (target.id) {
          selector = `#${target.id}`;
        } else if (target.name) {
          selector = `[name="${target.name}"]`;
        } else if (target.className && typeof target.className === 'string') {
          const classes = target.className.split(' ').filter(c => c.trim().length > 0);
          if (classes.length > 0) {
            selector = `.${classes.join('.')}`;
          }
        }
        
        if (!selector) return;
        
        window.__recordAction('type', { 
          selector, 
          text: target.value 
        });
      }, true);
    });
    
    // Listen for console messages that contain our special marker
    this.page.on('console', msg => {
      const text = msg.text();
      if (text.startsWith('__WORKFLOW_ACTION__:')) {
        try {
          const actionData = JSON.parse(text.substring('__WORKFLOW_ACTION__:'.length));
          
          if (this.isRecording && this.currentWorkflow) {
            this.currentWorkflow.steps.push({
              action: actionData.action,
              payload: actionData.payload,
              timestamp: Date.now()
            });
            
            logger.debug(`Recorded user action: ${actionData.action}`, actionData.payload);
            this.emit('action_recorded', { action: actionData.action, payload: actionData.payload });
          }
        } catch (e) {
          logger.error('Failed to parse recorded action:', e);
        }
      }
    });
  }
  
  stopRecording() {
    if (!this.isRecording || !this.currentWorkflow) {
      return null;
    }
    
    this.isRecording = false;
    const workflow = { ...this.currentWorkflow };
    
    // Clean up recording listeners
    if (this.page) {
      this.page.evaluate(() => {
        // Remove the global record function
        delete window.__recordAction;
      });
    }
    
    logger.info(`Stopped recording workflow with ${workflow.steps.length} steps`);
    this.emit('recording_stopped', { workflow });
    
    return workflow;
  }
  
  // Workflow execution
  async executeWorkflow(workflow: Workflow, params?: Record<string, any>) {
    if (!this.page) throw new Error('Browser not initialized');
    
    logger.info(`Executing workflow: ${workflow.name} with ${workflow.steps.length} steps`);
    this.emit('workflow_started', { workflow });
    
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      logger.debug(`Executing step ${i+1}/${workflow.steps.length}: ${step.action}`);
      this.emit('workflow_step', { 
        current: i+1, 
        total: workflow.steps.length, 
        action: step.action 
      });
      
      try {
        // Handle different step types
        switch (step.action) {
          case 'navigate':
            await this.navigate(this.replaceParams(step.payload.url, params));
            break;
            
          case 'click':
            await this.click(this.replaceParams(step.payload.selector, params));
            break;
            
          case 'type':
            await this.type(
              this.replaceParams(step.payload.selector, params),
              this.replaceParams(step.payload.text, params)
            );
            break;
            
          case 'wait':
            await this.page.waitForTimeout(step.payload.duration || 1000);
            break;
            
          case 'waitForSelector':
            await this.page.waitForSelector(
              this.replaceParams(step.payload.selector, params),
              { timeout: step.payload.timeout || 30000 }
            );
            break;
            
          case 'screenshot':
            const screenshot = await this.getScreenshot();
            this.emit('workflow_screenshot', { stepIndex: i, screenshot });
            break;
            
          case 'conditional':
            if (step.conditionalBranch) {
              await this.executeConditionalBranch(step.conditionalBranch, params);
            }
            break;
            
          default:
            logger.warn(`Unknown step action: ${step.action}`);
        }
        
        // Add small delay between actions to allow page to update
        await this.page.waitForTimeout(500);
        
        this.emit('workflow_step_completed', { current: i+1, total: workflow.steps.length });
      } catch (error) {
        logger.error(`Error executing workflow step ${i+1} (${step.action}):`, error);
        this.emit('workflow_error', { 
          step: i+1, 
          action: step.action,
          error 
        });
        
        // Check if we should retry
        if (step.retryOptions && step.retryOptions.maxRetries > 0) {
          logger.info(`Retrying step ${i+1} (${step.action})...`);
          step.retryOptions.maxRetries--;
          i--; // Retry the same step
          await this.page.waitForTimeout(step.retryOptions.delay || 1000);
          continue;
        }
        
        return false;
      }
    }
    
    logger.info('Workflow execution completed successfully');
    this.emit('workflow_complete', { workflow });
    return true;
  }
  
  private async executeConditionalBranch(branch: WorkflowStep['conditionalBranch'], params?: Record<string, any>) {
    if (!this.page || !branch) return;
    
    const condition = branch.condition;
    let conditionMet = false;
    
    if (condition.startsWith('selector:')) {
      // Check if element exists
      const selector = condition.replace('selector:', '');
      const normalizedSelector = this.replaceParams(selector, params);
      
      try {
        const elementExists = await this.page.evaluate((sel) => {
          return document.querySelector(sel) !== null;
        }, normalizedSelector);
        
        conditionMet = elementExists;
      } catch (error) {
        logger.error('Error evaluating selector condition:', error);
        conditionMet = false;
      }
    } else if (condition.startsWith('js:')) {
      // Evaluate JS expression
      const jsExpr = condition.replace('js:', '');
      const normalizedExpr = this.replaceParams(jsExpr, params);
      
      try {
        conditionMet = await this.page.evaluate((expr) => {
          // eslint-disable-next-line no-new-func
          return (new Function(`return (${expr})`)());
        }, normalizedExpr);
      } catch (error) {
        logger.error('Error evaluating JS condition:', error);
        conditionMet = false;
      }
    } else {
      // Default to checking if the condition string is non-empty after parameter substitution
      conditionMet = !!this.replaceParams(condition, params);
    }
    
    // Execute the appropriate branch
    const branchToExecute = conditionMet 
      ? branch.trueSteps 
      : (branch.falseSteps || []);
    
    logger.debug(`Condition ${condition} evaluated to ${conditionMet}, executing ${branchToExecute.length} steps`);
    
    // Execute each step in the branch
    for (const step of branchToExecute) {
      await this.executeSingleStep(step, params);
    }
  }
  
  private async executeSingleStep(step: WorkflowStep, params?: Record<string, any>) {
    if (!this.page) return;
    
    switch (step.action) {
      case 'navigate':
        await this.navigate(this.replaceParams(step.payload.url, params));
        break;
      case 'click':
        await this.click(this.replaceParams(step.payload.selector, params));
        break;
      case 'type':
        await this.type(
          this.replaceParams(step.payload.selector, params),
          this.replaceParams(step.payload.text, params)
        );
        break;
      case 'wait':
        await this.page.waitForTimeout(step.payload.duration || 1000);
        break;
      case 'waitForSelector':
        await this.page.waitForSelector(
          this.replaceParams(step.payload.selector, params),
          { timeout: step.payload.timeout || 30000 }
        );
        break;
      case 'screenshot':
        const screenshot = await this.getScreenshot();
        this.emit('workflow_screenshot', { screenshot });
        break;
      case 'conditional':
        if (step.conditionalBranch) {
          await this.executeConditionalBranch(step.conditionalBranch, params);
        }
        break;
    }
    
    // Add small delay between actions
    await this.page.waitForTimeout(300);
  }
  
  private replaceParams(text: string, params?: Record<string, any>): string {
    if (!params || typeof text !== 'string') return text;
    
    return text.replace(/\{(\w+)\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  // Add method to click at position
  async clickAtPosition(x: number, y: number) {
    if (!this.page) throw new Error('Browser not initialized');
    logger.info(`Clicking at position: x=${x}, y=${y}`);
    
    try {
      // Get the viewport dimensions
      const viewport = this.page.viewport();
      if (!viewport) {
        throw new Error('Viewport information not available');
      }
      
      // Ensure coordinates are within viewport
      const validX = Math.min(Math.max(0, x), viewport.width);
      const validY = Math.min(Math.max(0, y), viewport.height);
      
      // Move mouse first, then click (more reliable)
      await this.page.mouse.move(validX, validY);
      await this.page.waitForTimeout(100);
      await this.page.mouse.down();
      await this.page.waitForTimeout(50);
      await this.page.mouse.up();
      
      // Try to directly inject a click event as backup
      await this.page.evaluate(({x, y}) => {
        const element = document.elementFromPoint(x, y);
        if (element) {
          element.click();
          return true;
        }
        return false;
      }, {x: validX, y: validY});
      
      // Record click if recording is active
      if (this.isRecording && this.currentWorkflow) {
        this.currentWorkflow.steps.push({
          action: 'click',
          payload: { x: validX, y: validY },
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      logger.error(`Click at position (${x}, ${y}) failed:`, error);
      return false;
    }
  }

  // Configure browser options
  setOptions(newOptions: Partial<typeof this.options>) {
    this.options = { ...this.options, ...newOptions };
    
    // Restart screenshot updates with new settings
    if (this.page && !this.page.isClosed()) {
      this.startScreenshotUpdates();
    }
    
    logger.info('Updated browser manager options:', this.options);
    return true;
  }
  
  // Get current page URL
  async getCurrentUrl() {
    if (!this.page) throw new Error('Browser not initialized');
    try {
      return await this.page.url();
    } catch (error) {
      logger.error('Error getting current URL:', error);
      return null;
    }
  }
}

export default PuppeteerManager;

// Set up IPC handlers
ipcMain.handle('co-browser-get-content', async () => {
  if (!browserManager) {
    logger.error('Cannot get content: Browser not initialized');
    return { success: false, error: 'Browser not initialized' };
  }
  
  try {
    const content = await browserManager.getContent();
    // Trigger a screenshot update to refresh the view
    setTimeout(() => browserManager?.getScreenshot(), 100);
    return { success: true, data: content };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Error getting page content:', errorMessage);
    return { success: false, error: errorMessage };
  }
}); 