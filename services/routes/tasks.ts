import express from "express";
import { TaskManager } from "../agent/taskManager.js";

export function tasksRouter() {
  const router = express.Router();

  // List tasks; optional status query: 'pending', 'in_progress', or 'all'
  router.get("/", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const tm = TaskManager.getInstance();
      let tasks;
      if (status === "all") {
        tasks = await tm.getAllTasks();
      } else {
        tasks = await tm.getActiveTasks();
        if (status === "pending" || status === "in_progress") {
          tasks = tasks.filter(t => t.status === status);
        }
      }
      res.json({ success: true, tasks });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  });

  // Add a new task
  router.post("/", async (req, res) => {
    try {
      const { description } = req.body;
      if (!description) {
        res.status(400).json({ success: false, message: "Description is required" });
        return;
      }
      const tm = TaskManager.getInstance();
      const task = await tm.addTask(description);
      res.json({ success: true, task });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  });

  // Mark a task as completed
  router.post("/:id/complete", async (req, res) => {
    try {
      const { id } = req.params;
      const { resultSummary } = req.body;
      const tm = TaskManager.getInstance();
      await tm.handleTaskCompletion(id, resultSummary);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  });

  // Mark a task as failed
  router.post("/:id/fail", async (req, res) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const tm = TaskManager.getInstance();
      await tm.handleTaskFailure(id, reason);
      res.json({ success: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, message });
    }
  });

  return router;
} 