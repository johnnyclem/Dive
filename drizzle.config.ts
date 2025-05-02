import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './services/database/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL || './.souls/database.db',
  },
  verbose: true,
  strict: true,
}); 