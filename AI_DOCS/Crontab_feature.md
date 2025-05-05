**Engineering Spec: Scheduled Actions & Agent Heartbeat**

**Version:** 1.0
**Date:** 2024-10-27

**1. Introduction & Goals**

This specification details the design for a scheduling system within the Souls application. This system will allow both the user and the AI agent to schedule tasks for future execution, similar to a `cron` job but with simpler scheduling options initially. It also introduces a default "heartbeat" timer to ensure the agent processes its To-Do list when idle.

**Goals:**

1.  **Scheduled Execution:** Enable the agent (or system) to perform predefined actions based on time triggers.
2.  **Timer Types:** Support one-off countdown timers, recurring schedules (e.g., daily, weekly), and interval timers (e.g., every X minutes).
3.  **Task Initiation:** The "action" performed upon trigger will be to initiate an LLM processing cycle with a specific prompt/description defined in the scheduled task.
4.  **Agent Heartbeat:** Implement a default interval timer that checks the agent's To-Do list (from the previous spec) and triggers the next pending task if the agent is currently idle.
5.  **User Management:** Provide a UI for users to view, add, edit, and delete scheduled actions.
6.  **Agent Management:** Provide LLM tools for the agent to schedule, list, and delete actions.
7.  **Persistence:** Scheduled tasks must persist across application restarts.

**2. Architecture & Location**

*   **Scheduler Core:** The core scheduling logic (managing timers, checking triggers) will reside in the **Backend Service (`services/`)**. This ensures tasks run even if the UI is closed (as long as the backend service process is running).
*   **Persistence:** Scheduled task data will be stored in the **SQLite database (`services/database/`)** using a new table.
*   **Task Definition:** The "action" of a scheduled task is defined by its description, which will be used as the primary input/prompt for the LLM when the task is triggered.
*   **Agent Interaction:**
    *   The LLM agent interacts with the scheduler via new **Tools/Functions**.
    *   The scheduler, upon triggering a task, will initiate processing within the **Agent Logic** (likely calling a function similar to the entry point used by user queries, but with the task description).
*   **Idle Detection:** The backend service needs a state variable (e.g., `isAgentProcessing`) to track if the agent is currently handling a user request or another task. The heartbeat timer will check this state.
*   **UI:** A new page/view (`src/pages/ScheduledTasksPage.tsx`) will be created in the Renderer process for user management, communicating via new API endpoints.

**3. Data Model & Storage**

**3.1. Database Schema (`services/database/schema.ts`)**

A new table, `scheduled_tasks`, will be added:

```typescript
// In services/database/schema.ts
import { integer, sqliteTable, text, real } from "drizzle-orm/sqlite-core";

// ... existing tables (chats, messages, agent_tasks) ...

export const scheduledTasks = sqliteTable("scheduled_tasks", {
  id: text("id").primaryKey(),                     // UUID for the task
  description: text("description").notNull(),       // Prompt/Goal for the LLM when triggered
  type: text("type").notNull(),                   // 'once', 'recurring', 'interval', 'heartbeat'
  schedule: text("schedule").notNull(),            // Stores schedule details:
                                                   // - 'once': ISO timestamp string for execution time
                                                   // - 'recurring': Cron-like pattern OR structured JSON (e.g., { time: "07:00", days: [1,2,3,4,5] }) - Start simple
                                                   // - 'interval': Interval in minutes (as string initially)
                                                   // - 'heartbeat': Interval in minutes (e.g., "1")
  status: text("status").notNull().default('active'), // 'active', 'paused', 'completed', 'error'
  nextRunTime: integer("next_run_time", { mode: 'timestamp_ms' }).notNull(), // When the task should next run (epoch ms)
  lastRunTime: integer("last_run_time", { mode: 'timestamp_ms' }), // When the task last ran (epoch ms)
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull(), // Timestamp in milliseconds
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).notNull(), // Timestamp in milliseconds
  createdBy: text("created_by").notNull().default('user'), // 'user' or 'agent'
  failReason: text("fail_reason"),                 // Optional: Reason if status is 'error'
  // Add specific fields for interval stopping if needed, or manage via status='paused'/'deleted'
  // For interval: maybe maxRuns, runCount? Start simple.
});

// Add types to exports
export type ScheduledTask = typeof scheduledTasks.$inferSelect;
export type NewScheduledTask = typeof scheduledTasks.$inferInsert;
```

