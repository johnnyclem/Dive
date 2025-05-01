Okay, here is a detailed engineering spec for the collaborative browsing and workflow recording features in the Souls application, based on the user request and the provided `repomix-output.txt`.

---

**Engineering Spec: Collaborative Browsing & Workflow Recording for Souls**

**Version:** 1.0
**Date:** 2024-10-27

**1. Introduction & Goals**

This document outlines the design and implementation details for introducing two core features into the Souls application:

1.  **Collaborative Browsing:** Enable seamless, two-way interaction between the user and the AI agent within an integrated web browser component. The user should observe the agent's browsing actions in real-time, and the agent should be aware of the content the user is viewing.
2.  **Workflow Recording & Execution ("Watch Me Flow"):** Allow users to record sequences of web interactions (e.g., logging in, posting content) which the agent can learn and later execute as new "skills" or "tools", potentially adapting them with new parameters.

**Goals:**

*   Enhance user-agent collaboration by providing a shared web context.
*   Empower the agent with dynamic web interaction capabilities beyond pre-defined tools.
*   Enable users to easily teach the agent new, complex web-based tasks without coding.
*   Provide a visual representation of the agent's web actions to the user.
*   Maintain security and user control throughout browsing and workflow execution.

**2. Architecture**

The proposed features will integrate into the existing Souls architecture (Electron Main Process, Renderer Process (React UI), Backend Service).

*   **Electron Main Process:**
    *   Manages the `BrowserView` instance for web browsing.
    *   Acts as the central hub for IPC communication between the Renderer, Backend Service, and the `BrowserView`.
    *   Executes browser control commands received from the agent (Backend Service).
    *   Listens for events from the `BrowserView` and forwards relevant information.
    *   Manages the recording state.
*   **Renderer Process (React UI):**
    *   Displays the browser content within a dedicated view (e.g., a new "Browser" tab/pane).
    *   Provides UI controls for browsing (back, forward, reload, URL bar).
    *   Provides UI controls for workflow recording (Record, Stop, Save, Manage).
    *   Sends user browsing actions (URL changes, potentially clicks/inputs if needed for recording) to the Main Process via IPC.
    *   Receives updates from the Main Process to reflect agent browsing actions visually (e.g., URL changes, potentially highlighting elements being interacted with).
*   **BrowserView Preload Script (`browser-preload.js`):**
    *   Runs within the `BrowserView`'s context.
    *   Listens for critical browser events (navigation, DOM load, user interactions like clicks/input changes during recording).
    *   Sends relevant event data and potentially scraped content/screenshots to the Main Process via IPC.
    *   Provides an API for the Main Process to execute JavaScript within the `BrowserView` for actions like clicking, typing, scrolling, scraping.
*   **Backend Service (Node.js):**
    *   Houses the agent's core logic (LLM interaction).
    *   Receives user prompts and decides when to use browsing or workflow tools.
    *   Sends browser control commands (`navigate`, `click`, `type`, `get_content`, `screenshot`) to the Main Process via IPC.
    *   Receives browser content (scraped text, screenshots) from the Main Process via IPC to understand the current page context.
    *   Stores and retrieves recorded workflows (potentially interacting with the database service).
    *   Executes recorded workflows by sending a sequence of browser commands.

**Diagram:**

```
+---------------------+      IPC       +------------------------+      IPC       +-------------------+
| Renderer Process    | <------------> | Electron Main Process  | <------------> | Backend Service   |
| (React UI)          |                | (Manages BrowserView)  |                | (Agent Logic, LLM)|
| - UI Controls       |                | - BrowserView Instance |                | - Workflow Store  |
| - Displays Browser  |                | - IPC Hub              |                | - Workflow Engine |
+---------------------+                +-----------+------------+                +-------------------+
                                                   | IPC
                                                   V
                                       +-----------+------------+
                                       | BrowserView (Web Page) |
                                       | - Preload Script       |
                                       | - Captures Events      |
                                       | - Executes JS          |
                                       +------------------------+
```

**3. Collaborative Browsing Implementation**

**3.1. Browser Component Setup:**

*   Utilize Electron's `BrowserView` for embedding web content. This offers better isolation and control than `<webview>`.
*   Create a new view/tab within the Souls UI dedicated to the browser.
*   The `BrowserView` will be managed by the Main Process and attached to the Renderer's window.
*   A `preload` script (`browser-preload.js`) will be injected into the `BrowserView` for communication and event listening.
    *   `webPreferences` should be carefully configured, potentially enabling `contextIsolation` and using `contextBridge` for secure communication.

**3.2. Agent -> Browser Communication (Commands):**

*   The Backend Service sends commands to the Main Process via IPC.
*   The Main Process translates these into `webContents` API calls on the `BrowserView`.
*   **IPC Messages (Backend -> Main):**
    *   `BROWSER_COMMAND`: `{ command: 'navigate', payload: { url: string } }`
    *   `BROWSER_COMMAND`: `{ command: 'click', payload: { selector: string } }` // CSS selector or XPath
    *   `BROWSER_COMMAND`: `{ command: 'type', payload: { selector: string, text: string, options?: { delay?: number } } }`
    *   `BROWSER_COMMAND`: `{ command: 'scroll', payload: { x?: number, y?: number } }` // Scroll by pixels or to element
    *   `BROWSER_COMMAND`: `{ command: 'get_content', payload: { type: 'html' | 'text' | 'screenshot', options?: any } }`
    *   `BROWSER_COMMAND`: `{ command: 'back' }`
    *   `BROWSER_COMMAND`: `{ command: 'forward' }`
    *   `BROWSER_COMMAND`: `{ command: 'reload' }`
*   **Main Process Actions:**
    *   `browserView.webContents.loadURL(url)`
    *   `browserView.webContents.executeJavaScript(...)` to trigger clicks/typing via DOM manipulation in the preload script.
    *   `browserView.webContents.executeJavaScript(...)` to scroll.
    *   `browserView.webContents.executeJavaScript(...)` to scrape content (`document.body.innerText`, etc.) or use `capturePage()` for screenshots. Results sent back via IPC.
    *   `browserView.webContents.goBack()`, `goForward()`, `reload()`.

**3.3. Browser -> Agent/User Communication (Events & Data):**

*   The `preload` script listens for browser events.
*   Events are sent to the Main Process via IPC, which then updates the Renderer UI and informs the Backend Service.
*   **Events Monitored (in Preload):**
    *   `did-navigate`: URL changes.
    *   `did-finish-load`: Page finished loading.
    *   `dom-ready`: DOM is ready (potentially useful for scraping).
    *   User interactions (clicks, input changes) - *specifically during recording*.
*   **IPC Messages (Preload -> Main):**
    *   `BROWSER_EVENT`: `{ event: 'navigated', payload: { url: string, title: string } }`
    *   `BROWSER_EVENT`: `{ event: 'loaded', payload: { url: string } }`
    *   `BROWSER_CONTENT_UPDATE`: `{ type: 'text' | 'screenshot', data: string | Buffer }` (Sent in response to `get_content`)
    *   `WORKFLOW_ACTION_CAPTURED`: `{ action: string, payload: any }` (Sent during recording)
*   **Main Process Actions:**
    *   Forwards `BROWSER_EVENT` ('navigated') to Renderer to update the URL bar.
    *   Forwards `BROWSER_EVENT` ('navigated', 'loaded') and `BROWSER_CONTENT_UPDATE` to the Backend Service so the agent knows the current context.
    *   Handles `WORKFLOW_ACTION_CAPTURED` during recording (See Section 4).

**3.4. User -> Browser Interaction:**

*   User interacts directly with the UI controls (URL bar, back/forward buttons).
*   Renderer sends IPC messages to the Main Process (e.g., `BROWSER_USER_NAVIGATE`).
*   Main Process executes the corresponding action on the `BrowserView`.
*   The resulting browser events (`did-navigate`, etc.) are captured by the preload script and sent back through the standard flow (Preload -> Main -> Backend/Renderer), ensuring the agent is aware of user navigation.

**3.5. Synchronization & Visual Feedback:**

*   The user sees their *own* interactions instantly.
*   Agent actions are *executed* by the Main Process on the `BrowserView`, making them visible to the user.
*   Renderer UI (URL bar, loading indicators) updates based on `BROWSER_EVENT` messages from the Main Process.
*   **Visual Cue:** Consider adding a subtle border or icon to the browser view when the *agent* is actively controlling it, to distinguish from user control. Highlight elements the agent interacts with (e.g., temporary border around a clicked button or typed-in field).

**4. Workflow Recording ("Watch Me Flow") Implementation**

**4.1. Recording State Management:**

