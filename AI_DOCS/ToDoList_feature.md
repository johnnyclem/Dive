Engineering Spec: AI Agent To-Do List

Version: 1.0
Date: 2024-10-27

1. Introduction & Goals

This feature introduces a persistent To-Do List managed by the AI agent within the Souls application. The primary goals are:

Task Persistence: Enable the agent to track tasks across sessions and potential interruptions.
Workflow Management: Facilitate the execution of multi-step processes by managing a sequence of tasks.
Interruption Handling: Allow the agent (or user via the agent) to add new tasks without losing track of ongoing or pending ones.
Serial Execution: Ensure tasks are processed one after another, triggering the next task upon completion of the current one.
Status Tracking: Provide a mechanism for the agent to know the status of its tasks (pending, in progress, completed, failed).
2. Architecture & Location

Core Logic Location: The primary logic and state for the To-Do list will reside within the Backend Service (services/). This keeps the agent's internal state management separate from the UI and Electron main process concerns.
Persistence: Task data will be stored in the existing SQLite database (services/database/) by adding a new table.
Interaction: The LLM agent will interact with the To-Do list via newly defined Tools/Functions. Task completion will trigger internal logic within the backend service to manage the queue and potentially initiate the next task.
UI (Optional): A simple UI view could be added later in the Renderer process (src/) to display the agent's current task list for user visibility, interacting via new API endpoints.
3. Data Model & Storage

3.1. Database Schema (services/database/schema.ts)

A new table, agent_tasks, will be added:

// In services/database/schema.ts
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

// ... existing tables ...

export const agentTasks = sqliteTable("agent_tasks", {
  id: text("id").primaryKey(),             // UUID for the task
  description: text("description").notNull(), // Detailed description of the task (can be the prompt for the LLM)
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed'
  sequence: integer("sequence").notNull(), // Integer for ordering tasks (higher number = executed later)
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull(), // Timestamp in milliseconds
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).notNull(), // Timestamp in milliseconds
  resultSummary: text("result_summary"),   // Optional: Brief summary of the task outcome
  failReason: text("fail_reason"),         // Optional: Reason if status is 'failed'
  // Add context fields if needed later, e.g., context: text("context", { mode: "json" })
});

// Add types to exports
export type AgentTask = typeof agentTasks.$inferSelect;
export type NewAgentTask = typeof agentTasks.$inferInsert;
content_copy
download
Use code with caution.
TypeScript
3.2. Drizzle Migration (drizzle/ directory)

A new migration file needs to be generated and applied (using drizzle-kit generate and the migration script) to create the agent_tasks table.

-- Example Migration SQL (e.g., drizzle/000X_add_agent_tasks.sql)
CREATE TABLE `agent_tasks` (
    `id` text PRIMARY KEY NOT NULL,
    `description` text NOT NULL,
    `status` text DEFAULT 'pending' NOT NULL,
    `sequence` integer NOT NULL,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `result_summary` text,
    `fail_reason` text
);
--> statement-breakpoint
CREATE INDEX `agent_tasks_status_sequence_idx` ON `agent_tasks` (`status`, `sequence`);
content_copy
download
Use code with caution.
SQL
3.3. Interface (services/utils/types.ts or new file)

// Optional: Define a clean interface if needed beyond the inferred DB type
export interface IAgentTask {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  sequence: number;
  createdAt: number;
  updatedAt: number;
  resultSummary?: string | null;
  failReason?: string | null;
}
content_copy
download
Use code with caution.
TypeScript
4. Backend Implementation (services/)

4.1. New Module: services/agent/taskManager.ts

This module will encapsulate the To-Do list logic.

import { eq, asc, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDB, DatabaseMode, getDatabaseMode } from "../database/index.js";
import * as schema from "../database/schema.js";
import { agentTasks, AgentTask, NewAgentTask } from "../database/schema.js";
import logger from "../utils/logger.js";
import { triggerNextTaskProcessing } from './agentLogic'; // Assuming agentLogic handles LLM interaction

