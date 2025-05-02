import { ipcMain } from 'electron';
import * as logging from './logging';
import { TaskManager } from '../../../services/agent/taskManager.js';

/**
 * Sets up the IPC handlers for Agent Task management.
 */
export function setupTaskHandlers() {
  logging.info('Setting up task management IPC handlers');

  // List tasks: optional status ('pending', 'in_progress', 'all')
  ipcMain.handle('tasks:list', async (_event, status?: string) => {
    try {
      const tm = TaskManager.getInstance();
      let tasks;
      if (status === 'all') {
        tasks = await tm.getAllTasks();
      } else {
        tasks = await tm.getActiveTasks();
        if (status === 'pending' || status === 'in_progress') {
          tasks = tasks.filter(t => t.status === status);
        }
      }
      return tasks;
    } catch (error) {
      logging.error(`tasks:list error: ${error}`);
      throw error;
    }
  });

  // Add a new task
  ipcMain.handle('tasks:add', async (_event, description: string) => {
    try {
      if (!description) throw new Error('Description is required');
      const tm = TaskManager.getInstance();
      const task = await tm.addTask(description);
      return task;
    } catch (error) {
      logging.error(`tasks:add error: ${error}`);
      throw error;
    }
  });

  // Complete a task
  ipcMain.handle('tasks:complete', async (_event, id: string, resultSummary?: string) => {
    try {
      const tm = TaskManager.getInstance();
      await tm.handleTaskCompletion(id, resultSummary);
      return { success: true };
    } catch (error) {
      logging.error(`tasks:complete error: ${error}`);
      throw error;
    }
  });

  // Fail a task
  ipcMain.handle('tasks:fail', async (_event, id: string, reason: string) => {
    try {
      const tm = TaskManager.getInstance();
      await tm.handleTaskFailure(id, reason);
      return { success: true };
    } catch (error) {
      logging.error(`tasks:fail error: ${error}`);
      throw error;
    }
  });
} 