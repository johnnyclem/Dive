import { eq, asc, lte, and, or, gte } from "drizzle-orm";
import { getDB, DatabaseMode, getDatabaseMode } from "../database/index.js";
import logger from "../utils/logger.js";
import { randomUUID } from "crypto";
import { scheduledTasks, ScheduledTask, NewScheduledTask } from "../database/schema.js";
import { TaskManager } from './taskManager.ts';
import { getAgentState, setAgentState } from './agentState.ts';

// Placeholder: integrate with main agent processing logic
declare function triggerAgentProcessing(taskDescription: string, scheduledTaskId: string): Promise<void>;

export class SchedulerService {
  private static instance: SchedulerService;
  private db = getDB();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private isProcessingScheduledAction = false;

  private constructor() {
    if (getDatabaseMode() !== DatabaseMode.DIRECT) {
      logger.warn("SchedulerService currently expects Direct DB Mode.");
    }
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

  /** Initialize scheduler: load tasks and start heartbeat */
  public async initialize(): Promise<void> {
    logger.info("Initializing SchedulerService...");
    await this.loadAndScheduleTasks();
    this.startHeartbeat();
    logger.info("SchedulerService initialized.");
  }

  /** Stop all timers and heartbeat */
  public shutdown(): void {
    logger.info("Shutting down SchedulerService...");
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    logger.info("SchedulerService shut down.");
  }

  /** Load active tasks from DB and schedule next run */
  private async loadAndScheduleTasks(): Promise<void> {
    const nowMs = Date.now();
    try {
      const activeTasks = await this.db.query.scheduledTasks.findMany({
        where: and(
          eq(scheduledTasks.status, 'active'),
          or(
            eq(scheduledTasks.type, 'recurring'),
            eq(scheduledTasks.type, 'interval'),
            and(
              eq(scheduledTasks.type, 'once'),
              gte(scheduledTasks.nextRunTime, nowMs)
            )
          )
        ),
      });
      logger.info(`Loading ${activeTasks.length} active scheduled tasks from database.`);
      activeTasks.forEach(task => this.scheduleNextRun(task));
      await this.checkMissedTasks();
    } catch (error) {
      logger.error("Error loading scheduled tasks:", error);
    }
  }

  /** Check and process tasks overdue */
  private async checkMissedTasks(): Promise<void> {
    const nowMs = Date.now();
    try {
      const missedTasks = await this.db.query.scheduledTasks.findMany({
        where: and(
          eq(scheduledTasks.status, 'active'),
          lte(scheduledTasks.nextRunTime, nowMs)
        ),
        orderBy: [asc(scheduledTasks.nextRunTime)],
      });
      if (missedTasks.length > 0) {
        logger.warn(`Found ${missedTasks.length} missed tasks. Processing them now.`);
        for (const task of missedTasks) {
          await this.runScheduledTask(task);
        }
      }
    } catch (error) {
      logger.error("Error checking for missed tasks:", error);
    }
  }

  /** Compute next run time based on type and schedule string */
  private calculateNextRunTime(task: ScheduledTask | NewScheduledTask): number {
    const nowMs = Date.now();
    switch (task.type) {
      case 'once': {
        const runTime = new Date(task.schedule).getTime();
        return runTime > nowMs ? runTime : 0;
      }
      case 'interval':
      case 'heartbeat': {
        const intervalMinutes = parseInt(task.schedule, 10);
        if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
          logger.error(`Invalid interval for task ${task.id}: ${task.schedule}`);
          return 0;
        }
        return nowMs + intervalMinutes * 60 * 1000;
      }
      case 'recurring': {
        // Support patterns like daily@HH:MM or weekdays@HH:MM
        if (task.schedule.startsWith('daily@')) {
          const [, time] = task.schedule.split('@');
          const [hour, minute] = time.split(':').map(Number);
          const next = new Date(nowMs);
          next.setHours(hour, minute, 0, 0);
          if (next.getTime() <= nowMs) next.setDate(next.getDate() + 1);
          return next.getTime();
        } else if (task.schedule.startsWith('weekdays@')) {
          const [, time] = task.schedule.split('@');
          const [hour, minute] = time.split(':').map(Number);
          const next = new Date(nowMs);
          next.setHours(hour, minute, 0, 0);
          while (next.getTime() <= nowMs || next.getDay() === 0 || next.getDay() === 6) {
            next.setDate(next.getDate() + 1);
            next.setHours(hour, minute, 0, 0);
          }
          return next.getTime();
        }
        logger.error(`Unsupported recurring schedule format for task ${task.id}: ${task.schedule}`);
        return 0;
      }
      default:
        logger.error(`Unknown task type for task ${task.id}: ${task.type}`);
        return 0;
    }
  }