export class TaskManager {
  private static instance: TaskManager;
  private db;
  private currentTaskId: string | null = null;
  private isProcessingTask: boolean = false; // Prevent race conditions

  private constructor() {
    if (getDatabaseMode() !== DatabaseMode.DIRECT) {
        // In API mode, this manager might need to interact via API calls
        // For now, we assume Direct DB access as it's simpler within the service layer.
        logger.warn("TaskManager currently expects Direct DB Mode.");
        // Implement API interaction logic if needed
    }
    this.db = getDB();
    if (!this.db) {
        throw new Error("Database not initialized for TaskManager");
    }
    this.initializeCurrentTask().catch(logger.error);
  }

  public static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  // Find any 'in_progress' task on startup
  private async initializeCurrentTask(): Promise<void> {
    try {
        const inProgressTask = await this.db.query.agentTasks.findFirst({
            where: eq(agentTasks.status, 'in_progress'),
            orderBy: [asc(agentTasks.sequence)],
        });
        if (inProgressTask) {
            this.currentTaskId = inProgressTask.id;
            logger.info(`TaskManager initialized. Resuming task: ${this.currentTaskId}`);
            // Optionally trigger processing if needed, depends on resilience strategy
            // await this.processNextTask();
        } else {
            logger.info("TaskManager initialized. No tasks currently in progress.");
            // Check for pending tasks on startup
            await this.processNextTaskIfIdle();
        }
    } catch (error) {
        logger.error("Error initializing current task:", error);
    }
  }

  // Get the next available sequence number
  private async getNextSequence(): Promise<number> {
    const lastTask = await this.db.query.agentTasks.findFirst({
      orderBy: [(schema.agentTasks.sequence, asc(schema.agentTasks.sequence))] // Corrected syntax
    });
    return (lastTask?.sequence ?? 0) + 1;
  }


  /** Adds a new task to the list. */
  async addTask(description: string): Promise<AgentTask> {
    logger.info(`Adding new task: "${description.substring(0, 50)}..."`);
    const now = Date.now();
    const sequence = await this.getNextSequence();
    const newTask: NewAgentTask = {
      id: randomUUID(),
      description,
      status: 'pending',
      sequence,
      createdAt: now,
      updatedAt: now,
    };
    const [insertedTask] = await this.db.insert(agentTasks).values(newTask).returning();
    logger.info(`Task ${insertedTask.id} added with sequence ${sequence}.`);

    // If no task is currently processing, trigger the new task
    await this.processNextTaskIfIdle();

    return insertedTask;
  }

  /** Retrieves pending and in-progress tasks, ordered by sequence. */
  async getActiveTasks(): Promise<AgentTask[]> {
    return await this.db.query.agentTasks.findMany({
      where: (tasks, { or, eq }) => or(eq(tasks.status, 'pending'), eq(tasks.status, 'in_progress')),
      orderBy: [asc(agentTasks.sequence)],
    });
  }

  /** Retrieves all tasks, ordered by sequence. */
  async getAllTasks(): Promise<AgentTask[]> {
     return await this.db.query.agentTasks.findMany({
        orderBy: [asc(agentTasks.sequence)],
     });
  }


  /** Updates the status of a task. */
  private async updateTaskStatus(taskId: string, status: AgentTask['status'], details?: { resultSummary?: string, failReason?: string }): Promise<AgentTask | null> {
    logger.info(`Updating task ${taskId} status to ${status}`);
    const now = Date.now();
    const [updatedTask] = await this.db.update(agentTasks)
      .set({
        status,
        updatedAt: now,
        resultSummary: details?.resultSummary,
        failReason: details?.failReason,
      })
      .where(eq(agentTasks.id, taskId))
      .returning();

    if (!updatedTask) {
      logger.warn(`Task ${taskId} not found for status update.`);
      return null;
    }
    return updatedTask;
  }

  /** Finds the next pending task. */
  private async getNextPendingTask(): Promise<AgentTask | null> {
    const task = await this.db.query.agentTasks.findFirst({
      where: eq(agentTasks.status, 'pending'),
      orderBy: [asc(agentTasks.sequence)],
    });
    return task ?? null;
  }