*   A global state (potentially managed in the Main Process or a dedicated state atom accessible via IPC) tracks `isRecording: boolean` and `currentWorkflow: Workflow | null`.
*   UI buttons (Record, Stop, Save) in the Renderer trigger IPC messages (`WORKFLOW_START_RECORDING`, `WORKFLOW_STOP_RECORDING`, `WORKFLOW_SAVE`) handled by the Main Process.

**4.2. Capturing User Actions:**

*   When `isRecording` is true, the `browser-preload.js` script activates additional event listeners for user interactions.
*   **Events to Capture:**
    *   `click`: Capture target element selector (CSS selector, XPath, or potentially a more robust identifier).
    *   `input` / `change`: Capture target element selector and the entered value. Debounce input capture.
    *   `did-navigate`: Capture the new URL (already handled for collaborative browsing).
    *   `scroll`: Capture scroll position (optional, might make flows brittle).
*   **IPC Message (Preload -> Main):**
    *   `WORKFLOW_ACTION_CAPTURED`: `{ action: 'click' | 'type' | 'navigate' | 'scroll', payload: { selector?: string, value?: string, url?: string, x?: number, y?: number }, timestamp: number }`
*   **Main Process Action:**
    *   Appends the captured action step to the `currentWorkflow` object.

**4.3. Storing Workflows:**

*   **Data Structure (`WorkflowStep`):**
    ```typescript
    interface WorkflowStep {
      action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'get_content'; // Add wait, screenshot, get_content
      payload: {
        url?: string;          // for navigate
        selector?: string;     // for click, type
        value?: string;        // for type
        x?: number; y?: number; // for scroll
        duration?: number;     // for wait
        selectorToWaitFor?: string; // for wait
        variableName?: string; // for get_content result storage
      };
      timestamp: number;       // For ordering and potential timing playback
      paramName?: string;      // Optional: Name of parameter this step uses
    }

    interface Workflow {
      id: string;              // Unique ID (UUID)
      name: string;
      description?: string;
      createdAt: number;
      steps: WorkflowStep[];
      parameters?: { [key: string]: { description: string; type: 'string' | 'number' } }; // Defined parameters
    }
    ```
*   **Storage Mechanism:**
    *   Option A (Simpler): Store workflows as JSON files in a dedicated user data directory (e.g., `.souls/workflows`).
    *   Option B (More Robust): Add a `workflows` table to the existing SQLite database (`services/database/schema.ts`). Store the `steps` array as a JSON string column.
        ```sql
        CREATE TABLE workflows (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at INTEGER NOT NULL,
          steps TEXT NOT NULL, -- JSON array of WorkflowStep
          parameters TEXT     -- JSON object for parameters
        );
        ```
*   **Saving:** When `WORKFLOW_SAVE` is received (with name/description), the Main Process finalizes the `currentWorkflow` and saves it using the chosen mechanism (file or DB via Backend Service IPC).

**4.4. Workflow Parameterization:**

*   This is a complex aspect requiring careful design.
*   **Initial Approach (MVP):**
    1.  After recording, prompt the user to identify which inputs (typed text, potentially parts of URLs) should be parameters.
    2.  Store parameter definitions (name, description, type) with the workflow (see `Workflow` interface).
*   **Advanced Approach (Future):**
    1.  LLM analyzes the recorded steps and *suggests* potential parameters based on common patterns (e.g., search queries, usernames, passwords - handled securely).
    2.  User confirms or modifies the suggestions.
*   **Security:** Passwords or sensitive data captured during recording should be explicitly marked and handled securely (e.g., prompting the user for them at runtime instead of storing them directly, or using secure storage mechanisms).

**5. Workflow Execution Implementation**

**5.1. Triggering Execution:**

*   **User Trigger:** UI provides a list of saved workflows. A "Run" button triggers an IPC message: `WORKFLOW_EXECUTE_REQUEST`: `{ workflowId: string, params?: { [key: string]: any } }`.
*   **Agent Trigger:** The LLM, based on the user's request and its knowledge of available workflows (provided in the prompt or via a `list_workflows` tool), decides to execute a workflow. It calls an `execute_workflow` tool, passing the workflow ID and any required parameters. The Backend Service translates this into the `WORKFLOW_EXECUTE_REQUEST` IPC message.

**5.2. Replaying Actions:**

*   The Backend Service receives the `WORKFLOW_EXECUTE_REQUEST`.
*   It fetches the specified workflow from storage (DB or file).
*   It prompts the user for any required parameters if not provided.
*   It iterates through the `workflow.steps` array.
*   For each step, it constructs the corresponding `BROWSER_COMMAND` IPC message (filling in parameters) and sends it to the Main Process.
*   **Wait Steps:** Introduce `wait` actions (`WORKFLOW_ACTION_CAPTURED`: `{ action: 'wait', payload: { duration: number } }` or `{ action: 'wait', payload: { selectorToWaitFor: string } }`) during recording or execution logic to handle dynamic page loading. The Backend Service would pause execution for the specified duration or until the element appears (checked via `executeJavaScript`).
*   **Content Extraction:** Add `get_content` and `screenshot` steps to capture data during execution, storing results in variables for later steps or for the final agent response.

**5.3. Handling Variations & Errors:**

