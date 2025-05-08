import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initDatabase, DatabaseMode } from '../services/database/index.js';
import { SchedulerService } from '../services/agent/schedulerService.js';
import { TaskManager } from '../services/agent/taskManager.js';
import { vi } from 'vitest';

const TEST_DB = path.resolve(__dirname, 'test_scheduler_tasks.sqlite');
const MIGRATIONS_DIR = path.resolve(__dirname, '../drizzle');

describe('SchedulerService E2E', () => {
  beforeAll(() => {
    // Remove existing test DB
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
    const rawDb = new Database(TEST_DB);
    // Apply all SQL migrations in order
    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      rawDb.exec(sql);
    }
    rawDb.close();

    initDatabase(DatabaseMode.DIRECT, { dbPath: TEST_DB });
  });

  afterAll(() => {
    if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
  });

  beforeEach(() => {
    // Reset singleton and clear scheduled_tasks table
    // @ts-expect-error: reset private instance for testing
    SchedulerService.instance = undefined;
    const rawDb = new Database(TEST_DB);
    rawDb.exec('DELETE FROM scheduled_tasks');
    rawDb.close();
  });

  it('adds and lists tasks', async () => {
    const service = SchedulerService.getInstance();
    const added = await service.addScheduledTask(
      'E2E test once',
      'once',
      new Date(Date.now() + 1000).toISOString(),
      'user'
    );
    expect(added.description).toBe('E2E test once');
    const all = await service.getAllScheduledTasks();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(added.id);
  });

  it('updates a task', async () => {
    const service = SchedulerService.getInstance();
    const iso = new Date(Date.now() + 2000).toISOString();
    const task = await service.addScheduledTask('To update', 'once', iso);
    const newDesc = 'Updated description';
    const updated = await service.updateScheduledTask(task.id, { description: newDesc });
    expect(updated).not.toBeNull();
    expect(updated!.description).toBe(newDesc);
  });

  it('deletes a task', async () => {
    const service = SchedulerService.getInstance();
    const task = await service.addScheduledTask(
      'To delete',
      'once',
      new Date(Date.now() + 3000).toISOString()
    );
    const del = await service.deleteScheduledTask(task.id);
    expect(del).toBe(true);
    const remaining = await service.getAllScheduledTasks();
    expect(remaining).toHaveLength(0);
  });

  it('returns active tasks only', async () => {
    const service = SchedulerService.getInstance();
    // Add one once (future) and one paused recurring
    const onceTask = await service.addScheduledTask(
      'Future once',
      'once',
      new Date(Date.now() + 4000).toISOString()
    );
    const recTask = await service.addScheduledTask(
      'Recurring',
      'interval',
      '10',
      'user'
    );
    // Pause the recurring
    await service.updateScheduledTask(recTask.id, { status: 'paused' });
    const active = await service.getActiveScheduledTasks();
    expect(active.map(t => t.id)).toEqual([onceTask.id]);
  });

  it('adds and processes a runloop task', async () => {
    const service = SchedulerService.getInstance();
    const taskManager = TaskManager.getInstance(); // Get TaskManager instance

    // Mock processNextTaskIfIdle
    const mockProcessNextTask = vi.spyOn(taskManager, 'processNextTaskIfIdle').mockResolvedValue(undefined);

    const intervalSeconds = 1; // Run every 1 second for testing
    const description = 'E2E test runloop';    

    // Add a runloop task scheduled to run almost immediately
    const addedRunloopTask = await service.addScheduledTask(
      description,
      'runloop',
      String(intervalSeconds), // schedule is interval in seconds
      'user'
    );

    expect(addedRunloopTask.description).toBe(description);
    expect(addedRunloopTask.type).toBe('runloop');
    expect(addedRunloopTask.schedule).toBe(String(intervalSeconds));

    // Wait for a bit longer than the interval to ensure it has a chance to run
    await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000 + 500));

    // Check if processNextTaskIfIdle was called
    // Due to the nature of setTimeout and event loop, it might be called multiple times
    expect(mockProcessNextTask).toHaveBeenCalled();

    // Check if the task was rescheduled (its nextRunTime should be in the future)
    const updatedTask = await service.getAllScheduledTasks().then(tasks => tasks.find(t => t.id === addedRunloopTask.id));
    expect(updatedTask).toBeDefined();
    // nextRunTime is number (timestamp)
    // Ensure both are numbers before comparison to satisfy TypeScript
    const updatedNextRunTime = typeof updatedTask!.nextRunTime === 'number' ? updatedTask!.nextRunTime : new Date(updatedTask!.nextRunTime).getTime();
    const addedNextRunTime = typeof addedRunloopTask.nextRunTime === 'number' ? addedRunloopTask.nextRunTime : new Date(addedRunloopTask.nextRunTime).getTime();
    expect(updatedNextRunTime).toBeGreaterThan(addedNextRunTime);

    // Clean up
    mockProcessNextTask.mockRestore();
    await service.deleteScheduledTask(addedRunloopTask.id);
    service.shutdown(); // ensure timers are cleared
  }, { timeout: 5000 }); // Increase timeout for this test due to setTimeout
}); 