import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
});

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  role: text("role").notNull(),
  chatId: text("chat_id").notNull(),
  messageId: text("message_id").notNull(),
  createdAt: text("created_at").notNull(),
  files: text("files", { mode: "json" }).notNull(),
});

export const knowledgeBases = sqliteTable('knowledge_bases', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const agentTasks = sqliteTable("agent_tasks", {
  id: text("id").primaryKey(),             // UUID for the task
  description: text("description").notNull(), // Detailed description of the task (can be the prompt for the LLM)
  status: text("status").notNull().default('pending'), // 'pending', 'in_progress', 'completed', 'failed'
  sequence: integer("sequence").notNull(), // Integer for ordering tasks (higher number = executed later)
  createdAt: integer("created_at", { mode: 'timestamp_ms' }).notNull(), // Timestamp in milliseconds
  updatedAt: integer("updated_at", { mode: 'timestamp_ms' }).notNull(), // Timestamp in milliseconds
  resultSummary: text("result_summary"),   // Optional: Brief summary of the task outcome
  failReason: text("fail_reason"),         // Optional: Reason if status is 'failed'
  // Add context fields if needed later, e.g., context: text("context", { mode: "json" })
});

// export types
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
export type AgentTask = typeof agentTasks.$inferSelect;
export type NewAgentTask = typeof agentTasks.$inferInsert;