*   **Selectors:** Simple CSS selectors or XPaths might be brittle. Initial implementation may rely on these. Future enhancement: Explore more robust selectors (e.g., based on text content, ARIA roles, or potentially integrating a library like Playwright's locators if feasible within Electron).
*   **Error Handling:** If a step fails (e.g., selector not found, navigation error):
    *   The Main process reports the error back to the Backend Service (`WORKFLOW_EXECUTION_ERROR`).
    *   The Backend Service can:
        *   Stop execution and report failure to the user/LLM.
        *   Attempt basic recovery (e.g., retry the step after a short wait).
        *   (Advanced) Ask the LLM for help in resolving the error based on the current page state (screenshot/content).
*   **Feedback:** Provide real-time feedback to the user about the execution status (e.g., "Step 3/10: Clicking 'Login'", "Error: Button not found").

**6. Agent Integration**

**6.1. LLM Prompting:**

*   Modify the system prompt (see `services/prompt/system.ts`) to inform the LLM about:
    *   The existence of the integrated browser.
    *   Its ability to control the browser using specific tools/functions.
    *   Its ability to execute pre-recorded user workflows.
    *   The need to request content (`get_content`, `screenshot`) to understand the current state before deciding on actions.
    *   The availability of recorded workflows (potentially listing them if the list isn't too long, or providing a `list_workflows` tool).

**6.2. Tool Definition:**

*   Define tools for the LLM to interact with the browser and workflows. These are conceptually handled by the Backend Service, which translates them into IPC commands.
    *   `browse_web(action: 'navigate' | 'click' | 'type' | 'scroll' | 'get_content' | 'screenshot', url?: string, selector?: string, text?: string, scroll_x?: number, scroll_y?: number, content_type?: 'html' | 'text')`: Allows the agent fine-grained control.
    *   *Alternative:* `browse_goal(goal: string, current_url: string)`: A higher-level tool where the agent describes the goal, and the backend tries to achieve it (more complex, potentially using another LLM or simpler heuristics). The `browse_web` approach is more direct for initial implementation.
    *   `list_workflows()`: Returns a list of available workflow names and descriptions.
    *   `execute_workflow(workflow_name: string, parameters: object)`: Triggers workflow execution. Parameters match those defined in the `Workflow` interface.

**7. API / IPC Design Summary**

*   **Backend <-> Main:**
    *   `BROWSER_COMMAND` (Backend -> Main): Execute specific browser actions.
    *   `BROWSER_EVENT` (Main -> Backend): Notify agent of navigation, loading.
    *   `BROWSER_CONTENT_RESPONSE` (Main -> Backend): Send scraped content/screenshot data.
    *   `WORKFLOW_EXECUTE_REQUEST` (Backend -> Main): Request execution of a workflow.
    *   `WORKFLOW_EXECUTION_STATUS` (Main -> Backend): Report execution progress/completion/error.
    *   `WORKFLOW_LIST_REQUEST` (Backend -> Main): Request list of workflows.
    *   `WORKFLOW_LIST_RESPONSE` (Main -> Backend): Send list of workflows.
    *   `WORKFLOW_SAVE_REQUEST` (Main -> Backend): Request saving of a workflow.
    *   `WORKFLOW_SAVE_RESPONSE` (Backend -> Main): Confirm save status.
*   **Renderer <-> Main:**
    *   `BROWSER_UI_COMMAND` (Renderer -> Main): User actions (navigate, back, forward, reload).
    *   `BROWSER_EVENT` (Main -> Renderer): Update UI (URL bar, loading state).
    *   `WORKFLOW_RECORD_COMMAND` (Renderer -> Main): Start/Stop/Save recording.
    *   `WORKFLOW_EXECUTE_REQUEST` (Renderer -> Main): User initiates workflow execution.
    *   `WORKFLOW_EXECUTION_STATUS` (Main -> Renderer): Update UI with execution status.
    *   `WORKFLOW_LIST_REQUEST/RESPONSE` (For managing workflows in UI).
*   **Preload <-> Main:**
    *   `BROWSER_EVENT` (Preload -> Main): Browser navigation/load events.
    *   `WORKFLOW_ACTION_CAPTURED` (Preload -> Main): User interaction during recording.
    *   `EXECUTE_SCRIPT_REQUEST` (Main -> Preload): Request to run JS in the page.
    *   `EXECUTE_SCRIPT_RESPONSE` (Preload -> Main): Result of script execution (e.g., scraped content).

**8. Data Models (TypeScript)**

```typescript
// (WorkflowStep and Workflow interfaces defined in Section 4.3)

// Example Payload Structures for IPC/Tool Calls
interface NavigatePayload { url: string; }
interface ClickPayload { selector: string; }
interface TypePayload { selector: string; text: string; }
interface ScrollPayload { x?: number; y?: number; selector?: string; } // Scroll by amount or to element
interface GetContentPayload { type: 'html' | 'text' | 'screenshot'; selector?: string; }
interface WaitPayload { duration?: number; selector?: string; timeout?: number; }
interface ScreenshotPayload { format?: 'png' | 'jpeg'; quality?: number; clip?: { x: number; y: number; width: number; height: number }; }

interface WorkflowExecutionParams {
  [key: string]: string | number | boolean;
}

interface WorkflowExecutionRequest {
  workflowId: string;
  params?: WorkflowExecutionParams;
}

interface WorkflowExecutionStatus {
  workflowId: string;
  status: 'started' | 'step_completed' | 'completed' | 'error';
  currentStep?: number;
  totalSteps?: number;
  stepAction?: string;
  message?: string; // Error message or completion message
  result?: any; // Optional final result from the workflow
}
```

**9. UI/UX Considerations**

*   **Browser View:** Integrate seamlessly, perhaps as a main panel or a dedicated tab. Include standard controls (Back, Forward, Reload, URL Bar, Stop).
*   **Agent Activity Indicator:** Clearly show when the *agent* is interacting with the browser (e.g., border highlight, status message).
*   **Workflow Recording:**
    *   Clear Record/Stop buttons.
    *   Visual indicator that recording is active.
    *   Modal or panel to name, describe, and potentially define parameters after stopping.
    *   A dedicated "Workflows" or "Skills" section in the UI to list, manage, and run saved workflows.
*   **Workflow Execution:**
    *   Clear indication that a workflow is running.
    *   Display current step and overall progress.
    *   Provide a way to cancel execution.
    *   Show success or error messages clearly upon completion.
    *   Mechanism to provide parameters when a workflow is run.

**10. Security Considerations**

*   **Sandboxing:** Use `BrowserView` with appropriate sandbox settings if possible, although interaction needs might require relaxing some defaults. Carefully consider `nodeIntegration` and `contextIsolation`. `contextIsolation: true` with a `preload` script and `contextBridge` is highly recommended.
*   **URL Validation:** The Main process should validate URLs received via IPC before navigating the `BrowserView`, preventing navigation to potentially malicious `file://` or `javascript:` URLs sent by a compromised backend or LLM hallucination.
*   **Script Injection:** Be extremely cautious when using `executeJavaScript`. Sanitize any user/LLM-provided input used in scripts. The `preload` script provides a safer interface than direct execution from Main.
*   **Workflow Security:**
    *   **Sensitive Data:** Workflows involving logins or sensitive data entry need special care. Avoid storing credentials directly in the workflow JSON/DB. Prompt the user for credentials at runtime or use secure credential management. Consider redacting sensitive fields during recording observation.
    *   **Execution Permissions:** Consider adding user confirmation before executing workflows, especially those performing critical actions (posting, deleting, purchasing).
*   **Cross-Site Scripting (XSS) in BrowserView:** While `BrowserView` is generally safer than `webview`, standard web security practices apply to the loaded content.
*   **IPC Security:** Ensure IPC channels are properly scoped and validated to prevent unintended access between processes.

**11. Future Enhancements**

*   **Visual Workflow Editor:** Allow users to edit recorded steps, add waits, or modify selectors graphically.
*   **Advanced Error Handling:** More sophisticated error recovery during workflow execution (e.g., trying alternative selectors, asking LLM for help).
*   **Robust Element Selection:** Implement more resilient methods for identifying elements during recording and playback (beyond simple CSS/XPath).
*   **Workflow Sharing/Import/Export.**
*   **Conditional Logic in Workflows.**
*   **Integration with other tools:** Allow workflows to call other MCP tools or system scripts.

**12. Documentation**

*   **User Guide:** Explain how to use collaborative browsing, record workflows, manage them, and execute them. Include security warnings.
*   **Developer Guide:** Document the IPC APIs, data structures, workflow storage format, and how to extend the system (e.g., add new captured action types).


---

This spec provides a comprehensive blueprint. Implementation will require careful handling of asynchronous operations, state management across processes, robust error handling, and continuous attention to security. Start with the collaborative browsing basics, then layer in recording, and finally tackle the complexities of reliable execution and parameterization.


Implementation draft:

Okay, let's draft an implementation for the collaborative browsing and workflow recording features. This will involve creating new modules and modifying existing ones.

**Assumptions:**

1.  **Project Structure:** Follows the structure implied by the `repomix-output.txt` (Electron Main/Preload, React Renderer `src/`, Backend `services/`).
2.  **IPC Mechanism:** Uses standard Electron `ipcMain`/`ipcRenderer` for communication between Main and Renderer. Assumes a mechanism (e.g., another IPC channel, standard Node IPC, or potentially a simple local HTTP server if the backend is fully separate) exists for Main <-> Backend communication. For this draft, we'll use conceptual IPC calls for Main <-> Backend.
3.  **BrowserView Management:** The Main process is responsible for creating, attaching, and managing the `BrowserView`.
4.  **UI Framework:** React with Jotai for state management in the Renderer.
5.  **Backend Logic:** The core LLM interaction and decision-making logic reside in the `services/` directory.
6.  **Storage:** Workflow data will be stored in a simple JSON file in the user data directory for this draft (e.g., `userDataPath/workflows.json`). Database integration is a potential enhancement.
7.  **Element Selection:** Uses basic CSS selectors for identifying elements during recording/playback. Robustness is a future enhancement.
8.  **Security:** This draft focuses on functionality. Production implementation requires thorough security review (input sanitization, IPC validation, permissions).
9.  **Error Handling:** Basic error handling is included, but comprehensive error management and recovery are simplified.

---

**Draft Implementation**

**1. Electron Main Process (`electron/main/`)**

**1.1. New File: `electron/main/browserManager.ts`**

```typescript
import { BrowserWindow, BrowserView, ipcMain, Rectangle, screen } from 'electron';
import path from 'node:path';
import logger from '@services/utils/logger'; // Assuming logger setup

let browserView: BrowserView | null = null;
let mainWindow: BrowserWindow | null = null;
let currentBounds: Rectangle | null = null;
let isAttached = false;

// Preload script path
const browserPreloadPath = path.join(__dirname, '../preload/browser.js'); // Adjust path as needed

/**
 * Initializes the BrowserView manager.
 * @param win The main application window.
 */
export function initializeBrowserManager(win: BrowserWindow) {
  mainWindow = win;
  logger.info('Browser Manager Initialized');

  // Listen for resize/move events to reposition BrowserView
  mainWindow.on('resize', debounceReposition);
  mainWindow.on('move', debounceReposition);

  // Setup IPC handlers from Renderer/Backend
  setupBrowserIpcHandlers();
}

/**
 * Creates and configures the BrowserView instance.
 */
function createBrowserView() {
  if (!mainWindow) return;

  browserView = new BrowserView({
    webPreferences: {
      preload: browserPreloadPath,
      contextIsolation: true, // Recommended for security
      sandbox: false, // Often needed for preload interaction, review carefully
      devTools: process.env.NODE_ENV === 'development', // Enable DevTools in dev
    },
  });

  // Optional: Set background color
  browserView.setBackgroundColor('#ffffff');

  // Optional: Load initial page or leave blank
  // browserView.webContents.loadURL('about:blank');

  // Optional: Open DevTools in dev mode
  if (process.env.NODE_ENV === 'development') {
    // browserView.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle events from BrowserView's webContents
  browserView.webContents.on('did-navigate', (_, url) => {
    logger.debug(`BrowserView navigated to: ${url}`);
    sendBrowserEvent('navigated', { url, title: browserView?.webContents.getTitle() });
  });

  browserView.webContents.on('did-finish-load', () => {
    logger.debug('BrowserView finished loading');
    sendBrowserEvent('loaded', { url: browserView?.webContents.getURL() });
    // Inject CSS for highlighting agent actions if needed
    // browserView.webContents.insertCSS('... some CSS ...');
  });

  browserView.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    logger.error(`BrowserView failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    sendBrowserEvent('load_error', { url: validatedURL, error: errorDescription });
  });

  logger.info('BrowserView created');
}