  /** Handles completion of the current task and triggers the next one. */
  async handleTaskCompletion(taskId: string, resultSummary?: string): Promise<void> {
    if (taskId !== this.currentTaskId) {
      logger.warn(`Received completion for task ${taskId}, but current task is ${this.currentTaskId}. Ignoring.`);
      return;
    }

    await this.updateTaskStatus(taskId, 'completed', { resultSummary });
    this.currentTaskId = null; // Mark current task as done *before* starting next
    this.isProcessingTask = false;
    logger.info(`Task ${taskId} completed.`);

    // Automatically process the next task
    await this.processNextTask();
  }

  /** Handles failure of the current task and potentially triggers the next one. */
  async handleTaskFailure(taskId: string, reason: string): Promise<void> {
    if (taskId !== this.currentTaskId) {
      logger.warn(`Received failure for task ${taskId}, but current task is ${this.currentTaskId}. Ignoring.`);
      return;
    }

    await this.updateTaskStatus(taskId, 'failed', { failReason: reason });
    this.currentTaskId = null; // Mark current task as done *before* potentially starting next
    this.isProcessingTask = false;
    logger.error(`Task ${taskId} failed: ${reason}.`);

    // Decide if we should proceed with the next task after a failure (configurable maybe?)
    // For now, let's proceed.
    await this.processNextTask();
  }

  /** Checks if the agent is idle and processes the next task if available. */
  async processNextTaskIfIdle(): Promise<void> {
    if (!this.currentTaskId && !this.isProcessingTask) {
      await this.processNextTask();
    } else {
      logger.debug("Agent is not idle, skipping next task processing trigger.");
    }
  }

  /** Retrieves and starts processing the next pending task. */
  private async processNextTask(): Promise<void> {
    if (this.isProcessingTask) {
      logger.debug("Already processing a task, skipping.");
      return;
    }

    logger.debug("Attempting to process next task...");
    const nextTask = await this.getNextPendingTask();

    if (nextTask) {
      this.isProcessingTask = true; // Lock processing
      logger.info(`Starting task ${nextTask.id}: "${nextTask.description.substring(0, 50)}..."`);
      await this.updateTaskStatus(nextTask.id, 'in_progress');
      this.currentTaskId = nextTask.id;
      this.isProcessingTask = false; // Unlock after status update

      // Trigger the agent logic (e.g., call the LLM) with the task description
      // This needs a way to communicate back to the main agent loop/handler
      triggerNextTaskProcessing(nextTask); // Assume this function exists and handles the LLM call

    } else {
      logger.info("No pending tasks found.");
      this.currentTaskId = null;
      this.isProcessingTask = false;
    }
  }

  // Method for agent/tool to signal it's starting work on the current task
  // Could be implicitly handled by the agent loop, but explicit might be clearer.
  confirmTaskInProgress(taskId: string): boolean {
      if (taskId === this.currentTaskId) {
          // Optional: Could re-update status or just confirm internally
          logger.debug(`Confirmed task ${taskId} is in progress.`);
          return true;
      }
      logger.warn(`Attempted to confirm progress for task ${taskId}, but current task is ${this.currentTaskId}`);
      return false;
  }

  // Getter for the current task ID
  getCurrentTaskId(): string | null {
      return this.currentTaskId;
  }
}
content_copy
download
Use code with caution.
TypeScript
4.2. Database Operations (services/database/index.ts)

Add new functions for the agent_tasks table:

// In services/database/index.ts
import { eq, asc, desc, or } from "drizzle-orm"; // Add asc, desc, or
import { agentTasks, NewAgentTask, AgentTask } from "./schema.js"; // Import new schema items

// ... existing databaseOperations interface and implementations ...

// Extend the DatabaseOperations interface
interface DatabaseOperations {
  // ... existing methods ...
  getAgentTasks(status?: 'pending' | 'in_progress' | 'all'): Promise<AgentTask[]>;
  addAgentTask(task: NewAgentTask): Promise<AgentTask>;
  updateAgentTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask | null>;
  getNextAgentSequence(): Promise<number>;
}