**3.2. Drizzle Migration (`drizzle/` directory)**

Generate and apply a migration to create the `scheduled_tasks` table and necessary indices.

```sql
-- Example Migration SQL (e.g., drizzle/000Y_add_scheduled_tasks.sql)
CREATE TABLE `scheduled_tasks` (
    `id` text PRIMARY KEY NOT NULL,
    `description` text NOT NULL,
    `type` text NOT NULL,
    `schedule` text NOT NULL,
    `status` text DEFAULT 'active' NOT NULL,
    `next_run_time` integer NOT NULL,
    `last_run_time` integer,
    `created_at` integer NOT NULL,
    `updated_at` integer NOT NULL,
    `created_by` text DEFAULT 'user' NOT NULL,
    `fail_reason` text
);
--> statement-breakpoint
CREATE INDEX `scheduled_tasks_status_nextrun_idx` ON `scheduled_tasks` (`status`, `next_run_time`);
```

**3.3. Interface (`services/utils/types.ts` or new file)**

```typescript
export type ScheduledTaskType = 'once' | 'recurring' | 'interval' | 'heartbeat';
export type ScheduledTaskStatus = 'active' | 'paused' | 'completed' | 'error';

export interface IScheduledTask {
  id: string;
  description: string;
  type: ScheduledTaskType;
  schedule: string; // Consider structured object later if needed
  status: ScheduledTaskStatus;
  nextRunTime: number; // epoch ms
  lastRunTime?: number | null; // epoch ms
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
  createdBy: 'user' | 'agent';
  failReason?: string | null;
}
```

**4. Backend Implementation (`services/`)**

**4.1. New Module: `services/agent/schedulerService.ts`**

This service will manage the scheduling and triggering. Using a library like `node-schedule` is recommended for handling complex recurring patterns robustly, but a `setTimeout`/`setInterval` approach is feasible for simpler initial requirements.