/**
 * Attaches the BrowserView to the main window.
 * @param bounds The area within the main window to display the BrowserView.
 */
export function attachBrowserView(bounds: Rectangle) {
  if (!mainWindow || !browserView || isAttached) return;
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
    logger.warn('Invalid bounds provided for attaching BrowserView:', bounds);
    return;
  }

  currentBounds = bounds;
  mainWindow.addBrowserView(browserView);
  browserView.setBounds(bounds);
  browserView.setAutoResize({ width: true, height: true }); // Adjust as needed
  isAttached = true;
  logger.info('BrowserView attached with bounds:', bounds);
}

/**
 * Detaches the BrowserView from the main window.
 */
export function detachBrowserView() {
  if (!mainWindow || !browserView || !isAttached) return;
  mainWindow.removeBrowserView(browserView);
  isAttached = false;
  currentBounds = null;
  logger.info('BrowserView detached');
}

/**
 * Destroys the BrowserView instance.
 */
export function destroyBrowserView() {
  detachBrowserView(); // Ensure detached first
  // Electron handles destroying the BrowserView object itself when mainWindow closes
  // Or manually if needed: browserView?.webContents?.destroy();
  browserView = null;
  logger.info('BrowserView marked for destruction');
}

/**
 * Repositions the BrowserView based on stored bounds.
 */
function repositionBrowserView() {
  if (browserView && currentBounds && isAttached) {
    // Potentially get updated bounds from the Renderer if layout changed dynamically
    // For now, just re-apply the last known bounds
    try {
      browserView.setBounds(currentBounds);
    } catch (e) {
      logger.error("Error repositioning BrowserView:", e);
      // Potentially detach or handle error
    }
  }
}

// Debounce repositioning to avoid excessive calls during resize/move
let repositionTimeout: NodeJS.Timeout | null = null;
function debounceReposition() {
  if (repositionTimeout) clearTimeout(repositionTimeout);
  repositionTimeout = setTimeout(repositionBrowserView, 100); // 100ms debounce
}

// --- Browser Control Functions ---

async function navigate(url: string) {
  if (!browserView) createBrowserView();
  if (!browserView) return; // Guard if creation failed
  try {
    // Basic URL validation
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Invalid protocol: ${parsedUrl.protocol}`);
    }
    await browserView.webContents.loadURL(url);
    logger.info(`BrowserView navigating to: ${url}`);
  } catch (e) {
    logger.error(`Invalid URL or navigation error for ${url}:`, e);
    sendBrowserEvent('error', { message: `Navigation failed: ${e}` });
  }
}

async function executeScriptInView(script: string): Promise<any> {
  if (!browserView || !isAttached) {
    logger.warn('BrowserView not available for script execution');
    return Promise.reject('BrowserView not ready');
  }
  try {
    // console.log("Executing script:", script); // Debugging
    const result = await browserView.webContents.executeJavaScript(script, true); // User gesture = true
    // console.log("Script result:", result); // Debugging
    return result;
  } catch (error) {
    logger.error('Error executing script in BrowserView:', error);
    throw error; // Re-throw to be handled by caller
  }
}

async function clickElement(selector: string) {
  logger.debug(`Attempting click on selector: ${selector}`);
  const script = `
    (() => {
      try {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (element) {
          // Optional: Visual feedback
          element.style.outline = '2px solid red';
          setTimeout(() => { element.style.outline = ''; }, 500);
          element.click();
          return { success: true };
        } else {
          return { success: false, error: 'Element not found' };
        }
      } catch (e) {
        return { success: false, error: e.message };
      }
    })();
  `;
  return await executeScriptInView(script);
}

async function typeText(selector: string, text: string, options?: { delay?: number }) {
  logger.debug(`Attempting to type in selector: ${selector}`);
  // Note: Simulating typing with delay is complex with executeJavaScript.
  // A simpler approach sets the value directly. True typing simulation often needs CDP.
  const script = `
    (() => {
      try {
        const element = document.querySelector(${JSON.stringify(selector)});
        if (element) {
          if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            // Optional: Visual feedback
            element.style.outline = '2px solid blue';
            setTimeout(() => { element.style.outline = ''; }, 500);
            // Simulate focus and value setting
            element.focus();
            element.value = ${JSON.stringify(text)};
            // Trigger input/change events which frameworks might listen for
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            element.blur(); // Optional: remove focus
            return { success: true };
          } else {
            return { success: false, error: 'Element is not an input or textarea' };
          }
        } else {
          return { success: false, error: 'Element not found' };
        }
      } catch (e) {
        return { success: false, error: e.message };
      }
    })();
  `;
  return await executeScriptInView(script);
}

async function scrollPage(x?: number, y?: number, selector?: string) {
  logger.debug(`Attempting scroll: x=${x}, y=${y}, selector=${selector}`);
  let script: string;
  if (selector) {
    script = `
      (() => {
        try {
          const element = document.querySelector(${JSON.stringify(selector)});
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            return { success: true };
          } else {
            return { success: false, error: 'Element not found for scrolling' };
          }
        } catch (e) {
          return { success: false, error: e.message };
        }
      })();
    `;
  } else {
    script = `window.scrollBy(${x || 0}, ${y || 0}); return { success: true };`;
  }
  return await executeScriptInView(script);
}

async function getContent(type: 'html' | 'text' | 'screenshot', options?: any): Promise<string | Buffer | null> {
  if (!browserView || !isAttached) {
    logger.warn('BrowserView not available for getContent');
    return null;
  }
  logger.debug(`Getting content, type: ${type}`);
  try {
    if (type === 'screenshot') {
      const image = await browserView.webContents.capturePage(options);
      return image.toPNG(); // Or .toJPEG()
    } else if (type === 'text') {
      const script = 'document.body.innerText;';
      return await executeScriptInView(script);
    } else if (type === 'html') {
      const script = 'document.documentElement.outerHTML;';
      return await executeScriptInView(script);
    }
    return null;
  } catch (error) {
    logger.error(`Error getting content (type: ${type}):`, error);
    return null;
  }
}

function goBack() {
  if (browserView?.webContents.canGoBack()) {
    browserView.webContents.goBack();
  }
}

function goForward() {
  if (browserView?.webContents.canGoForward()) {
    browserView.webContents.goForward();
  }
}

function reload() {
  browserView?.webContents.reload();
}

// --- IPC Handling ---

function setupBrowserIpcHandlers() {
  // Commands from Backend/Agent
  ipcMain.handle('BROWSER_COMMAND', async (_, args: { command: string; payload: any }) => {
    logger.info(`Received BROWSER_COMMAND: ${args.command}`);
    if (!browserView && args.command !== 'navigate') {
      logger.warn('BrowserView not initialized, cannot execute command:', args.command);
      return { success: false, error: 'Browser not ready' };
    }
    try {
      switch (args.command) {
        case 'navigate':
          await navigate(args.payload.url);
          return { success: true };
        case 'click':
          return await clickElement(args.payload.selector);
        case 'type':
          return await typeText(args.payload.selector, args.payload.text, args.payload.options);
        case 'scroll':
          return await scrollPage(args.payload.x, args.payload.y, args.payload.selector);
        case 'get_content':
          const content = await getContent(args.payload.type, args.payload.options);
          if (content) {
            // Send content back to the requesting process (presumably Backend)
            // How this is done depends on Main<->Backend communication.
            // Example: mainWindow?.webContents.send('BROWSER_CONTENT_RESPONSE', { type: args.payload.type, data: content instanceof Buffer ? content.toString('base64') : content });
            sendToBackend('BROWSER_CONTENT_RESPONSE', { type: args.payload.type, data: content instanceof Buffer ? content.toString('base64') : content });
            return { success: true };
          } else {
            return { success: false, error: 'Failed to get content' };
          }
        case 'back':
          goBack();
          return { success: true };
        case 'forward':
          goForward();
          return { success: true };
        case 'reload':
          reload();
          return { success: true };
        default:
          logger.warn(`Unknown BROWSER_COMMAND: ${args.command}`);
          return { success: false, error: 'Unknown command' };
      }
    } catch (error: any) {
      logger.error(`Error executing BROWSER_COMMAND ${args.command}:`, error);
      return { success: false, error: error.message || 'Execution failed' };
    }
  });

  // User actions from Renderer
  ipcMain.on('BROWSER_USER_NAVIGATE', (_, url: string) => {
    logger.info(`User navigating to: ${url}`);
    navigate(url);
  });
  ipcMain.on('BROWSER_USER_ACTION', (_, action: 'back' | 'forward' | 'reload') => {
    logger.info(`User action: ${action}`);
    if (action === 'back') goBack();
    else if (action === 'forward') goForward();
    else if (action === 'reload') reload();
  });

  // Positioning command from Renderer
  ipcMain.on('BROWSER_SET_BOUNDS', (_, bounds: Rectangle) => {
    logger.debug('Received BROWSER_SET_BOUNDS:', bounds);
    if (isAttached) {
        currentBounds = bounds;
        repositionBrowserView();
    } else {
        // If not attached, assume this is the initial attachment request
        if (!browserView) createBrowserView();
        if (browserView) {
            attachBrowserView(bounds);
            // Attempt to load a default URL if none loaded yet
            if (browserView.webContents.getURL() === 'about:blank' || !browserView.webContents.getURL()) {
                navigate('https://sou.ls'); // Or a user's homepage setting
            }
        }
    }
  });

  // Visibility command from Renderer
  ipcMain.on('BROWSER_SET_VISIBILITY', (_, visible: boolean) => {
      logger.info(`Setting BrowserView visibility: ${visible}`);
      if (visible && !isAttached && currentBounds) {
          // Re-attach if becoming visible and we have bounds
          attachBrowserView(currentBounds);
      } else if (!visible && isAttached) {
          detachBrowserView();
      }
      // Note: BrowserView itself doesn't have a 'hide' method like BrowserWindow.
      // Visibility is controlled by attaching/detaching or setting bounds to zero size.
  });
}

/** Helper to send events to Renderer and Backend */
function sendBrowserEvent(event: string, payload: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('BROWSER_EVENT', { event, payload });
  }
  // Send to Backend Service (replace with actual mechanism)
  sendToBackend('BROWSER_EVENT', { event, payload });
}

/** Placeholder for Main -> Backend communication */
function sendToBackend(channel: string, data: any) {
  logger.debug(`Sending to Backend - Channel: ${channel}, Data: ${JSON.stringify(data).substring(0, 100)}...`);
  // Example: Use webContents.send if backend is another renderer process
  // Or use process.send if it's a child process
  // Or make an HTTP request if it's a separate server
  // For now, just log it. The actual implementation depends on how the backend is run.
  // If integrated into the main process or a worker thread, could be direct calls.
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Example assuming backend listens on the main window's webContents (less common)
    // mainWindow.webContents.send(channel, data);

    // More likely: Send via a dedicated backend IPC channel if backend is Electron utility process or similar
    // e.g., ipcMain.emit('send-to-backend', channel, data); // Needs a listener elsewhere
  }
}
```

