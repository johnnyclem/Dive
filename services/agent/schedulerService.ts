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
            eq(scheduledTasks.type, 'runloop'),
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
  private calculateNextRunTime(task: Pick<ScheduledTask, 'id' | 'type' | 'schedule' | 'nextRunTime' | 'status'>): number {
    const nowMs = Date.now();
    let currentNextRunTime = 0;
    if (typeof task.nextRunTime === 'number') {
        currentNextRunTime = task.nextRunTime;
    }

    switch (task.type) {
      case 'once': {
        const runTime = new Date(task.schedule).getTime();
        return runTime > nowMs ? runTime : 0;
      }
      case 'interval':
      case 'heartbeat': {
        const intervalMinutes = parseInt(task.schedule, 10);
        if (isNaN(intervalMinutes) || intervalMinutes <= 0) {
          logger.error(`Invalid interval for task ${task.id || 'new'}: ${task.schedule}`);
          return 0;
        }
        const baseTime = (currentNextRunTime > nowMs && task.type === 'interval') ? currentNextRunTime : nowMs;
        return baseTime + intervalMinutes * 60 * 1000;
      }
      case 'runloop': {
        const intervalSeconds = parseInt(task.schedule, 10);
        if (isNaN(intervalSeconds) || intervalSeconds <= 0) {
          logger.error(`Invalid interval for runloop task ${task.id || 'new'}: ${task.schedule}`);
          return 0;
        }
        const baseTime = (currentNextRunTime > nowMs) ? currentNextRunTime : nowMs;
        return baseTime + intervalSeconds * 1000;
      }
      case 'recurring': {
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
        logger.error(`Unsupported recurring schedule format for task ${task.id || 'new'}: ${task.schedule}`);
        return 0;
      }
      default:
        logger.error(`Unknown task type for task ${task.id || 'new'}: ${task.type}`);
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
    const tempTaskForCalc: Pick<ScheduledTask, 'id' | 'type' | 'schedule' | 'nextRunTime' | 'status'> = {
      id: 'temp-id-for-calc',
      type,
      schedule,
      nextRunTime: 0, 
      status: 'active',
    };
    
    const nextMs = this.calculateNextRunTime(tempTaskForCalc);

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
    const nextRunTimeNumber = typeof task.nextRunTime === 'number' ? task.nextRunTime : new Date(task.nextRunTime).getTime();
    const existing = this.timers.get(task.id);
    if (existing) clearTimeout(existing);
    const delay = nextRunTimeNumber - Date.now();
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
      if (task.type === 'recurring' || task.type === 'interval' || task.type === 'runloop') {
        await this.rescheduleTask(task);
      }
      return;
    }
    if (!getAgentState().isIdle) {
      logger.info(`Agent is busy, deferring scheduled task ${task.id}`);
      if (task.type === 'recurring' || task.type === 'interval' || task.type === 'runloop') {
        await this.rescheduleTask(task);
      }
      return;
    }
    this.isProcessingScheduledAction = true;
    setAgentState({ isIdle: false });
    logger.info(`Running scheduled task ${task.id}: "${task.description.slice(0,50)}..."`);
    try {
      const nowMsUpdate = Date.now();
      await this.db.update(scheduledTasks)
        .set({ lastRunTime: nowMsUpdate, updatedAt: nowMsUpdate })
        .where(eq(scheduledTasks.id, task.id));

      if (task.type === 'runloop') {
        logger.info(`Runloop task ${task.id} triggered. Attempting to process next agent task.`);
        const taskManager = TaskManager.getInstance();
        await taskManager.processNextTaskIfIdle();
      } else {
        await triggerAgentProcessing(task.description, task.id);
      }

      if (task.type === 'once') {
        const nowMs2 = Date.now();
        await this.db.update(scheduledTasks)
          .set({ status: 'completed', updatedAt: nowMs2 })
          .where(eq(scheduledTasks.id, task.id));
        logger.info(`Once task ${task.id} completed.`);
      }
    } catch (error) {
      logger.error(`Error executing scheduled task ${task.id}:`, error);
      const nowMsErr = Date.now();
      await this.db.update(scheduledTasks)
        .set({ status: 'error', failReason: error instanceof Error ? error.message : String(error), updatedAt: nowMsErr })
        .where(eq(scheduledTasks.id, task.id));
    } finally {
      if (task.type === 'recurring' || task.type === 'interval' || task.type === 'runloop') {
        await this.rescheduleTask(task);
      }
      this.isProcessingScheduledAction = false;
    }
  }

  /** Recalculate and persist the next run time */
  private async rescheduleTask(task: ScheduledTask): Promise<void> {
    const taskForCalc: Pick<ScheduledTask, 'id' | 'type' | 'schedule' | 'nextRunTime' | 'status'> = {
        id: task.id,
        type: task.type,
        schedule: task.schedule,
        nextRunTime: typeof task.nextRunTime === 'number' ? task.nextRunTime : new Date(task.nextRunTime).getTime(),
        status: task.status,
    };
    const nextMs = this.calculateNextRunTime(taskForCalc);
    if (nextMs > 0) {
      try {
        const nowMsResched = Date.now();
        const [updated] = await this.db.update(scheduledTasks)
          .set({ nextRunTime: nextMs, updatedAt: nowMsResched })
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
    updates: Partial<Omit<ScheduledTask, 'id' | 'createdAt'>>
  ): Promise<ScheduledTask | null> {
    const nowMs = Date.now();
    const current = await this.db.query.scheduledTasks.findFirst({ where: eq(scheduledTasks.id, id) });
    if (!current) return null;

    const currentNextRunTimeNumber = typeof current.nextRunTime === 'number' ? current.nextRunTime : new Date(current.nextRunTime).getTime();
    let updatesNextRunTimeNumber: number | undefined = undefined;
    if (updates.nextRunTime !== undefined) {
        updatesNextRunTimeNumber = typeof updates.nextRunTime === 'number' ? updates.nextRunTime : new Date(updates.nextRunTime).getTime();
    }

    const taskStateForCalc: Pick<ScheduledTask, 'id' | 'type' | 'schedule' | 'nextRunTime' | 'status'> = {
      id: current.id,
      type: updates.type ?? current.type,
      schedule: updates.schedule ?? current.schedule,
      nextRunTime: updatesNextRunTimeNumber ?? currentNextRunTimeNumber,
      status: updates.status ?? current.status,
    };
    
    let finalNextRunTime = taskStateForCalc.nextRunTime;

    if (updates.schedule || updates.type || (updates.status === 'active' && current.status !== 'active')) {
      finalNextRunTime = this.calculateNextRunTime(taskStateForCalc);
      if (finalNextRunTime === 0 && taskStateForCalc.type !== 'once') {
        throw new Error('Invalid next run time for updated schedule');
      }
    }
    
    const dbUpdates: Partial<NewScheduledTask> = { ...updates };
    dbUpdates.updatedAt = nowMs;
    if (finalNextRunTime !== undefined) {
        dbUpdates.nextRunTime = typeof finalNextRunTime === 'number' ? finalNextRunTime : new Date(finalNextRunTime).getTime();
    }

    if (updates.lastRunTime !== undefined) {
        dbUpdates.lastRunTime = typeof updates.lastRunTime === 'number' ? updates.lastRunTime : new Date(updates.lastRunTime).getTime();
    }

    delete dbUpdates.id;
    delete dbUpdates.createdAt;

    const [updated] = await this.db.update(scheduledTasks)
      .set(dbUpdates)
      .where(eq(scheduledTasks.id, id))
      .returning();

    if (updated) {
        this.scheduleNextRun(updated);
    }
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