```typescript
import { eq, asc, lte, and, or } from "drizzle-orm";
import { getDB, DatabaseMode, getDatabaseMode } from "../database/index.js";
import * as schema from "../database/schema.js";
import { scheduledTasks, ScheduledTask, NewScheduledTask } from "../database/schema.js";
import logger from "../utils/logger.js";
import { randomUUID } from "crypto";
import { TaskManager } from './taskManager.js'; // Import TaskManager
import { getAgentState, setAgentState } from './agentState'; // Agent state management

// Placeholder for triggering agent processing
// This function needs to be implemented in your main agent logic module
// It should take the task description and initiate an LLM interaction.
declare function triggerAgentProcessing(taskDescription: string, scheduledTaskId: string): Promise<void>;

export class SchedulerService {
    private static instance: SchedulerService;
    private db;
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private isProcessingScheduledAction = false; // Flag to prevent concurrent scheduled task triggers

    private constructor() {
        if (getDatabaseMode() !== DatabaseMode.DIRECT) {
            logger.warn("SchedulerService currently expects Direct DB Mode.");
        }
        this.db = getDB();
        if (!this.db) {
            throw new Error("Database not initialized for SchedulerService");
        }
    }

    public static getInstance(): SchedulerService {
        if (!SchedulerService.instance) {
            SchedulerService.instance = new SchedulerService();
        }
        return SchedulerService.instance;
    }

    /** Initialize the scheduler, load tasks from DB, start heartbeat */
    async initialize(): Promise<void> {
        logger.info("Initializing SchedulerService...");
        await this.loadAndScheduleTasks();
        this.startHeartbeat();
        logger.info("SchedulerService initialized.");
    }

    /** Stop all timers and the heartbeat */
    shutdown(): void {
        logger.info("Shutting down SchedulerService...");
        this.timers.forEach(clearTimeout);
        this.timers.clear();
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        logger.info("SchedulerService shut down.");
    }

    /** Load active tasks from DB and schedule their next run */
    private async loadAndScheduleTasks(): Promise<void> {
        try {
            const now = Date.now();
            const activeTasks = await this.db.query.scheduledTasks.findMany({
                where: and(
                    eq(scheduledTasks.status, 'active'),
                    or(
                        eq(scheduledTasks.type, 'recurring'),
                        eq(scheduledTasks.type, 'interval'),
                        and(
                            eq(scheduledTasks.type, 'once'),
                            gte(scheduledTasks.nextRunTime, now) // Only load future 'once' tasks
                        )
                    )
                ),
            });

            logger.info(`Loading ${activeTasks.length} active scheduled tasks from database.`);
            activeTasks.forEach(task => this.scheduleNextRun(task));

            // Also check for any tasks that *should* have run while offline
            await this.checkMissedTasks();

        } catch (error) {
            logger.error("Error loading scheduled tasks:", error);
        }
    }

    /** Check for tasks whose nextRunTime is in the past */
    private async checkMissedTasks(): Promise<void> {
        const now = Date.now();
        try {
            const missedTasks = await this.db.query.scheduledTasks.findMany({
                where: and(
                    eq(scheduledTasks.status, 'active'),
                    lte(scheduledTasks.nextRunTime, now)
                ),
                orderBy: [asc(scheduledTasks.nextRunTime)] // Process oldest first
            });

            if (missedTasks.length > 0) {
                logger.warn(`Found ${missedTasks.length} missed tasks. Processing them now.`);
                // Process missed tasks one by one to avoid overwhelming the agent
                for (const task of missedTasks) {
                    await this.runScheduledTask(task);
                }
            }
        } catch (error) {
            logger.error("Error checking for missed tasks:", error);
        }
    }


    /** Calculate the next run time based on schedule type and string */
    private calculateNextRunTime(task: ScheduledTask | NewScheduledTask): number {
        const now = Date.now();
        switch (task.type) {
            case 'once':
                // For 'once', the schedule *is* the next run time (ISO string).
                // If already passed, return 0 or handle as error? Let's return 0.
                const runTime = new Date(task.schedule).getTime();
                return runTime > now ? runTime : 0;
            case 'interval':
            case 'heartbeat':
                // Schedule is the interval in minutes
                const intervalMinutes = parseInt(task.schedule, 10);
                if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
                    logger.error(`Invalid interval for task ${task.id}: ${task.schedule}`);
                    return 0; // Or throw error
                }
                // Schedule from 'now' or 'lastRunTime'? Let's use 'now' for simplicity.
                return now + intervalMinutes * 60 * 1000;
            case 'recurring':
                // Simple recurring for now: HH:MM daily, or HH:MM on weekdays
                // TODO: Expand with a cron parser or structured JSON later
                if (task.schedule === 'daily@07:00') { // Example
                    const [hour, minute] = [7, 0];
                    const next = new Date(now);
                    next.setHours(hour, minute, 0, 0);
                    if (next.getTime() <= now) { // If time already passed today, schedule for tomorrow
                        next.setDate(next.getDate() + 1);
                    }
                    return next.getTime();
                } else if (task.schedule === 'weekdays@07:00') { // Example
                    const [hour, minute] = [7, 0];
                    let next = new Date(now);
                    next.setHours(hour, minute, 0, 0);
                    // Loop until we find the next weekday
                    while (true) {
                        const dayOfWeek = next.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                        if (next.getTime() > now && dayOfWeek >= 1 && dayOfWeek <= 5) {
                            break; // Found next weekday occurrence
                        }
                        next.setDate(next.getDate() + 1); // Move to the next day
                        next.setHours(hour, minute, 0, 0); // Reset time
                    }
                    return next.getTime();
                }
                // Add more patterns as needed...
                logger.error(`Unsupported recurring schedule format for task ${task.id}: ${task.schedule}`);
                return 0; // Or throw
            default:
                logger.error(`Unknown task type for task ${task.id}: ${task.type}`);
                return 0; // Or throw
        }
    }

    /** Add a new scheduled task */
    async addScheduledTask(
        description: string,
        type: ScheduledTask['type'],
        schedule: string, // Could be ISO time, interval minutes, or pattern string
        createdBy: 'user' | 'agent' = 'user'
    ): Promise<ScheduledTask> {
        logger.info(`Adding scheduled task: type=${type}, schedule=${schedule}, desc="${description.substring(0, 50)}..."`);
        const now = Date.now();
        const newTask: NewScheduledTask = {
            id: randomUUID(),
            description,
            type,
            schedule,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            createdBy,
            nextRunTime: 0, // Placeholder, calculated next
        };

        // Calculate initial nextRunTime
        newTask.nextRunTime = this.calculateNextRunTime(newTask);
        if (newTask.nextRunTime === 0 && type !== 'once') { // Allow 'once' tasks in the past (maybe missed)
            throw new Error(`Could not calculate a valid future run time for schedule: ${schedule}`);
        }

        const [insertedTask] = await this.db.insert(scheduledTasks).values(newTask).returning();
        logger.info(`Scheduled task ${insertedTask.id} added. Next run: ${new Date(insertedTask.nextRunTime).toLocaleString()}`);

        this.scheduleNextRun(insertedTask); // Schedule it in memory
        return insertedTask;
    }

    /** Schedule the next run of a task using setTimeout */
    private scheduleNextRun(task: ScheduledTask): void {
        if (task.status !== 'active') return;

        // Clear existing timer if any
        const existingTimer = this.timers.get(task.id);
        if (existingTimer) clearTimeout(existingTimer);

        const now = Date.now();
        const delay = task.nextRunTime - now;

        if (delay <= 0) {
            // If the time is now or in the past, run immediately (or handle missed tasks)
            logger.warn(`Task ${task.id} is overdue or due now. Running immediately.`);
            // Queue immediate execution to avoid blocking
            setImmediate(() => this.runScheduledTask(task));
        } else {
            logger.info(`Scheduling task ${task.id} to run in ${delay}ms at ${new Date(task.nextRunTime).toLocaleString()}`);
            const timer = setTimeout(() => {
                this.timers.delete(task.id); // Remove timer before execution
                this.runScheduledTask(task);
            }, delay);
            this.timers.set(task.id, timer);
        }
    }

    /** Execute a scheduled task */
    private async runScheduledTask(task: ScheduledTask): Promise<void> {
        // Prevent multiple triggers for the same task instance
        if (this.isProcessingScheduledAction) {
            logger.warn(`Scheduler is already processing task ${this.currentTaskId}, skipping trigger for ${task.id}`);
            // Reschedule if recurring/interval? Depends on desired behavior for concurrent triggers.
            // For now, we just skip this run and let the next calculation handle it.
             if (task.type === 'recurring' || task.type === 'interval') {
                 this.rescheduleTask(task); // Reschedule even if skipped
             }
            return;
        }

        // Check agent idle state *before* locking
        if (!getAgentState().isIdle) {
            logger.info(`Agent is busy, deferring scheduled task ${task.id}.`);
            // Reschedule for a short delay? Or rely on next calculation?
             if (task.type === 'recurring' || task.type === 'interval') {
                 this.rescheduleTask(task); // Reschedule even if skipped
             }
            return; // Skip execution if agent is busy
        }


        this.isProcessingScheduledAction = true; // Lock
        setAgentState({ isIdle: false }); // Mark agent as busy
        logger.info(`Running scheduled task ${task.id}: "${task.description.substring(0, 50)}..."`);

        try {
            // Update lastRunTime
            await this.db.update(scheduledTasks)
                .set({ lastRunTime: Date.now(), updatedAt: Date.now() })
                .where(eq(scheduledTasks.id, task.id));

            // *** Trigger the actual agent action ***
            // This function needs to integrate with your agent's main processing loop
            await triggerAgentProcessing(task.description, task.id); // Pass ID for context

            // Mark 'once' tasks as completed
            if (task.type === 'once') {
                await this.db.update(scheduledTasks)
                    .set({ status: 'completed', updatedAt: Date.now() })
                    .where(eq(scheduledTasks.id, task.id));
                logger.info(`Marked 'once' task ${task.id} as completed.`);
            }

        } catch (error) {
            logger.error(`Error executing scheduled task ${task.id}:`, error);
            // Mark task as failed in DB
            await this.db.update(scheduledTasks)
                .set({
                    status: 'error',
                    failReason: error instanceof Error ? error.message : String(error),
                    updatedAt: Date.now()
                 })
                .where(eq(scheduledTasks.id, task.id));
        } finally {
            // Reschedule if recurring or interval
            if (task.type === 'recurring' || task.type === 'interval') {
               await this.rescheduleTask(task);
            }
            this.isProcessingScheduledAction = false; // Unlock
             // Agent state should be managed by the agent logic itself upon finishing the triggered task.
             // However, if triggerAgentProcessing is synchronous or fails early, reset here.
            // setAgentState({ isIdle: true }); // Potentially problematic if agent work is async
        }
    }

    /** Recalculate and schedule the next run for recurring/interval tasks */
    private async rescheduleTask(task: ScheduledTask): Promise<void> {
        const nextRunTime = this.calculateNextRunTime(task);
        if (nextRunTime > 0) {
            try {
                const [updatedTask] = await this.db.update(scheduledTasks)
                    .set({ nextRunTime: nextRunTime, updatedAt: Date.now() })
                    .where(eq(scheduledTasks.id, task.id))
                    .returning(); // Get the updated task data

                if (updatedTask) {
                    this.scheduleNextRun(updatedTask); // Schedule the *next* run
                } else {
                     logger.warn(`Task ${task.id} not found during reschedule.`);
                }
            } catch (error) {
                 logger.error(`Failed to update nextRunTime for task ${task.id}:`, error);
            }
        } else {
            logger.warn(`Could not calculate next run time for recurring/interval task ${task.id}. Setting status to error.`);
            await this.db.update(scheduledTasks)
                .set({ status: 'error', failReason: 'Failed to calculate next run time', updatedAt: Date.now() })
                .where(eq(scheduledTasks.id, task.id));
        }
    }

    /** Update a scheduled task */
    async updateScheduledTask(id: string, updates: Partial<ScheduledTask>): Promise<ScheduledTask | null> {
        logger.info(`Updating scheduled task ${id}`);
        const now = Date.now();
        const updateData: any = { ...updates, updatedAt: now };

        // If schedule or type changes, recalculate nextRunTime
        if ('schedule' in updates || 'type' in updates || 'status' in updates) {
            const currentTask = await this.db.query.scheduledTasks.findFirst({ where: eq(scheduledTasks.id, id) });
            if (!currentTask) return null;
            const potentialNewTask = { ...currentTask, ...updates };
            updateData.nextRunTime = this.calculateNextRunTime(potentialNewTask);
            if (updateData.nextRunTime === 0 && potentialNewTask.type !== 'once') {
                 throw new Error(`Could not calculate a valid future run time for updated schedule.`);
            }
            // Ensure status is active if recalculating runtime from non-active state
            if (currentTask.status !== 'active' && updates.status === 'active') {
                updateData.status = 'active';
            }
        }


        const [updatedTask] = await this.db.update(scheduledTasks)
            .set(updateData)
            .where(eq(scheduledTasks.id, id))
            .returning();

        if (updatedTask) {
            this.scheduleNextRun(updatedTask); // Reschedule with updated info
        } else {
            logger.warn(`Task ${id} not found for update.`);
        }

        return updatedTask ?? null;
    }

    /** Delete a scheduled task */
    async deleteScheduledTask(id: string): Promise<boolean> {
        logger.info(`Deleting scheduled task ${id}`);
        // Clear in-memory timer first
        const timer = this.timers.get(id);
        if (timer) {
            clearTimeout(timer);
            this.timers.delete(id);
        }

        // Delete from database
        const result = await this.db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
        // Drizzle-orm delete doesn't return a standard count easily, check affected rows if needed via driver specific methods or assume success if no error.
        return true; // Assuming success if no error
    }

    /** Start the agent heartbeat interval */
    private startHeartbeat(): void {
        if (this.heartbeatInterval) return; // Already running

        const heartbeatIntervalMinutes = 1; // Check every 1 minute
        logger.info(`Starting agent heartbeat interval (${heartbeatIntervalMinutes} min).`);

        this.heartbeatInterval = setInterval(async () => {
            logger.debug("Heartbeat: Checking agent state and To-Do list...");
            if (getAgentState().isIdle) {
                const taskManager = TaskManager.getInstance();
                await taskManager.processNextTaskIfIdle();
            } else {
                logger.debug("Heartbeat: Agent is busy, skipping To-Do check.");
            }
        }, heartbeatIntervalMinutes * 60 * 1000);
    }
}
```

