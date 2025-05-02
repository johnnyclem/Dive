import { eq, asc } from "drizzle-orm";
import { randomUUID } from "crypto";
import { getDB, DatabaseMode, getDatabaseMode } from "../database/index.js";
import { agentTasks, AgentTask, NewAgentTask } from "../database/schema.js";
import logger from "../utils/logger.js";
import { triggerNextTaskProcessing } from "./agentLogic.js";

export class TaskManager {
  private static instance: TaskManager;
  private db;
  private currentTaskId: string | null = null;
  private isProcessingTask: boolean = false;

  private constructor() {
    if (getDatabaseMode() !== DatabaseMode.DIRECT) {
      logger.warn("TaskManager currently expects Direct DB Mode.");
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

  private async initializeCurrentTask(): Promise<void> {
    try {
      const inProgressTask = await this.db.query.agentTasks.findFirst({
        where: eq(agentTasks.status, 'in_progress'),
        orderBy: [asc(agentTasks.sequence)],
      });
      if (inProgressTask) {
        this.currentTaskId = inProgressTask.id;
        logger.info(`TaskManager initialized. Resuming task: ${this.currentTaskId}`);
      } else {
        logger.info("TaskManager initialized. No tasks currently in progress.");
        await this.processNextTaskIfIdle();
      }
    } catch (error) {
      logger.error("Error initializing current task:", error);
    }
  }

  private async getNextSequence(): Promise<number> {
    const lastTask = await this.db.query.agentTasks.findFirst({
      orderBy: [asc(agentTasks.sequence)],
      columns: { sequence: true }
    });
    return (lastTask?.sequence ?? 0) + 1;
  }

  /** Adds a new task to the list. */
  async addTask(description: string): Promise<AgentTask> {
    logger.info(`Adding new task: "${description.substring(0, 50)}..."`);
    const now = new Date();
    const sequence = await this.getNextSequence();
    const newTask: NewAgentTask = {
      id: randomUUID(),
      description,
      sequence,
      createdAt: now,
      updatedAt: now,
    };
    const [insertedTask] = await this.db.insert(agentTasks).values(newTask).returning();
    logger.info(`Task ${insertedTask.id} added with sequence ${sequence}.`);

    // Trigger next if idle
    await this.processNextTaskIfIdle();

    return insertedTask;
  }

  /** Retrieves pending and in-progress tasks, ordered by sequence. */
  async getActiveTasks(): Promise<AgentTask[]> {
    return await this.db.query.agentTasks.findMany({
      where: (t, { or, eq }) => or(eq(t.status, 'pending'), eq(t.status, 'in_progress')),
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
  private async updateTaskStatus(
    taskId: string,
    status: AgentTask['status'],
    details?: { resultSummary?: string; failReason?: string }
  ): Promise<AgentTask | null> {
    logger.info(`Updating task ${taskId} status to ${status}`);
    const now = new Date();
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
    this.currentTaskId = null;
    this.isProcessingTask = false;
    logger.info(`Task ${taskId} completed.`);

    await this.processNextTask();
  }

  /** Handles failure of the current task and potentially triggers the next one. */
  async handleTaskFailure(taskId: string, reason: string): Promise<void> {
    if (taskId !== this.currentTaskId) {
      logger.warn(`Received failure for task ${taskId}, but current task is ${this.currentTaskId}. Ignoring.`);
      return;
    }

    await this.updateTaskStatus(taskId, 'failed', { failReason: reason });
    this.currentTaskId = null;
    this.isProcessingTask = false;
    logger.error(`Task ${taskId} failed: ${reason}.`);

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
      this.isProcessingTask = true;
      logger.info(`Starting task ${nextTask.id}: "${nextTask.description.substring(0, 50)}..."`);
      await this.updateTaskStatus(nextTask.id, 'in_progress');
      this.currentTaskId = nextTask.id;
      this.isProcessingTask = false;

      triggerNextTaskProcessing(nextTask);
    } else {
      logger.info("No pending tasks found.");
      this.currentTaskId = null;
      this.isProcessingTask = false;
    }
  }

  /** Confirms the agent has started working on the current task. */
  confirmTaskInProgress(taskId: string): boolean {
    if (taskId === this.currentTaskId) {
      logger.debug(`Confirmed task ${taskId} is in progress.`);
      return true;
    }
    logger.warn(`Attempted to confirm progress for task ${taskId}, but current task is ${this.currentTaskId}`);
    return false;
  }

  /** Getter for the current task ID. */
  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }
} 