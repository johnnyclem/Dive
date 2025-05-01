import { BrowserWindow, BrowserView, ipcMain, Rectangle, app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import logger from '../../services/utils/logger.js';
import { fileURLToPath } from 'node:url';

let browserView: BrowserView | null = null;
let mainWindow: BrowserWindow | null = null;
let attached = false;
let isRecording = false;
let lastBounds: Rectangle | null = null;

interface WorkflowStep {
  action: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

let currentWorkflow: WorkflowStep[] = [];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const preloadPath = path.join(__dirname, '../preload/browser.cjs');

// --------- Workflow Persistence ---------
interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  steps: WorkflowStep[];
  parameters?: Record<string, { description?: string; type?: string }>;
}

const workflowsFile = path.join(app.getPath('userData'), 'workflows.json');

function loadWorkflows(): Workflow[] {
  try {
    const raw = fs.readFileSync(workflowsFile, 'utf-8');
    return JSON.parse(raw);
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== 'ENOENT') logger.error('Failed to load workflows', e);
    return [];
  }
}

function saveWorkflows(list: Workflow[]) {
  try {
    fs.mkdirSync(path.dirname(workflowsFile), { recursive: true });
    fs.writeFileSync(workflowsFile, JSON.stringify(list, null, 2), 'utf-8');
  } catch (err) {
    logger.error('Failed to save workflows', err);
  }
}

const cancelledWorkflows = new Set<string>();

function persistCurrentWorkflow(name: string, description?: string, parameters: Record<string, { description?: string; type?: string }> = {}) {
  if (!currentWorkflow.length) return { success: false, error: 'No steps recorded' };
  const workflows = loadWorkflows();
  const workflow: Workflow = {
    id: crypto.randomUUID(),
    name,
    description,
    createdAt: Date.now(),
    steps: [...currentWorkflow],
    parameters,
  };
  workflows.push(workflow);
  saveWorkflows(workflows);
  currentWorkflow = [];
  return { success: true, workflow };
}

function getWorkflow(id: string): Workflow | undefined {
  return loadWorkflows().find(w => w.id === id);
}

// --------- Workflow Execution ---------
async function executeWorkflow(id: string, params: Record<string, string> = {}) {
  // Ensure the BrowserView is ready and visible for playback
  if (!browserView) createView();
  if (!attached) {
    if (mainWindow) {
      // Attach to the right 60% of the window
      const winBounds = mainWindow.getContentBounds();
      const targetWidth = Math.floor(winBounds.width * 0.6);
      const targetX = winBounds.width - targetWidth;
      const targetBounds: Rectangle = {
        x: targetX,
        y: 0, // Assuming header/toolbar is handled by main window layout
        width: targetWidth,
        height: winBounds.height,
      };
      attach(targetBounds);
    } else if (lastBounds) {
      // Fallback if mainWindow is somehow unavailable
      attach(lastBounds);
    }
  }

  const wf = getWorkflow(id);
  if (!wf) {
    mainWindow?.webContents.send('WORKFLOW_EXECUTION_STATUS', {
      workflowId: id,
      status: 'error',
      message: 'Workflow not found',
    });
    return;
  }

  mainWindow?.webContents.send('WORKFLOW_EXECUTION_STATUS', {
    workflowId: id,
    status: 'started',
    totalSteps: wf.steps.length,
  });

  const substitute = (input: unknown): unknown => {
    if (typeof input === 'string') {
      return input.replace(/\{(.*?)\}/g, (_match, p1) => (params[p1] ?? ''));
    }
    if (Array.isArray(input)) return input.map(substitute);
    if (input && typeof input === 'object') {
      const obj: Record<string, unknown> = {};
      for (const k in input as Record<string, unknown>) {
        obj[k] = substitute((input as Record<string, unknown>)[k]);
      }
      return obj;
    }
    return input;
  };

  for (let i = 0; i < wf.steps.length; i++) {
    if (cancelledWorkflows.has(id)) {
      mainWindow?.webContents.send('WORKFLOW_EXECUTION_STATUS', {
        workflowId: id,
        status: 'cancelled',
        currentStep: i,
      });
      cancelledWorkflows.delete(id);
      return;
    }
    const rawStep = wf.steps[i];
    const step = {
      ...rawStep,
      payload: substitute(rawStep.payload) as Record<string, unknown>,
    } as WorkflowStep;
    try {
      await runStep(step);
      mainWindow?.webContents.send('WORKFLOW_EXECUTION_STATUS', {
        workflowId: id,
        status: 'step_completed',
        currentStep: i + 1,
        stepAction: step.action,
      });
    } catch (err) {
      logger.error('Workflow step error', err);
      mainWindow?.webContents.send('WORKFLOW_EXECUTION_STATUS', {
        workflowId: id,
        status: 'error',
        currentStep: i + 1,
        message: String(err),
      });
      return;
    }
  }

  mainWindow?.webContents.send('WORKFLOW_EXECUTION_STATUS', {
    workflowId: id,
    status: 'completed',
  });
}

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

async function runStep(step: WorkflowStep) {
  if (!browserView) throw new Error('BrowserView not ready');
  const wc = browserView.webContents;

  switch (step.action) {
    case 'navigate':
      await wc.loadURL(String(step.payload.url));
      break;
    case 'click': {
      const selector = step.payload.selector as string;
      await wc.executeJavaScript(`document.querySelector(${JSON.stringify(selector)})?.click()`);
      break;
    }
    case 'type': {
      const selector = step.payload.selector as string;
      const value = step.payload.value as string;
      await wc.executeJavaScript(`(function(){const el=document.querySelector(${JSON.stringify(selector)});if(el){el.focus();el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));}})();`);
      break;
    }
    case 'scroll': {
      const x = step.payload.x ?? 0;
      const y = step.payload.y ?? 0;
      await wc.executeJavaScript(`window.scrollBy(${x}, ${y});`);
      break;
    }
    default:
      logger.warn('Unsupported workflow step action', step.action);
  }

  // Small delay to allow page to respond
  await delay(500);
}