**4.4. Agent State Management (`services/agent/agentState.ts`)**

A simple module to track the agent's busy state.

```typescript
// services/agent/agentState.ts
import logger from '../utils/logger.js';

interface AgentState {
    isIdle: boolean;
    currentActionDescription?: string; // Optional: describe what agent is doing
}

// In-memory state for simplicity
let agentState: AgentState = {
    isIdle: true,
};

export function getAgentState(): Readonly<AgentState> {
    return { ...agentState }; // Return a copy
}

export function setAgentState(newState: Partial<AgentState>): void {
    const previousIdleState = agentState.isIdle;
    agentState = { ...agentState, ...newState };
    if (previousIdleState !== agentState.isIdle) {
        logger.info(`Agent state changed: ${agentState.isIdle ? 'Idle' : 'Busy'}`);
    }
}

// Initialize state
setAgentState({ isIdle: true });
```

**4.5. Modifying `services/processQuery.ts` (or main agent logic)**

*   **Set Busy State:** At the *beginning* of `handleProcessQuery`, set the agent state to busy: `setAgentState({ isIdle: false, currentActionDescription: 'Processing user query' });`
*   **Set Idle State:** In the `finally` block of `handleProcessQuery`, set the agent state back to idle: `setAgentState({ isIdle: true, currentActionDescription: undefined });`. **Crucially**, this should happen *after* any tool calls (like `complete_task`) have potentially triggered the *next* task via `triggerAgentProcessing`. The state needs careful management around asynchronous operations.
*   **Implement `triggerAgentProcessing`:** This function, called by the `SchedulerService` and `TaskManager`, needs to feed the task description into the LLM. How exactly depends on your agent loop structure. It might involve:
    *   Adding the task description to a queue that the main agent loop picks up.
    *   Directly calling a function like `handleProcessQuery` but bypassing the user input stage and using the task description instead.
    *   Emitting an event that the main agent loop listens for.
    *   **Important:** When triggering from the scheduler/task manager, remember to set the agent state to busy *before* the LLM call and reset to idle *after* the LLM call and any resulting tool executions (including `complete_task`) are finished.