**1.2. New File: `electron/main/workflowManager.ts`**

```typescript
import { ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import logger from '@services/utils/logger';
import { v4 as uuidv4 } from 'uuid'; // Assuming uuid is installed

// Interfaces (should match spec/shared types)
interface WorkflowStep {
  action: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot' | 'get_content';
  payload: any;
  timestamp: number;
  paramName?: string;
}

interface Workflow {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  steps: WorkflowStep[];
  parameters?: { [key: string]: { description: string; type: 'string' | 'number' } };
}

let isRecording = false;
let currentWorkflow: Workflow | null = null;
const workflows: { [id: string]: Workflow } = {}; // In-memory store for simplicity
const workflowsFilePath = path.join(app.getPath('userData'), 'workflows.json');

/**
 * Initializes the Workflow Manager, loads saved workflows.
 */
export async function initializeWorkflowManager() {
  await loadWorkflowsFromFile();
  setupWorkflowIpcHandlers();
  logger.info('Workflow Manager Initialized');
}

async function loadWorkflowsFromFile() {
  try {
    const data = await fs.readFile(workflowsFilePath, 'utf-8');
    const loadedWorkflows = JSON.parse(data);
    Object.assign(workflows, loadedWorkflows); // Load into memory
    logger.info(`Loaded ${Object.keys(workflows).length} workflows from file.`);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.info('Workflows file not found, starting fresh.');
    } else {
      logger.error('Error loading workflows:', error);
    }
  }
}

async function saveWorkflowsToFile() {
  try {
    await fs.writeFile(workflowsFilePath, JSON.stringify(workflows, null, 2), 'utf-8');
    logger.info(`Saved ${Object.keys(workflows).length} workflows to file.`);
  } catch (error) {
    logger.error('Error saving workflows:', error);
  }
}

function startRecording() {
  if (isRecording) {
    logger.warn('Recording already in progress.');
    return;
  }
  currentWorkflow = {
    id: uuidv4(),
    name: `Workflow ${new Date().toLocaleString()}`, // Default name
    createdAt: Date.now(),
    steps: [],
  };
  isRecording = true;
  logger.info(`Workflow recording started: ${currentWorkflow.id}`);
  // Notify Renderer UI
  sendWorkflowStatusUpdate('recording_started');
  // Tell preload script to start listening for interactions
  sendToBrowserViewPreload('SET_RECORDING_STATE', true);
}

function stopRecording() {
  if (!isRecording) {
    logger.warn('No recording in progress to stop.');
    return;
  }
  isRecording = false;
  logger.info(`Workflow recording stopped: ${currentWorkflow?.id}`);
  // Notify Renderer UI
  sendWorkflowStatusUpdate('recording_stopped', { workflow: currentWorkflow });
   // Tell preload script to stop listening
   sendToBrowserViewPreload('SET_RECORDING_STATE', false);
  // Reset currentWorkflow *after* potentially saving it
  // currentWorkflow = null; // Keep it until saved or discarded
}

function addWorkflowStep(step: Omit<WorkflowStep, 'timestamp'>) {
  if (!isRecording || !currentWorkflow) return;
  const fullStep: WorkflowStep = { ...step, timestamp: Date.now() };
  currentWorkflow.steps.push(fullStep);
  logger.debug(`Workflow step added: ${fullStep.action}`, fullStep.payload);
  // Optionally send step to UI for visualization
  // sendWorkflowStatusUpdate('step_added', { step: fullStep });
}

async function saveWorkflow(name: string, description?: string, parameters?: any) {
  if (!currentWorkflow) {
    logger.error('No workflow data to save.');
    return { success: false, error: 'No workflow data' };
  }
  currentWorkflow.name = name || currentWorkflow.name;
  currentWorkflow.description = description;
  currentWorkflow.parameters = parameters || {}; // Add parameter handling

  workflows[currentWorkflow.id] = currentWorkflow;
  await saveWorkflowsToFile();
  logger.info(`Workflow saved: ${currentWorkflow.name} (${currentWorkflow.id})`);
  const savedWorkflow = currentWorkflow;
  currentWorkflow = null; // Clear after saving
  sendWorkflowStatusUpdate('workflow_saved', { workflow: savedWorkflow });
  return { success: true, workflow: savedWorkflow };
}

async function executeWorkflow(workflowId: string, params?: { [key: string]: any }) {
    const workflow = workflows[workflowId];
    if (!workflow) {
        logger.error(`Workflow not found: ${workflowId}`);
        sendWorkflowExecutionStatus(workflowId, 'error', { message: 'Workflow not found' });
        return;
    }

    logger.info(`Executing workflow: ${workflow.name} (${workflowId})`);
    sendWorkflowExecutionStatus(workflowId, 'started', { totalSteps: workflow.steps.length });

    // Basic parameter substitution (replace with more robust logic)
    const substituteParams = (payload: any): any => {
        if (!params || typeof payload !== 'string') return payload;
        let substitutedPayload = payload;
        for (const key in params) {
            const placeholder = `{${key}}`; // Assuming simple {paramName} format
            if (substitutedPayload.includes(placeholder)) {
                substitutedPayload = substitutedPayload.replaceAll(placeholder, String(params[key]));
            }
        }
        return substitutedPayload;
    };

    for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        logger.debug(`Executing step ${i + 1}/${workflow.steps.length}: ${step.action}`);
        sendWorkflowExecutionStatus(workflowId, 'step_started', { currentStep: i + 1, stepAction: step.action });

        try {
            let commandPayload = step.payload;
            // Substitute parameters in payload values (needs more robust handling for complex objects)
            if (typeof commandPayload === 'object' && commandPayload !== null) {
                commandPayload = { ...commandPayload }; // Clone
                for (const key in commandPayload) {
                    if (typeof commandPayload[key] === 'string') {
                         // Simple substitution for URLs, selectors, text values
                         commandPayload[key] = substituteParams(commandPayload[key]);
                    }
                }
            } else if (typeof commandPayload === 'string') {
                commandPayload = substituteParams(commandPayload);
            }

            // Introduce waits or checks based on step type
            if (step.action === 'wait') {
                if (step.payload.duration) {
                    await new Promise(resolve => setTimeout(resolve, step.payload.duration));
                } else if (step.payload.selectorToWaitFor) {
                    // TODO: Implement polling check for element existence via executeJavaScript
                    logger.warn('Wait for selector not implemented yet.');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Placeholder wait
                }
            } else {
                 // Send command to browserManager via IPC
                const result = await ipcMain.invoke('BROWSER_COMMAND', { command: step.action, payload: commandPayload });
                if (!result || !result.success) {
                    throw new Error(result?.error || `Step action '${step.action}' failed`);
                }
                 // Add small delay between actions to mimic human interaction / allow page rendering
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
            }

            sendWorkflowExecutionStatus(workflowId, 'step_completed', { currentStep: i + 1 });
        } catch (error: any) {
            logger.error(`Error executing step ${i + 1} (${step.action}) of workflow ${workflowId}:`, error);
            sendWorkflowExecutionStatus(workflowId, 'error', { message: `Step ${i + 1} failed: ${error.message}` });
            return; // Stop execution on error
        }
    }

    logger.info(`Workflow execution completed: ${workflow.name} (${workflowId})`);
    sendWorkflowExecutionStatus(workflowId, 'completed');
}


function setupWorkflowIpcHandlers() {
  ipcMain.on('WORKFLOW_START_RECORDING', () => startRecording());
  ipcMain.on('WORKFLOW_STOP_RECORDING', () => stopRecording());

  // Listen for actions captured by the preload script
  ipcMain.on('WORKFLOW_ACTION_CAPTURED', (_, stepData: Omit<WorkflowStep, 'timestamp'>) => {
    if (isRecording) {
      addWorkflowStep(stepData);
    }
  });

  // Handle save request from Renderer (passing name, description, params)
  ipcMain.handle('WORKFLOW_SAVE', async (_, data: { name: string; description?: string; parameters?: any }) => {
    return await saveWorkflow(data.name, data.description, data.parameters);
  });

  // Handle execution request from Renderer or Backend
  ipcMain.on('WORKFLOW_EXECUTE_REQUEST', (_, request: { workflowId: string; params?: { [key: string]: any } }) => {
    executeWorkflow(request.workflowId, request.params);
  });

   // Handle request for workflow list
   ipcMain.handle('WORKFLOW_LIST_REQUEST', () => {
      return Object.values(workflows); // Return array of workflows
  });
}

/** Helper to send status updates to Renderer and Backend */
function sendWorkflowStatusUpdate(status: string, data?: any) {
    const payload = { status, ...data };
    // Send to Renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('WORKFLOW_STATUS_UPDATE', payload);
    }
    // Send to Backend (replace with actual mechanism)
    sendToBackend('WORKFLOW_STATUS_UPDATE', payload);
}

/** Helper to send execution status updates */
function sendWorkflowExecutionStatus(workflowId: string, status: string, data?: any) {
    const payload = { workflowId, status, ...data };
     // Send to Renderer
     if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('WORKFLOW_EXECUTION_STATUS', payload);
    }
    // Send to Backend (replace with actual mechanism)
    sendToBackend('WORKFLOW_EXECUTION_STATUS', payload);
}

/** Placeholder for Main -> Backend communication */
function sendToBackend(channel: string, data: any) {
    logger.debug(`Sending to Backend - Channel: ${channel}, Data: ${JSON.stringify(data).substring(0, 100)}...`);
    // Actual implementation depends on Main <-> Backend communication method
}

/** Placeholder: Send message to BrowserView preload script */
function sendToBrowserViewPreload(channel: string, ...args: any[]) {
    if (browserView && !browserView.webContents.isDestroyed()) {
        browserView.webContents.send(channel, ...args);
    }
}
```

