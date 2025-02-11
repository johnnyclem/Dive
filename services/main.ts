import dotenv from "dotenv";
import { MCPCliClient } from "./client.js";
import logger from "./utils/logger.js";
import { initDatabase } from "./database/index.js";
import { SystemCommandManager } from "./syscmd/index.js";

dotenv.config();

// Main execution logic
async function main() {
  let client: MCPCliClient | null = null;
  try {
    const systemCommandManager = SystemCommandManager.getInstance();
    systemCommandManager.initialize({
      node: process.execPath,
    });

    client = new MCPCliClient();
    await client.init();

    initDatabase();

    // Create and start Web server
    const { WebServer } = await import("./webServer.js");
    const webServer = new WebServer(client);
    await webServer.start(4321);

    // Keep command line interface
    await client.chatLoop();
  } catch (error) {
    logger.error("Error:", error);
    await client?.cleanup();
    process.exit(1);
  }
}

main();