// Add implementations to DirectDatabaseAccess class
class DirectDatabaseAccess implements DatabaseOperations {
  // ... existing constructor and methods ...

  async getAgentTasks(status?: 'pending' | 'in_progress' | 'all'): Promise<AgentTask[]> {
    let queryOptions: any = { // Use any temporarily for flexibility, refine if needed
      orderBy: [asc(agentTasks.sequence)],
    };

    if (status && status !== 'all') {
        if (status === 'pending') {
             queryOptions.where = or(eq(agentTasks.status, 'pending'), eq(agentTasks.status, 'in_progress'));
        } else {
            queryOptions.where = eq(agentTasks.status, status);
        }
    }

    return await this.db.query.agentTasks.findMany(queryOptions);
  }

  async addAgentTask(task: NewAgentTask): Promise<AgentTask> {
    const [insertedTask] = await this.db.insert(agentTasks).values(task).returning();
    return insertedTask;
  }

  async updateAgentTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask | null> {
    const [updatedTask] = await this.db.update(agentTasks)
      .set({ ...updates, updatedAt: Date.now() })
      .where(eq(agentTasks.id, id))
      .returning();
    return updatedTask ?? null;
  }

  async getNextAgentSequence(): Promise<number> {
      const lastTask = await this.db.query.agentTasks.findFirst({
        orderBy: [desc(agentTasks.sequence)], // Use desc for finding the max
        columns: { sequence: true }
      });
      return (lastTask?.sequence ?? 0) + 1;
  }

  // ... rest of the class ...
}

// Add implementations to ApiDatabaseAccess class (if API mode needs to support tasks)
class ApiDatabaseAccess implements DatabaseOperations {
  // ... existing constructor and methods ...

  async getAgentTasks(status?: 'pending' | 'in_progress' | 'all'): Promise<AgentTask[]> {
    // TODO: Implement API call
    logger.warn("getAgentTasks API method not implemented.");
    return [];
  }

  async addAgentTask(task: NewAgentTask): Promise<AgentTask> {
    // TODO: Implement API call
    logger.warn("addAgentTask API method not implemented.");
    throw new Error("Not implemented");
  }

  async updateAgentTask(id: string, updates: Partial<AgentTask>): Promise<AgentTask | null> {
    // TODO: Implement API call
    logger.warn("updateAgentTask API method not implemented.");
    return null;
  }

  async getNextAgentSequence(): Promise<number> {
    // TODO: Implement API call or derive differently
    logger.warn("getNextAgentSequence API method not implemented.");
    return 1;
  }

  // ... rest of the class ...
}

// Export new functions
export const getAgentTasks = (status?: 'pending' | 'in_progress' | 'all') => databaseOperations.getAgentTasks(status);
export const addAgentTask = (task: NewAgentTask) => databaseOperations.addAgentTask(task);
export const updateAgentTask = (id: string, updates: Partial<AgentTask>) => databaseOperations.updateAgentTask(id, updates);
// ... rest of the exports ...
content_copy
download
Use code with caution.
TypeScript
4.3. Tool Handling (services/processQuery.ts or services/agent/agentLogic.ts)

Modify the tool handling logic to interact with the TaskManager.

// Example within handleProcessQuery or a dedicated agentLogic module
import { TaskManager } from './agent/taskManager'; // Adjust path

// ... inside the function where tool calls are processed ...

// Get TaskManager instance
const taskManager = TaskManager.getInstance();

// ... existing tool call processing ...

