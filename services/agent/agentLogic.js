import logger from "../utils/logger.js";

export function triggerNextTaskProcessing(task) {
  logger.info(`Triggering LLM processing for next task: ${task.id}`);
  // TODO: Implement actual LLM invocation using task.description
} 