**1.3. Modifications to `electron/main/index.ts`**

```typescript
// ... other imports
import { app, BrowserWindow, ipcMain /*, BrowserView <- remove if managed elsewhere */ } from 'electron';
import { initializeBrowserManager, attachBrowserView, destroyBrowserView } from './browserManager'; // Import browser manager
import { initializeWorkflowManager } from './workflowManager'; // Import workflow manager

// ... existing code ...

let win: BrowserWindow | null = null;
// let browserView: BrowserView | null = null; // Managed by browserManager now

async function createWindow() {
  win = new BrowserWindow({
    // ... existing window options ...
    webPreferences: {
      // ... existing webPreferences ...
      preload, // Your main preload
      // sandbox: false, // Consider security implications
      // contextIsolation: true, // Recommended
    },
  });

  // ... existing window setup (loading URL, etc.) ...

  // Initialize Managers *after* window is created
  initializeBrowserManager(win);
  await initializeWorkflowManager(); // Load workflows

  // Example: Attach BrowserView when a specific route is hit or component mounts
  // This might be better triggered from the Renderer via IPC ('BROWSER_READY_TO_ATTACH')
  // For simplicity here, we might attach it initially if needed, but ideally delay it.
  // attachBrowserView({ x: 300, y: 50, width: 800, height: 600 }); // Example bounds

  // Make all links open with the browser, not with the application (Good practice)
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) shell.openExternal(url);
    return { action: 'deny' };
  });

  // ... existing event handlers (close, etc.) ...

  // Clean up BrowserView on quit
  app.on('before-quit', async () => {
      logger.info('App closing, destroying BrowserView...');
      destroyBrowserView(); // Clean up the browser view explicitly
      AppState.setIsQuitting(true); // Assuming AppState exists
      // Any other cleanup
  });
}

// ... existing app event listeners (whenReady, activate, etc.) ...

// --- Setup Core IPC Handlers ---
// These handlers act as routers between Renderer/Backend and the managers

// Example: Route Backend command to browserManager
ipcMain.handle('backend-browser-command', async (_, args) => {
  // TODO: Add authentication/authorization if backend is separate process
  return await ipcMain.invoke('BROWSER_COMMAND', _, args);
});

// Example: Route Backend request to workflowManager
ipcMain.on('backend-workflow-request', (_, args) => {
   // TODO: Add authentication/authorization
   ipcMain.emit('WORKFLOW_EXECUTE_REQUEST', _, args);
});

// Example: Forward Browser Events from browserManager to Backend
// (Needs a listener in browserManager sending via a dedicated channel like 'send-to-backend')
ipcMain.on('send-to-backend', (event, channel, data) => {
    // TODO: Implement actual sending mechanism to backend process/thread
    logger.debug(`Relaying to Backend - Channel: ${channel}, Data: ${JSON.stringify(data).substring(0,100)}...`);
});

// Example: Forward Workflow Status from workflowManager to Backend
ipcMain.on('send-workflow-status-to-backend', (event, payload) => {
    // TODO: Implement actual sending mechanism
    logger.debug(`Relaying WF Status to Backend: ${payload.status}`);
});


// Ensure managers are initialized when the app is ready
app.whenReady().then(() => {
  // ... other readiness tasks ...
  // Initialize managers after main window setup if they depend on it
});

```

**2. BrowserView Preload Script (`electron/preload/browser.ts`)**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

// --- Action Capture (for Workflow Recording) ---
let isRecordingEnabled = false;

function getCssSelector(el: Element): string {
  if (!(el instanceof Element)) return '';
  let path: string[] = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.id) {
      selector += '#' + el.id;
      path.unshift(selector);
      break; // ID is unique enough
    } else {
      let sib: Element | null = el;
      let nth: number = 1;
      while ((sib = sib.previousElementSibling)) {
        if (sib.nodeName.toLowerCase() === selector) nth++;
      }
      if (nth != 1) selector += `:nth-of-type(${nth})`;
    }
    path.unshift(selector);
    el = el.parentNode as Element; // Move up
  }
  return path.join(' > ');
}

function captureAction(action: string, payload: any) {
  if (!isRecordingEnabled) return;
  console.log('Capturing action:', action, payload); // Debugging
  ipcRenderer.send('WORKFLOW_ACTION_CAPTURED', { action, payload });
}

