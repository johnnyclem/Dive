import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initDatabase, DatabaseMode } from '../services/database/index';
import { TaskManager } from '../services/agent/taskManager';

describe('Agent TaskManager E2E', () => {
  const testDbPath = path.resolve(__dirname, '../test_agent_tasks.sqlite');

  beforeAll(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    const rawDb = new Database(testDbPath);
    const migrationsDir = path.resolve(__dirname, '../drizzle');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.includes('0001_add_agent_tasks.sql'));
    for (const file of files) rawDb.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
    rawDb.close();
    initDatabase(DatabaseMode.DIRECT, { dbPath: testDbPath });
  });

  afterAll(() => { if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath); });

  beforeEach(() => {
    // Reset TaskManager singleton
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TaskManager.instance = undefined as unknown as TaskManager;
    // Clear existing tasks before each test
    const rawDb = new Database(testDbPath);
    rawDb.exec('DELETE FROM agent_tasks');
    rawDb.close();
  });

  it('adds and lists tasks', async () => {
    const tm = TaskManager.getInstance();
    const added = await tm.addTask('Test E2E');
    expect(added.description).toBe('Test E2E');
    const tasks = await tm.getActiveTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(added.id);
  });

  it('completes tasks sequentially', async () => {
    const tm = TaskManager.getInstance();
    const t1 = await tm.addTask('First');
    const t2 = await tm.addTask('Second');
    let tasks = await tm.getActiveTasks();
    expect(tasks.map(t => t.sequence)).toEqual([1,2]);
    await tm.handleTaskCompletion(t1.id, 'done1');
    tasks = await tm.getActiveTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe(t2.id);
  });

  it('persists tasks across instances', async () => {
    const tm1 = TaskManager.getInstance();
    const t = await tm1.addTask('Persist');
    // Reset singleton for restart test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TaskManager.instance = undefined as unknown as TaskManager;
    const tm2 = TaskManager.getInstance();
    const all = await tm2.getAllTasks();
    expect(all.some(x => x.id === t.id)).toBe(true);
  });
}); 