**5. LLM Integration**

**5.1. Tool Definitions**

Define JSON schemas for the LLM tools:

```json
[
  // ... existing tools ...
  {
    "type": "function",
    "function": {
      "name": "schedule_action",
      "description": "Schedules an action (described by a prompt/goal) to be performed by the agent at a specific time, recurringly, or at intervals.",
      "parameters": {
        "type": "object",
        "properties": {
          "description": {
            "type": "string",
            "description": "The detailed prompt or goal for the agent to execute when the schedule triggers."
          },
          "type": {
            "type": "string",
            "enum": ["once", "recurring", "interval"],
            "description": "The type of schedule ('once', 'recurring', 'interval')."
          },
          "schedule": {
            "type": "string",
            "description": "Schedule details. For 'once', an ISO 8601 timestamp (e.g., '2024-12-25T09:00:00.000Z'). For 'recurring', a simple pattern (e.g., 'daily@HH:MM', 'weekdays@HH:MM'). For 'interval', the interval in minutes (e.g., '30')."
          }
        },
        "required": ["description", "type", "schedule"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "list_scheduled_actions",
      "description": "Lists currently active scheduled actions (status 'active').",
      "parameters": {
        "type": "object",
        "properties": {}
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "delete_scheduled_action",
      "description": "Deletes a previously scheduled action using its unique ID.",
      "parameters": {
        "type": "object",
        "properties": {
          "task_id": {
            "type": "string",
            "description": "The unique ID of the scheduled action to delete."
          }
        },
        "required": ["task_id"]
      }
    }
  },
  {
    "type": "function",
    "function": {
      "name": "stop_interval_action",
      "description": "Stops a recurring interval action by changing its status to 'paused'.",
       "parameters": {
        "type": "object",
        "properties": {
          "task_id": {
            "type": "string",
            "description": "The unique ID of the interval action to stop/pause."
          }
        },
        "required": ["task_id"]
      }
    }
  }
]
```

