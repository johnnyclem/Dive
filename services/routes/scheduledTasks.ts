import express from "express";
import { SchedulerService } from "../agent/schedulerService.js";

export function scheduledTasksRouter() {
  const router = express.Router();
  const scheduler = SchedulerService.getInstance();

  // GET /api/scheduled-tasks - list all tasks
  router.get("/", [async (req, res) => {
    try {
      const tasks = await scheduler.getAllScheduledTasks();
      res.json({ success: true, tasks });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  }]);

  // POST /api/scheduled-tasks - create a new scheduled task
  router.post("/", [async (req, res) => {
    try {
      const { description, type, schedule } = req.body;
      if (!description || !type || !schedule) {
        return res.status(400).json({ success: false, message: "description, type, and schedule are required" });
      }
      const newTask = await scheduler.addScheduledTask(description, type, schedule, 'user');
      res.status(201).json({ success: true, task: newTask });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  }]);

  // PUT /api/scheduled-tasks/:id - update a scheduled task
  router.put("/:id", [async (req, res) => {
    try {
      const taskId = req.params.id;
      const updates = req.body;
      const updated = await scheduler.updateScheduledTask(taskId, updates);
      if (updated) {
        res.json({ success: true, task: updated });
      } else {
        res.status(404).json({ success: false, message: "Task not found" });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  }]);

  // DELETE /api/scheduled-tasks/:id - delete a scheduled task
  router.delete("/:id", [async (req, res) => {
    try {
      const taskId = req.params.id;
      await scheduler.deleteScheduledTask(taskId);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  }]);

  return router;
} 