  /** Add a new scheduled task to DB and schedule in memory */
  public async addScheduledTask(
    description: string,
    type: ScheduledTask['type'],
    schedule: string,
    createdBy: 'user' | 'agent' = 'user'
  ): Promise<ScheduledTask> {
    const nowMs = Date.now();
    const nextMs = this.calculateNextRunTime({ description, type, schedule, id: '', status: 'active', nextRunTime: 0, createdAt: nowMs, updatedAt: nowMs, createdBy } as NewScheduledTask);
    if (nextMs === 0 && type !== 'once') {
      throw new Error(`Could not calculate next run time for schedule: ${schedule}`);
    }
    const newTask: NewScheduledTask = {
      id: randomUUID(),
      description,
      type,
      schedule,
      status: 'active',
      createdAt: nowMs,
      updatedAt: nowMs,
      createdBy,
      nextRunTime: nextMs,
    };
    const [inserted] = await this.db.insert(scheduledTasks).values(newTask).returning();
    logger.info(`Scheduled task ${inserted.id} added. Next run: ${new Date(inserted.nextRunTime).toLocaleString()}`);
    this.scheduleNextRun(inserted);
    return inserted;
  }

  /** Schedule next run in memory */
  private scheduleNextRun(task: ScheduledTask): void {
    if (task.status !== 'active') return;
    const existing = this.timers.get(task.id);
    if (existing) clearTimeout(existing);
    const delay = task.nextRunTime.getTime() - Date.now();
    if (delay <= 0) {
      setImmediate(() => this.runScheduledTask(task));
    } else {
      logger.info(`Scheduling task ${task.id} to run in ${delay}ms`);
      const timer = setTimeout(() => {
        this.timers.delete(task.id);
        this.runScheduledTask(task);
      }, delay);
      this.timers.set(task.id, timer);
    }
  }

  /** Execute a scheduled task */
  private async runScheduledTask(task: ScheduledTask): Promise<void> {
    if (this.isProcessingScheduledAction) {
      logger.warn(`Already processing a scheduled action, skipping ${task.id}`);
      if (task.type === 'recurring' || task.type === 'interval') {
        await this.rescheduleTask(task);
      }
      return;
    }
    if (!getAgentState().isIdle) {
      logger.info(`Agent is busy, deferring scheduled task ${task.id}`);
      if (task.type === 'recurring' || task.type === 'interval') {
        await this.rescheduleTask(task);
      }
      return;
    }
    this.isProcessingScheduledAction = true;
    setAgentState({ isIdle: false });
    logger.info(`Running scheduled task ${task.id}: "${task.description.slice(0,50)}..."`);
    try {
      const nowUpdate = new Date();
      await this.db.update(scheduledTasks)
        .set({ lastRunTime: nowUpdate, updatedAt: nowUpdate })
        .where(eq(scheduledTasks.id, task.id));
      await triggerAgentProcessing(task.description, task.id);
      if (task.type === 'once') {
        const now2 = new Date();
        await this.db.update(scheduledTasks)
          .set({ status: 'completed', updatedAt: now2 })
          .where(eq(scheduledTasks.id, task.id));
        logger.info(`Once task ${task.id} completed.`);
      }
    } catch (error) {
      logger.error(`Error executing scheduled task ${task.id}:`, error);
      const nowErr = new Date();
      await this.db.update(scheduledTasks)
        .set({ status: 'error', failReason: error instanceof Error ? error.message : String(error), updatedAt: nowErr })
        .where(eq(scheduledTasks.id, task.id));
    } finally {
      if (task.type === 'recurring' || task.type === 'interval') {
        await this.rescheduleTask(task);
      }
      this.isProcessingScheduledAction = false;
    }
  }