**5.2. Tool Handling Logic (in `services/processQuery.ts` or `agentLogic.ts`)**

```typescript
// Example tool handling logic
import { SchedulerService } from './agent/schedulerService';

// ... inside tool processing ...
const schedulerService = SchedulerService.getInstance();

if (toolName === 'schedule_action') {
    try {
        const { description, type, schedule } = toolArgs;
        if (!description || !type || !schedule) throw new Error("Missing required parameters for schedule_action.");
        if (!['once', 'recurring', 'interval'].includes(type)) throw new Error("Invalid schedule type.");
        // TODO: Add validation for schedule format based on type
        const newTask = await schedulerService.addScheduledTask(description, type, schedule, 'agent');
        toolResult = { success: true, taskId: newTask.id };
    } catch (e: any) {
        toolResult = { success: false, error: e.message };
    }
} else if (toolName === 'list_scheduled_actions') {
    try {
        const activeTasks = await schedulerService.getActiveScheduledTasks(); // Need to add this method to SchedulerService
        toolResult = {
            tasks: activeTasks.map(t => ({ id: t.id, description: t.description, type: t.type, schedule: t.schedule, nextRunTime: new Date(t.nextRunTime).toLocaleString() })),
        };
    } catch (e: any) {
        toolResult = { success: false, error: e.message };
    }
} else if (toolName === 'delete_scheduled_action') {
    try {
        const taskId = toolArgs.task_id;
        if (!taskId) throw new Error("Task ID is required.");
        const success = await schedulerService.deleteScheduledTask(taskId);
        toolResult = { success, message: success ? `Scheduled task ${taskId} deleted.` : `Failed to delete task ${taskId}.` };
    } catch (e: any) {
        toolResult = { success: false, error: e.message };
    }
} else if (toolName === 'stop_interval_action') {
    try {
        const taskId = toolArgs.task_id;
        if (!taskId) throw new Error("Task ID is required.");
        const updatedTask = await schedulerService.updateScheduledTask(taskId, { status: 'paused' });
        if (updatedTask) {
            toolResult = { success: true, message: `Interval task ${taskId} paused.` };
        } else {
             toolResult = { success: false, message: `Task ${taskId} not found or could not be paused.` };
        }
    } catch (e: any) {
         toolResult = { success: false, error: e.message };
    }
} else {
    // ... handle other tools ...
}
```
*Note: You'll need to add `getActiveScheduledTasks` to `SchedulerService`.*

