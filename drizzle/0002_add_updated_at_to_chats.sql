-- Add updated_at column to chats table
ALTER TABLE chats ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP; 