export function initBrowserManager(win: BrowserWindow) {
  mainWindow = win;
  setupIpc();
}

function createView() {
  if (browserView) return;
  browserView = new BrowserView({
    webPreferences: {
      preload: preloadPath,
      sandbox: false,
      contextIsolation: true,
    },
  });
  browserView.webContents.loadURL('about:blank');
}

function attach(bounds: Rectangle) {
  if (!mainWindow) return;
  createView();
  if (!browserView) return;
  if (attached) return;
  mainWindow.addBrowserView(browserView);
  browserView.setBounds(bounds);
  browserView.setAutoResize({ width: true, height: true });
  attached = true;
  lastBounds = bounds;
}

function detach() {
  if (browserView && mainWindow && attached) {
    mainWindow.removeBrowserView(browserView);
    attached = false;
  }
}

function setRecording(record: boolean) {
  isRecording = record;
  if (!mainWindow) return;
  mainWindow.webContents.send('WORKFLOW_STATUS_UPDATE', {
    status: record ? 'recording_started' : 'recording_stopped',
  });
  logger.info(`[Main Record] Sending WORKFLOW_SET_RECORDING: ${record} to BrowserView`);
  browserView?.webContents.send('WORKFLOW_SET_RECORDING', record);
  if (record) {
    currentWorkflow = [];
    const currentUrl = browserView?.webContents.getURL();
    if (currentUrl) {
      currentWorkflow.push({
        action: 'navigate',
        payload: { url: currentUrl },
        timestamp: Date.now(),
      });
    }
    return;
  }
  if (!record) {
    mainWindow.webContents.send('WORKFLOW_CAPTURED_STEPS', currentWorkflow);
  }
}

function setupIpc() {
  ipcMain.on('BROWSER_SET_BOUNDS', (_e, bounds: Rectangle) => {
    if (!bounds) return;
    if (!attached) attach(bounds);
    else browserView?.setBounds(bounds);
    lastBounds = bounds;
  });

  ipcMain.on('BROWSER_SET_VISIBILITY', (_e, visible: boolean) => {
    if (visible && !attached && browserView) {
      mainWindow?.addBrowserView(browserView);
      attached = true;
    } else if (!visible && attached) {
      detach();
    }
  });

  ipcMain.on('BROWSER_USER_NAVIGATE', (_e, url: string) => {
    if (!browserView) return;
    try {
      if (!/^https?:/i.test(url)) url = 'http://' + url;
      browserView.webContents.loadURL(url);
    } catch (err) {
      logger.error('Navigation error', err);
    }
  });

  ipcMain.on('BROWSER_USER_ACTION', (_e, action: 'back' | 'forward' | 'reload') => {
    if (!browserView) return;
    const wc = browserView.webContents;
    if (action === 'back' && wc.canGoBack()) wc.goBack();
    if (action === 'forward' && wc.canGoForward()) wc.goForward();
    if (action === 'reload') wc.reload();
  });

  // Capture navigation events as workflow steps when recording
  ipcMain.on('BROWSER_EVENT', (_event, data) => {
    if (isRecording && data?.event === 'loaded' && data?.payload?.url) {
      currentWorkflow.push({
        action: 'navigate',
        payload: { url: data.payload.url },
        timestamp: Date.now(),
      });
    }
    // Relay to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('BROWSER_EVENT', data);
    }
  });

  ipcMain.on('WORKFLOW_START_RECORDING', () => setRecording(true));
  ipcMain.on('WORKFLOW_STOP_RECORDING', () => setRecording(false));

  ipcMain.on('WORKFLOW_ACTION_CAPTURED', (_e, step) => {
    if (isRecording) currentWorkflow.push(step);
  });

  // Save workflow request
  ipcMain.handle('WORKFLOW_SAVE', (_e, { name, description, parameters }) => {
    return persistCurrentWorkflow(name, description, parameters);
  });

  // Delete workflow
  ipcMain.handle('WORKFLOW_DELETE', (_e, id: string) => {
    return deleteWorkflow(id);
  });

  // Request list of workflows
  ipcMain.handle('WORKFLOW_LIST', () => {
    return loadWorkflows();
  });

  // Execute workflow
  ipcMain.on('WORKFLOW_EXECUTE_REQUEST', (_e, evtData: unknown) => {
    if (typeof evtData === 'string') {
      executeWorkflow(evtData);
    } else if (evtData && typeof evtData === 'object' && 'workflowId' in evtData) {
      const { workflowId, params } = evtData as { workflowId: string; params?: Record<string, string> };
      executeWorkflow(workflowId, params || {});
    }
  });

  ipcMain.on('WORKFLOW_CANCEL_REQUEST', (_e, workflowId: string) => {
    cancelledWorkflows.add(workflowId);
  });

  // Add handler to open BrowserView DevTools
  ipcMain.on('OPEN_BROWSER_VIEW_DEVTOOLS', () => {
    if (browserView && !browserView.webContents.isDestroyed()) {
      browserView.webContents.openDevTools({ mode: 'detach' });
    }
  });
}

function deleteWorkflow(id: string) {
  const workflows = loadWorkflows();
  const idx = workflows.findIndex(w => w.id === id);
  if (idx === -1) return { success: false, error: 'Not found' };
  workflows.splice(idx, 1);
  saveWorkflows(workflows);
  return { success: true };
} 