**5.3. System Prompt Update (`services/prompt/system.ts`)**

```diff
  <Core_Guidelines>
    <Task_Management>
      // ... existing To-Do list instructions ...
+     - You can also schedule actions to be performed at specific times, recurringly, or at intervals using the `schedule_action` tool.
+     - Use `list_scheduled_actions` to see currently active scheduled actions.
+     - Use `delete_scheduled_action` to remove a scheduled action permanently.
+     - Use `stop_interval_action` to pause an action that runs repeatedly at an interval.
    </Task_Management>
    <Data_Access>
```

**6. UI Integration (`src/`)**

**6.1. New Route & Page (`src/router.tsx`, `src/pages/ScheduledTasksPage.tsx`)**

*   Add a route like `/scheduled-tasks`.
*   Create `ScheduledTasksPage.tsx`:
    *   Use `useState` and `useEffect` to fetch tasks from `/api/agent/tasks`.
    *   Display tasks in a list or table (use antd or similar if available, or plain HTML).
    *   Include columns for Description, Type, Schedule, Status, Next Run, Actions (Edit/Delete/Pause/Resume).
    *   Add a "New Scheduled Task" button that opens a modal.
    *   Implement Add/Edit Modal using `src/components/common/Modal.tsx`. The modal form would collect description, type, and schedule details.
    *   Implement Delete confirmation modal.
    *   Call the API endpoints for CRUD operations.

**6.2. API Endpoints (`services/routes/agent.ts` - new file or merge)**

