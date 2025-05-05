import dotenv from "dotenv";
import { MCPCliClient } from "./client.js";
import logger from "./utils/logger.js";
import { DatabaseMode, initDatabase, getDatabaseMode } from "./database/index.js";
import { SystemCommandManager } from "./syscmd/index.js";
import { registerENSServer } from "./mcpServer/ensServer.js";
import { execSync } from 'child_process';
import { SchedulerService } from './agent/schedulerService.js';

dotenv.config();

// Main execution logic
async function main() {
  let client: MCPCliClient | null = null;

  logger.info(`[Server Start Info]--------------------------------`);
  logger.info(`[Offline Mode]: ${process.env.OFFLINE_MODE === "true"}`);
  if (process.env.OFFLINE_MODE === "true") {
    logger.info(`[File Upload]: Local-Filepath or Upload-File are supported`);
  } else {
    logger.info(`[File Upload]: Not supported on ONLINE MODE currently`);
  }
  logger.info(`[Database Mode]: ${process.env.DATABASE_MODE}`);

  if (process.env.DATABASE_MODE?.toLocaleLowerCase() === DatabaseMode.DIRECT) {
    logger.info(`[Database Local Path]: ${process.env.DATABASE_LOCAL_PATH}`);
  }
  if (process.env.DATABASE_MODE?.toLocaleLowerCase() === DatabaseMode.API) {
    logger.info(`[Database API URL]: ${process.env.DATABASE_API_URL}`);
  }
  logger.info(`[Server Start Info]--------------------------------`);

  try {
    const systemCommandManager = SystemCommandManager.getInstance();
    systemCommandManager.initialize({
      node: process.execPath,
    });

    client = new MCPCliClient();
    await client.init();

    initDatabase(
      process.env.DATABASE_MODE?.toLocaleLowerCase() === DatabaseMode.API ? DatabaseMode.API : DatabaseMode.DIRECT,
      {
        dbPath: process.env.DATABASE_LOCAL_PATH,
        apiUrl: process.env.DATABASE_API_URL,
      }
    );

    // Apply database migrations in direct database mode
    if (getDatabaseMode() === DatabaseMode.DIRECT) {
      logger.info('Running database migrations via "npm run migrate:db"...');
      try {
        execSync('npm run migrate:db', { stdio: 'inherit' });
        logger.info('Database migrations applied successfully.');
      } catch (err) {
        logger.error('Database migration failed:', err);
        logger.error('You can manually run migrations with `npm run migrate:db`.');
        process.exit(1);
      }
    } else {
      logger.info('Skipping database migrations: API database mode.');
    }

    // Initialize the SchedulerService
    const scheduler = SchedulerService.getInstance();
    await scheduler.initialize();

    // Register the ENS utility server
    registerENSServer();

    // Create and start Web server
    const { WebServer } = await import("./webServer.js");
    const webServer = new WebServer(client);
    await webServer.start(4321);

    // Keep command line interface
    await client.chatLoop();

    // Shutdown scheduler when CLI exits
    scheduler.shutdown();
  } catch (error) {
    logger.error("Error:", error);
    await client?.cleanup();
    process.exit(1);
  }
}

main();