  /** Recalculate and persist the next run time */
  private async rescheduleTask(task: ScheduledTask): Promise<void> {
    const nextMs = this.calculateNextRunTime(task);
    if (nextMs > 0) {
      try {
        const nowResched = new Date();
        const [updated] = await this.db.update(scheduledTasks)
          .set({ nextRunTime: new Date(nextMs), updatedAt: nowResched })
          .where(eq(scheduledTasks.id, task.id))
          .returning();
        if (updated) this.scheduleNextRun(updated);
      } catch (error) {
        logger.error(`Failed to update nextRunTime for ${task.id}:`, error);
      }
    } else {
      logger.warn(`Could not calculate next run for ${task.id}. Marking error.`);
      await this.db.update(scheduledTasks)
        .set({ status: 'error', failReason: 'Next run calculation failed', updatedAt: Date.now() })
        .where(eq(scheduledTasks.id, task.id));
    }
  }

  /** Update task properties */
  public async updateScheduledTask(
    id: string,
    updates: Partial<ScheduledTask>
  ): Promise<ScheduledTask | null> {
    const nowMs = Date.now();
    const current = await this.db.query.scheduledTasks.findFirst({ where: eq(scheduledTasks.id, id) });
    if (!current) return null;
    const merged = { ...current, ...updates } as ScheduledTask;
    if (updates.schedule || updates.type || updates.status) {
      const nextMs = this.calculateNextRunTime(merged);
      merged.nextRunTime = nextMs;
      merged.updatedAt = nowMs;
      merged.updatedAt = now;
      if (merged.nextRunTime === 0 && merged.type !== 'once') {
        throw new Error('Invalid next run time for updated schedule');
      }
      if (current.status !== 'active' && merged.status === 'active') {
        merged.status = 'active';
      }
    }
    const [updated] = await this.db.update(scheduledTasks)
      .set({ ...updates, nextRunTime: merged.nextRunTime, updatedAt: now })
      .where(eq(scheduledTasks.id, id))
      .returning();
    if (updated) this.scheduleNextRun(updated);
    return updated ?? null;
  }

  /** Delete a scheduled task */
  public async deleteScheduledTask(id: string): Promise<boolean> {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    await this.db.delete(scheduledTasks).where(eq(scheduledTasks.id, id));
    return true;
  }

  /** List active scheduled tasks */
  public async getActiveScheduledTasks(): Promise<ScheduledTask[]> {
    return await this.db.query.scheduledTasks.findMany({
      where: eq(scheduledTasks.status, 'active'),
      orderBy: [asc(scheduledTasks.nextRunTime)],
    });
  }

  /** List all scheduled tasks */
  public async getAllScheduledTasks(): Promise<ScheduledTask[]> {
    return await this.db.query.scheduledTasks.findMany({
      orderBy: [asc(scheduledTasks.nextRunTime)],
    });
  }

  /** Start the agent heartbeat to process To-Do tasks when idle */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    const intervalMin = 1;
    logger.info(`Starting agent heartbeat (${intervalMin}m)`);
    this.heartbeatInterval = setInterval(async () => {
      if (getAgentState().isIdle) {
        const tm = TaskManager.getInstance();
        await tm.processNextTaskIfIdle();
      }
    }, intervalMin * 60 * 1000);
  }
} 