// Example handling for new tools
if (toolName === 'add_task') {
  try {
    const description = toolArgs.description; // Assuming arg name is 'description'
    if (!description) throw new Error("Task description is required.");
    const newTask = await taskManager.addTask(description);
    toolResult = { success: true, taskId: newTask.id };
  } catch (e: any) {
    toolResult = { success: false, error: e.message };
  }
} else if (toolName === 'list_tasks') {
  try {
    const activeTasks = await taskManager.getActiveTasks();
    // Format for LLM consumption
    toolResult = {
      tasks: activeTasks.map(t => ({ id: t.id, description: t.description, status: t.status })),
    };
  } catch (e: any) {
    toolResult = { success: false, error: e.message };
  }
} else if (toolName === 'complete_task') {
  try {
    const taskId = toolArgs.task_id;
    const resultSummary = toolArgs.result_summary;
    if (!taskId) throw new Error("Task ID is required.");

    // Check if this is the current task the agent should be completing
    if (taskId !== taskManager.getCurrentTaskId()) {
        logger.warn(`Agent attempted to complete task ${taskId}, but it's not the current task (${taskManager.getCurrentTaskId()}). Allowing completion anyway.`);
        // Allow completion, but log the potential mismatch
    }

    await taskManager.handleTaskCompletion(taskId, resultSummary);
    // No explicit result needed for the LLM, the system handles the next step.
    // We might return a simple confirmation.
    toolResult = { success: true, message: `Task ${taskId} marked complete.` };
    // IMPORTANT: handleTaskCompletion now internally triggers processNextTask,
    // so we don't need to explicitly call it here.
  } catch (e: any) {
    logger.error(`Error completing task ${toolArgs.task_id}: ${e.message}`);
    // Optionally mark task as failed if completion signal fails
    // await taskManager.handleTaskFailure(toolArgs.task_id, `Failed during completion attempt: ${e.message}`);
    toolResult = { success: false, error: e.message };
  }
} else {
  // ... handle existing tools ...
}

// ... after processing all tool calls ...

// Check if a new task was triggered by completion logic
// This check might be better placed within the TaskManager's trigger function
// or the main agent loop after the current LLM turn finishes.
// For simplicity, we'll assume `triggerNextTaskProcessing` handles the continuation.

// ... rest of handleProcessQuery ...

// --- New function (potentially in agentLogic.ts) to handle starting the next task ---
export function triggerNextTaskProcessing(task: AgentTask) {
    logger.info(`Triggering LLM processing for next task: ${task.id}`);
    // This function needs to initiate a new interaction cycle with the LLM,
    // using `task.description` as the primary goal or prompt.
    // It might need access to the current chat history, etc.
    // Example (conceptual):
    // const agent = getAgentInstance(); // Get your main agent instance
    // agent.processPrompt(task.description, { currentTaskId: task.id });
    // Or, if integrated into processQuery loop:
    // nextPrompt = task.description; // Set the input for the *next* LLM call

    // For now, just log it
    logger.debug(`Task Description to process: ${task.description}`);
}
content_copy
download
Use code with caution.
TypeScript
5. LLM Integration

5.1. Tool Definitions

Define the new tools for the LLM (format depends on the specific model API, example uses OpenAI-like function calling):

[
  {
    "type": "function",
    "function": {
      "name": "add_task",
      "description": "Adds a new task to the agent's persistent to-do list. Use this to remember multi-step goals or things to do later.",
      "parameters": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string",
            "description": "A clear, detailed description of the task to be performed."
          }
        },
        "required": ["description"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_tasks",
      "description": "Lists the tasks currently marked as 'pending' or 'in_progress' on the agent's to-do list.",
      "parameters": {
        "type": "object",
        "properties": {} // No parameters needed
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "complete_task",
      "description": "Marks the specified task on the agent's to-do list as completed. This should ONLY be called when the task's objective has been fully achieved.",
      "parameters": {
        "type": "object",
        "properties": {
          "task_id": {
            "type": "string",
            "description": "The unique ID of the task that has been completed."
          },
          "result_summary": {
            "type": "string",
            "description": "A brief summary of the outcome or result of the completed task."
          }
        },
        "required": ["task_id", "result_summary"]
      }
    }
  }
]
content_copy
download
Use code with caution.
Json
5.2. Prompt Engineering (services/prompt/system.ts)

Add instructions to the system prompt:

<Core_Guidelines>
+   <Task_Management>
+     - You have a persistent To-Do List to manage complex or multi-step tasks.
+     - Use the `add_task` tool to add items to your list when a request involves multiple distinct steps or needs to be deferred.
+     - Use the `list_tasks` tool to check your current pending and in-progress tasks.
+     - When you are actively working on a task from your list, focus on completing it.
+     - **CRITICAL:** When you have fully completed the objective of a task you were working on (identified by its task_id), you MUST call the `complete_task` tool with the task_id and a summary of the result. This signals the system to proceed to the next task if one exists.
+     - If a user gives you a new, unrelated instruction while you are working on a task, use `add_task` to add the *new* instruction to your list, then inform the user you've added it and will continue with your current task first.
+   </Task_Management>
    <Data_Access>
      - MANDATORY: Employ the MCP to establish connections with designated data sources, including but not limited to databases, APIs, and file systems.
      - COMPLIANCE REQUIRED: Rigorously observe all security and privacy protocols during data access.
content_copy
download
Use code with caution.
Diff
6. Task Execution Logic & Interruption

Serial Execution: The TaskManager ensures this. processNextTask is only called by handleTaskCompletion (or handleTaskFailure, or processNextTaskIfIdle). The isProcessingTask flag prevents re-entry. Only one currentTaskId is active.
Starting the Next Task: When handleTaskCompletion calls processNextTask, and a pending task is found, triggerNextTaskProcessing is invoked. This function's implementation is crucial. It needs to inject the nextTask.description into the agent's next thought process, possibly by setting it as the next input prompt or goal for the LLM.
Interruption:
The current implementation leans towards the simpler approach (Option A): If the LLM receives a new user request while taskManager.getCurrentTaskId() returns a non-null ID, the LLM's prompt instructs it to use add_task for the new request and then state it will continue the current task.
The LLM would then continue its reasoning cycle for the original currentTaskId until it calls complete_task.
7. UI Integration (Optional - Phase 2)

New Route/Page: Add /agent-tasks route in src/router.tsx pointing to src/views/AgentTasks.tsx.
API Endpoint: Create a new router in services/routes/ (e.g., agent.ts) with an endpoint like /api/agent/tasks that calls TaskManager.getInstance().getAllTasks().
UI Component (AgentTasks.tsx):
Fetch tasks from the API endpoint.
Display tasks in a list (description, status, timestamps).
Potentially add buttons to manually trigger delete_task or mark_task_complete via API calls (requires corresponding tool/API endpoint implementation).
Sidebar Link: Add a link to /agent-tasks in src/components/HistorySidebar.tsx.
8. API / IPC Design

New Backend API Endpoints (if UI is added):
GET /api/agent/tasks: Retrieve all tasks.
DELETE /api/agent/tasks/:taskId: Delete a task (requires backend logic/tool).
POST /api/agent/tasks/:taskId/complete: Mark task complete (requires backend logic/tool).
IPC: No new IPC channels are strictly required between Main and Renderer for the core backend logic, unless UI interaction is implemented. Main <-> Backend communication needs to be established if not already present (as noted in the Browser spec draft).
9. Security Considerations

Tool Input Sanitization: Ensure descriptions passed to add_task and results passed to complete_task are appropriately handled and don't contain malicious content if they are ever displayed or used in ways that could be exploited.
Infinite Loops: Design prompts carefully to prevent the agent from getting stuck in loops of adding/completing trivial tasks. Rate limiting or complexity checks might be needed in the future.
Task Permissions: Currently, any task description is executed. Future versions might need a permission system or user confirmation for tasks involving sensitive actions (e.g., file deletion, external API calls).
10. Future Enhancements

Task Prioritization (priority field, prioritize_task tool).
Task Dependencies (dependsOn field).
Pausing/Resuming tasks (pause_task, resume_task tools, 'paused' status).
Storing richer task context (JSON).
More sophisticated LLM-driven task decomposition (Agent generates sub-tasks for add_task).
UI for managing tasks directly (reordering, editing).
Error handling strategies (e.g., retry attempts, user notification on failure).
This spec provides a foundation for the agent's To-Do list. The core components are the database table, the TaskManager class in the backend, and the LLM tools for interaction. The serial execution is managed by the handleTaskCompletion -> processNextTask -> triggerNextTaskProcessing flow.