function setupActionListeners() {
  document.addEventListener('click', (e) => {
    if (isRecordingEnabled && e.target instanceof Element) {
      captureAction('click', { selector: getCssSelector(e.target) });
    }
  }, true); // Use capture phase

  document.addEventListener('change', (e) => {
     if (isRecordingEnabled && (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
       captureAction('type', { selector: getCssSelector(e.target), value: e.target.value });
     }
  }, true);

  // Add more listeners as needed (e.g., 'scroll' - debounced)
}

// --- Script Execution API (for Main Process) ---
contextBridge.exposeInMainWorld('electronBrowserView', {
  // Allows Main process to call functions here
  execute: (script: string) => {
    try {
      // Be very careful with eval-like functions in production
      // Prefer specific, safer functions if possible
      // eslint-disable-next-line no-eval
      return eval(script);
    } catch (error: any) {
      console.error('Error executing script from main:', error);
      return { error: error.message };
    }
  },
  // Example of a safer, specific function
  getElementText: (selector: string) => {
    const element = document.querySelector(selector);
    return element ? element.innerText : null;
  },
  // Add functions for click, type, scroll etc. for better control and security
  clickElement: (selector: string) => {
     const element = document.querySelector(selector) as HTMLElement;
     if (element) {
         element.click();
         return true;
     }
     return false;
  },
  typeInElement: (selector: string, text: string) => {
      const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
      if (element) {
          element.focus();
          element.value = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
          element.blur();
          return true;
      }
      return false;
  },
});

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
  console.log('BrowserView Preload Script Loaded');
  setupActionListeners();

  // Listen for recording state changes from Main
  ipcRenderer.on('SET_RECORDING_STATE', (_, enabled: boolean) => {
    console.log(`Setting recording state: ${enabled}`);
    isRecordingEnabled = enabled;
  });

  // Notify Main that preload is ready (optional)
  // ipcRenderer.send('PRELOAD_READY');
});

// Send navigation events back to Main (via invoke for potential response)
// Note: These are standard web events, Main process captures 'did-navigate' etc. better.
// window.addEventListener('popstate', () => {
//   ipcRenderer.invoke('BROWSER_EVENT', { event: 'navigated', payload: { url: window.location.href, title: document.title } });
// });
// Consider using MutationObserver for more fine-grained DOM change detection if needed.
```

**3. Renderer Process (`src/`)**

**3.1. New Component: `src/views/Browser.tsx`**

```typescript
import React, { useEffect, useRef, useState, KeyboardEvent } from 'react';
import WorkflowControls from '@components/WorkflowControls'; // Assuming this component exists
import logger from '@services/utils/logger'; // Adjust path if needed

const Browser: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentUrl, setCurrentUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  // Function to inform main process about the desired bounds
  const updateBrowserViewBounds = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scaleFactor = window.devicePixelRatio; // Consider HiDPI displays

      // Convert client rect relative to window top-left to screen coordinates
      // Note: This relies on the main window not being moved. A more robust
      // solution might involve getting window position from main process.
      // For simplicity, we assume (0,0) offset for now, adjust if needed.
      const screenRect = {
        x: Math.round(rect.left * scaleFactor),
        y: Math.round(rect.top * scaleFactor),
        width: Math.round(rect.width * scaleFactor),
        height: Math.round(rect.height * scaleFactor),
      };

      // Adjust y based on header height if your layout has one
      // screenRect.y += HEADER_HEIGHT * scaleFactor;

      logger.debug('Sending BROWSER_SET_BOUNDS:', screenRect);
      window.electron.ipcRenderer.send('BROWSER_SET_BOUNDS', screenRect);
    }
  };

  useEffect(() => {
    // Initial positioning and setup
    updateBrowserViewBounds();
    window.electron.ipcRenderer.send('BROWSER_SET_VISIBILITY', true); // Make sure it's visible

    // Setup resize observer or listen to window resize
    const resizeObserver = new ResizeObserver(updateBrowserViewBounds);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Listen for events from Main process
    const handleBrowserEvent = (_event: any, data: { event: string; payload: any }) => {
      logger.debug('Received BROWSER_EVENT from Main:', data);
      switch (data.event) {
        case 'navigated':
          setCurrentUrl(data.payload.url);
          if (urlInputRef.current) urlInputRef.current.value = data.payload.url;
          setIsLoading(false);
          // Update canGoBack/Forward state (requires main process support)
          // setCanGoBack(data.payload.canGoBack);
          // setCanGoForward(data.payload.canGoForward);
          break;
        case 'load_started':
          setIsLoading(true);
          break;
        case 'loaded':
        case 'load_error':
          setIsLoading(false);
          break;
      }
    };
    window.electron.ipcRenderer.on('BROWSER_EVENT', handleBrowserEvent);

    // Cleanup on unmount
    return () => {
      resizeObserver.disconnect();
      window.electron.ipcRenderer.off('BROWSER_EVENT', handleBrowserEvent);
      // Inform main process to hide/detach the view when component unmounts
      window.electron.ipcRenderer.send('BROWSER_SET_VISIBILITY', false);
    };
  }, []);

  const handleUrlSubmit = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      let url = e.currentTarget.value.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }
      window.electron.ipcRenderer.send('BROWSER_USER_NAVIGATE', url);
      e.currentTarget.value = url; // Update input field
      setCurrentUrl(url);
      setIsLoading(true);
    }
  };

  const handleNavAction = (action: 'back' | 'forward' | 'reload') => {
    window.electron.ipcRenderer.send('BROWSER_USER_ACTION', action);
    if (action === 'reload') setIsLoading(true);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Toolbar */}
      <div className="flex items-center p-2 bg-muted/50 border-b border-border flex-shrink-0">
        <button onClick={() => handleNavAction('back')} className="p-1 rounded hover:bg-muted" title="Back" disabled={!canGoBack}>{'<'}</button>
        <button onClick={() => handleNavAction('forward')} className="p-1 rounded hover:bg-muted" title="Forward" disabled={!canGoForward}>{'>'}</button>
        <button onClick={() => handleNavAction('reload')} className="p-1 rounded hover:bg-muted" title="Reload">{isLoading ? '...' : '↻'}</button>
        <input
          ref={urlInputRef}
          type="text"
          defaultValue={currentUrl}
          onKeyDown={handleUrlSubmit}
          placeholder="https://..."
          className="flex-1 mx-2 px-2 py-1 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <WorkflowControls /> {/* Add workflow controls here */}
      </div>

      {/* BrowserView Container - The actual view is managed by Electron Main */}
      <div ref={containerRef} className="flex-1 bg-muted/20 overflow-hidden relative">
        {/* Placeholder or loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            Loading...
          </div>
        )}
         {/* This div acts as the placeholder for the BrowserView */}
         <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-muted-foreground">
              Browser Content Area
         </div>
      </div>
    </div>
  );
};

export default Browser;
```

**3.2. New Component: `src/components/WorkflowControls.tsx`**

```typescript
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import logger from '@services/utils/logger'; // Adjust path

