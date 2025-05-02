import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { initDatabase, DatabaseMode } from '../database/index.js';
import { TaskManager } from '../agent/taskManager.js';
import { describe, beforeAll, afterAll, beforeEach, it, expect } from 'vitest';

describe('Agent TaskManager E2E', () => {
  const testDbPath = path.resolve(__dirname, '../../test_agent_tasks.sqlite');

  beforeAll(() => {
    // Remove existing test DB
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Create raw SQLite DB and apply migrations
    const rawDb = new Database(testDbPath);
    const migrationsDir = path.resolve(__dirname, '../../drizzle');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      rawDb.exec(sql);
    }
    rawDb.close();

    // Initialize Drizzle ORM with the test database
    initDatabase(DatabaseMode.DIRECT, { dbPath: testDbPath });
  });

  afterAll(() => {
    // Cleanup test DB file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  beforeEach(() => {
    // @ts-expect-error: resetting singleton for restart test
    TaskManager.instance = undefined;
  });

  it('should add and list tasks', async () => {
    const tm = TaskManager.getInstance();
    const added = await tm.addTask('Write unit tests');
    expect(added.description).toBe('Write unit tests');

    const tasks = await tm.getActiveTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe(added.id);
  });

  it('should complete tasks in sequence', async () => {
    const tm = TaskManager.getInstance();
    const t1 = await tm.addTask('First task');
    const t2 = await tm.addTask('Second task');

    let tasks = await tm.getActiveTasks();
    expect(tasks.map(t => t.sequence)).toEqual([1, 2]);

    // Complete first task
    await tm.handleTaskCompletion(t1.id, 'Done');
    tasks = await tm.getActiveTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0].id).toBe(t2.id);

    // Complete second task
    await tm.handleTaskCompletion(t2.id, 'Done second');
    tasks = await tm.getActiveTasks();
    expect(tasks.length).toBe(0);
  });

  it('should persist tasks across TaskManager restarts', async () => {
    // Add a new task
    const tm1 = TaskManager.getInstance();
    const t = await tm1.addTask('Persistent task');

    // Reset singleton and create new instance
    // @ts-expect-error: resetting singleton for restart test
    TaskManager.instance = undefined;
    const tm2 = TaskManager.getInstance();

    // The task should persist across instances
    const all = await tm2.getAllTasks();
    expect(all.some(task => task.id === t.id)).toBe(true);
  });
}); 