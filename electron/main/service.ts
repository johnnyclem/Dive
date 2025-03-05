import { app } from "electron"
import path from "node:path"
import fse from "fs-extra"
import { MCPClient, WebServer, setDatabase } from "../../services/index.js"
import { drizzle } from "drizzle-orm/better-sqlite3"
import Database from "better-sqlite3"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import * as schema from "../../services/database/schema.js"
import { isPortInUse, npmInstall } from "./util.js"
import { SystemCommandManager } from "../../services/syscmd/index.js"
import { MCPServerManager } from "../../services/mcpServer/index.js"
import { scriptsDir, configDir, appDir, DEF_MCP_SERVER_CONFIG } from "./constant.js"

export let client: Promise<MCPClient> | null = null
async function initClient(): Promise<MCPClient> {
  // create dirs
  fse.mkdirSync(configDir, { recursive: true })
  fse.mkdirSync(appDir, { recursive: true })

  // copy scripts
  if(!fse.existsSync(scriptsDir)) {
    fse.mkdirSync(scriptsDir, { recursive: true })
    const source = path.join(app.isPackaged ? process.resourcesPath : process.cwd(), "prebuilt/scripts")
    fse.copySync(source, scriptsDir)
  }

  // install dependencies for prebuilt scripts
  await npmInstall(scriptsDir).catch(console.error)

  // create config file if not exists
  const mcpServerConfigPath = path.join(configDir, "config.json")
  if (!fse.existsSync(mcpServerConfigPath)) {
    fse.writeFileSync(mcpServerConfigPath, JSON.stringify(DEF_MCP_SERVER_CONFIG, null, 2));
  }

  // create custom rules file if not exists
  const customRulesPath = path.join(configDir, ".customrules")
  if (!fse.existsSync(customRulesPath)) {
    fse.writeFileSync(customRulesPath, "")
  }

  // init sqlite
  const db = initDb(configDir)
  setDatabase(db as any)

  // init mcp client
  const _client = new MCPClient({
    modelConfigPath: path.join(configDir, "model.json"),
    mcpServerConfigPath: mcpServerConfigPath,
    customRulesPath: customRulesPath,
  })

  // init system command manager and set command path if needed
  const systemCommandManager = SystemCommandManager.getInstance()
  systemCommandManager.initialize(process.platform === "win32" && app.isPackaged ? {
    "npx": path.join(process.resourcesPath, "node", "npx.cmd"),
    "npm": path.join(process.resourcesPath, "node", "npm.cmd"),
  } : {})

  return _client
}

function initDb(configDir: string) {
  const dbPath = path.join(configDir, "data.db")
  const sqlite = new Database(dbPath)
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: app.isPackaged ? path.join(process.resourcesPath, "drizzle") : "./drizzle" })
  return db
}

async function getFreePort(): Promise<number> {
  const defaultPort = 61990
  const isDefaultPortInUse = await isPortInUse(defaultPort)
  if (!isDefaultPortInUse) {
    return defaultPort
  }

  const secondPort = 6190
  const isSecondPortInUse = await isPortInUse(secondPort)
  if (!isSecondPortInUse) {
    return secondPort
  }

  return 0
}

export let port = Promise.resolve(0)
async function initService(): Promise<number> {
  const _client = await client!
  await _client.init().catch(console.error)
  const server = new WebServer(_client)
  await server.start(await getFreePort())
  return server.port!
}

export async function initMCPClient() {
  client = initClient()
  port = initService()
}

export async function cleanup() {
  await MCPServerManager.getInstance().disconnectAllServers();
}