const WorkflowControls: React.FC = () => {
    const { t } = useTranslation();
    const [isRecording, setIsRecording] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [workflowName, setWorkflowName] = useState('');
    const [workflowDesc, setWorkflowDesc] = useState('');

    useEffect(() => {
        // Listen for status updates from Main
        const handleStatus = (_event: any, payload: any) => {
            logger.debug('Received WORKFLOW_STATUS_UPDATE in Renderer:', payload);
            if (payload.status === 'recording_started') {
                setIsRecording(true);
            } else if (payload.status === 'recording_stopped') {
                setIsRecording(false);
                // Optional: Automatically show save modal after stopping
                // setShowSaveModal(true);
            } else if (payload.status === 'workflow_saved') {
                 // Maybe show a toast notification
                 console.log('Workflow saved successfully:', payload.workflow);
            }
        };
        window.electron.ipcRenderer.on('WORKFLOW_STATUS_UPDATE', handleStatus);
        return () => {
            window.electron.ipcRenderer.off('WORKFLOW_STATUS_UPDATE', handleStatus);
        };
    }, []);

    const handleRecordClick = () => {
        logger.info('Start Recording button clicked');
        window.electron.ipcRenderer.send('WORKFLOW_START_RECORDING');
    };

    const handleStopClick = () => {
        logger.info('Stop Recording button clicked');
        window.electron.ipcRenderer.send('WORKFLOW_STOP_RECORDING');
        setShowSaveModal(true); // Show save modal after stopping
    };

    const handleSaveClick = async () => {
        logger.info('Save Workflow button clicked');
        if (!workflowName.trim()) {
            // Add validation feedback
            console.error("Workflow name is required");
            return;
        }
        const result = await window.electron.ipcRenderer.invoke('WORKFLOW_SAVE', {
            name: workflowName,
            description: workflowDesc,
            // parameters: {} // Add parameter definition UI later
        });
        if (result.success) {
            setShowSaveModal(false);
            setWorkflowName('');
            setWorkflowDesc('');
            // Add success feedback (e.g., toast)
        } else {
            // Add error feedback
            console.error("Failed to save workflow:", result.error);
        }
    };

    const handleCancelSave = () => {
        setShowSaveModal(false);
        setWorkflowName('');
        setWorkflowDesc('');
        // Optionally discard the recording
    };

    return (
        <div className="flex items-center space-x-2">
            {!isRecording ? (
                <button onClick={handleRecordClick} className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600" title="Start Recording">
                    Rec
                </button>
            ) : (
                <button onClick={handleStopClick} className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600" title="Stop Recording">
                    Stop
                </button>
            )}
            {/* Button to manage/run workflows - Future */}
            {/* <button className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" title="Manage Workflows">Flows</button> */}

            {/* Save Workflow Modal */}
            {showSaveModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-background p-6 rounded-lg shadow-xl w-96">
                        <h3 className="text-lg font-medium mb-4">Save Workflow</h3>
                        <input
                            type="text"
                            placeholder="Workflow Name"
                            value={workflowName}
                            onChange={(e) => setWorkflowName(e.target.value)}
                            className="w-full mb-3 px-3 py-2 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <textarea
                            placeholder="Description (optional)"
                            value={workflowDesc}
                            onChange={(e) => setWorkflowDesc(e.target.value)}
                            rows={3}
                            className="w-full mb-4 px-3 py-2 border border-input rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                        {/* Add Parameter Definition UI here later */}
                        <div className="flex justify-end space-x-2">
                            <button onClick={handleCancelSave} className="px-3 py-1 border rounded text-muted-foreground hover:bg-muted">Cancel</button>
                            <button onClick={handleSaveClick} className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WorkflowControls;
```

**4. Backend Service (`services/`)**

**4.1. New File: `services/agent/browserAgent.ts` (Conceptual)**

```typescript
// This is conceptual - assumes an IPC or similar mechanism to talk to Main process
import logger from '@services/utils/logger';

// Replace with actual mechanism (e.g., function exposed via Main process, IPC emitter)
function sendCommandToMain(command: string, payload: any) {
  logger.debug(`[Backend->Main] BROWSER_COMMAND: ${command}`, payload);
  // Example: if backend is run as a separate process with IPC:
  // process.send?.({ type: 'BROWSER_COMMAND', command, payload });
  // Or if using webContents IPC from Main:
  // global.mainIpcEmitter.send('backend-browser-command', { command, payload }); // Needs setup
}

// Replace with actual mechanism (e.g., event listener on process, or dedicated IPC channel)
function subscribeToBrowserEvents(handler: (eventData: any) => void) {
    logger.info('[Backend] Subscribing to browser events from Main');
    // Example: process.on('message', (msg) => { if(msg.type === 'BROWSER_EVENT') handler(msg.data); });
    // Or: global.mainIpcReceiver.on('BROWSER_EVENT', handler); // Needs setup
}

function subscribeToContentResponses(handler: (responseData: any) => void) {
    logger.info('[Backend] Subscribing to content responses from Main');
     // Example: process.on('message', (msg) => { if(msg.type === 'BROWSER_CONTENT_RESPONSE') handler(msg.data); });
    // Or: global.mainIpcReceiver.on('BROWSER_CONTENT_RESPONSE', handler);
}

export const browserAgent = {
  navigate: (url: string) => sendCommandToMain('navigate', { url }),
  click: (selector: string) => sendCommandToMain('click', { selector }),
  type: (selector: string, text: string) => sendCommandToMain('type', { selector, text }),
  scroll: (payload: { x?: number; y?: number; selector?: string }) => sendCommandToMain('scroll', payload),
  getContent: (type: 'html' | 'text' | 'screenshot') => sendCommandToMain('get_content', { type }),
  goBack: () => sendCommandToMain('back', {}),
  goForward: () => sendCommandToMain('forward', {}),
  reload: () => sendCommandToMain('reload', {}),

  // --- Event/Data Handling (conceptual listeners) ---
  onBrowserEvent: (handler: (data: { event: string; payload: any }) => void) => {
    subscribeToBrowserEvents(handler);
  },
  onContentResponse: (handler: (data: { type: string; data: any }) => void) => {
     subscribeToContentResponses(handler);
  },
};

// Example Usage within agent logic:
// browserAgent.navigate('https://google.com');
// browserAgent.onBrowserEvent(data => {
//   if (data.event === 'loaded') {
//     browserAgent.type('#searchQuery', 'Electron BrowserView');
//   }
// });
```

**4.2. New File: `services/agent/workflowAgent.ts` (Conceptual)**

```typescript
// Conceptual - depends on storage and Main<->Backend communication
import logger from '@services/utils/logger';
import fs from 'node:fs/promises'; // Assuming file storage for draft
import path from 'node:path';
import { app } from 'electron'; // Need app path, potentially move storage logic to Main

// Interfaces (reuse from workflowManager)
interface WorkflowStep { /* ... */ }
interface Workflow { /* ... */ }

const workflowsFilePath = path.join(app.getPath('userData'), 'workflows.json'); // Needs app path access

// Replace with actual IPC/communication mechanism
function sendRequestToMain(channel: string, payload: any) {
    logger.debug(`[Backend->Main] ${channel}`, payload);
    // process.send?.({ type: channel, ...payload });
    // global.mainIpcEmitter.send(channel, payload);
}

function subscribeToWorkflowStatus(handler: (statusData: any) => void) {
     logger.info('[Backend] Subscribing to workflow status from Main');
    // Example: process.on('message', (msg) => { if(msg.type === 'WORKFLOW_EXECUTION_STATUS') handler(msg.data); });
    // Or: global.mainIpcReceiver.on('WORKFLOW_EXECUTION_STATUS', handler);
}

// Placeholder for loading workflows - ideally Main process handles this
async function loadWorkflowsFromStorage(): Promise<{ [id: string]: Workflow }> {
     try {
         const data = await fs.readFile(workflowsFilePath, 'utf-8');
         return JSON.parse(data);
     } catch (error: any) {
         if (error.code === 'ENOENT') return {};
         logger.error('Error loading workflows in backend:', error);
         return {};
     }
}

export const workflowAgent = {
    listWorkflows: async (): Promise<Workflow[]> => {
        // In a real scenario, might send WORKFLOW_LIST_REQUEST to Main
        const workflows = await loadWorkflowsFromStorage();
        return Object.values(workflows);
    },

    executeWorkflow: (workflowId: string, params?: { [key: string]: any }): void => {
        sendRequestToMain('WORKFLOW_EXECUTE_REQUEST', { workflowId, params });
    },

    onWorkflowStatusUpdate: (handler: (data: any) => void) => {
         subscribeToWorkflowStatus(handler);
    },

    // This would likely live in the Main process, triggered by IPC from Renderer
    // Included here conceptually for saving logic.
    _saveWorkflow: async (workflowData: Workflow) => {
         logger.info(`[Backend/Conceptual] Saving workflow: ${workflowData.name}`);
         const workflows = await loadWorkflowsFromStorage();
         workflows[workflowData.id] = workflowData;
         await fs.writeFile(workflowsFilePath, JSON.stringify(workflows, null, 2), 'utf-8');
         return { success: true, workflow: workflowData };
    }
};

// Example Usage in agent logic:
// const workflows = await workflowAgent.listWorkflows();
// workflowAgent.executeWorkflow(workflows[0].id, { query: 'latest news' });
// workflowAgent.onWorkflowStatusUpdate(status => console.log('Workflow Status:', status));
```

**5. Linking Everything Together**

1.  **Modify `electron/main/index.ts`:**
    *   Import and call `initializeBrowserManager` and `initializeWorkflowManager` after `createWindow`.
    *   Set up the core IPC handlers that route messages between Renderer/Backend and the respective managers (`browserManager`, `workflowManager`).
2.  **Modify `electron/preload/index.ts`:**
    *   Ensure the main preload exposes the necessary `window.electron.ipcRenderer` methods used by the UI (`Browser.tsx`, `WorkflowControls.tsx`).
3.  **Create `electron/preload/browser.ts`:** Add the preload script content from step 6.
4.  **Modify `src/router.tsx`:** Add a route for the `/browser` view, pointing to `src/views/Browser.tsx`.
5.  **Integrate `Browser.tsx`:** Place the `<Browser />` component where you want the browser view to appear in your React layout (e.g., as a main content panel or within a tab).
6.  **Integrate `WorkflowControls.tsx`:** Add this component to the toolbar area within `Browser.tsx` or elsewhere in the UI.
7.  **Backend Integration:**
    *   Modify the agent's core logic in `services/` to:
        *   Import and use `browserAgent` and `workflowAgent`.
        *   Update the system prompt to include browser/workflow capabilities.
        *   Define the necessary tools (`browse_web`, `execute_workflow`, `list_workflows`) that map to the agent functions.
        *   Set up the chosen Main <-> Backend communication mechanism (IPC, HTTP, etc.) and connect the `sendCommandToMain`, `subscribeTo...` functions.

---

This draft provides a structural outline and key code snippets. A full implementation requires fleshing out error handling, security measures, state synchronization details (especially for `BrowserView` bounds and visibility), UI polish, and the specific Main<->Backend communication layer. Remember to install necessary dependencies like `uuid`.