```typescript
// services/routes/agent.ts (or similar)
import express from "express";
import { SchedulerService } from '../agent/schedulerService.js';
import logger from '../utils/logger.js';

export function agentRouter() {
  const router = express.Router();
  const schedulerService = SchedulerService.getInstance();

  // GET /api/agent/tasks
  router.get("/tasks", async (req, res) => {
    try {
      // Fetch all tasks for UI display, maybe allow filtering by status later
      const tasks = await schedulerService.getAllScheduledTasks(); // Add getAllScheduledTasks method
      res.json({ success: true, tasks });
    } catch (error: any) {
      logger.error("API Error getting tasks:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // POST /api/agent/tasks (Add new task)
  router.post("/tasks", async (req, res) => {
    try {
      const { description, type, schedule } = req.body;
      if (!description || !type || !schedule) {
        return res.status(400).json({ success: false, message: "Missing required fields." });
      }
      // Add validation for type and schedule format
      const newTask = await schedulerService.addScheduledTask(description, type, schedule, 'user');
      res.status(201).json({ success: true, task: newTask });
    } catch (error: any) {
      logger.error("API Error adding task:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // PUT /api/agent/tasks/:id (Update task - e.g., pause/resume/edit)
   router.put("/tasks/:id", async (req, res) => {
      try {
          const taskId = req.params.id;
          const updates = req.body; // e.g., { status: 'paused' } or { description: 'new desc', schedule: 'new schedule' }
          // Add validation for updates
          const updatedTask = await schedulerService.updateScheduledTask(taskId, updates);
          if (updatedTask) {
              res.json({ success: true, task: updatedTask });
          } else {
              res.status(404).json({ success: false, message: "Task not found." });
          }
      } catch (error: any) {
          logger.error(`API Error updating task ${req.params.id}:`, error);
          res.status(500).json({ success: false, message: error.message });
      }
   });

  // DELETE /api/agent/tasks/:id
  router.delete("/tasks/:id", async (req, res) => {
    try {
      const taskId = req.params.id;
      const success = await schedulerService.deleteScheduledTask(taskId);
      if (success) {
        res.json({ success: true });
      } else {
        // This might happen if the task was already deleted
        res.status(404).json({ success: false, message: "Task not found or already deleted." });
      }
    } catch (error: any) {
      logger.error(`API Error deleting task ${req.params.id}:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  return router;
}

// Remember to add this router in services/routes/_index.ts or similar
// router.use("/api/agent", agentRouter());
```
*Note: Need to add `getAllScheduledTasks` method to `SchedulerService`.*

**6.3. Sidebar Link (`src/components/HistorySidebar.tsx`)**

Add a new `FooterButton` entry for "Scheduled Tasks".

**7. API / IPC Design Summary**

*   **Backend Internal:**
    *   `SchedulerService` interacts with `TaskManager` (for heartbeat) and `AgentLogic` (to trigger task execution).
    *   `AgentLogic` (via `processQuery`) interacts with `TaskManager` (for `complete_task`) and `SchedulerService` (via tools like `add_task`, `delete_task`).
*   **Backend <-> LLM:** Via defined tools (`add_task`, `list_tasks`, `complete_task`, `schedule_action`, `list_scheduled_actions`, `delete_scheduled_action`, `stop_interval_action`).
*   **Backend <-> UI (Renderer):** Via new `/api/agent/tasks` endpoints (GET, POST, PUT, DELETE).
*   **UI <-> Main:** Standard IPC for UI actions if needed (unlikely for this feature).

**8. Security Considerations**

*   **Resource Usage:** Interval timers, especially frequent ones, can consume resources. Implement reasonable limits or monitoring. Prevent users/agent from setting extremely short intervals (e.g., < 1 minute).
*   **Denial of Service:** An agent could potentially schedule a huge number of tasks. Consider rate limiting or capping the number of active scheduled tasks.
*   **Task Descriptions:** As these are fed to the LLM, they are subject to prompt injection risks if not handled carefully by the core agent logic. The scheduler itself doesn't execute the description, it just passes it on.
*   **API Security:** Secure the new API endpoints if the backend service is exposed externally (authentication/authorization).

**9. Future Enhancements**

*   **Advanced Scheduling:** Support full cron syntax or more structured JSON for recurring tasks (e.g., specific dates, every Nth weekday). Use a robust library like `node-schedule`.
*   **Task Queuing:** If a scheduled task triggers while the agent is busy, queue it instead of skipping.
*   **Time Zone Support:** Allow specifying time zones for schedules.
*   **Retry Logic:** Automatically retry failed scheduled tasks.
*   **UI Improvements:** More sophisticated UI for adding/editing schedules (date/time pickers, pattern builders). Task history view.
*   **Notifications:** Notify the user when a scheduled task starts or completes/fails.

---

This spec outlines the creation of a robust scheduling system integrated with the agent's task management and the LLM, along with UI control. The core pieces are the new database table, the `SchedulerService`, and the new LLM tools.