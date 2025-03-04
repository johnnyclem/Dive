import { app } from "electron"
import path from "node:path"
import fse from "fs-extra"
import { MCPClient, WebServer, initDatabase } from "../../services/index.js"
import { DatabaseMode, getDB } from "../../services/database/index.js"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { isPortInUse, npmInstall } from "./util.js"
import { SystemCommandManager } from "../../services/syscmd/index.js"
import { MCPServerManager } from "../../services/mcpServer/index.js"
import { scriptsDir, configDir, appDir, DEF_MCP_SERVER_CONFIG } from "./constant.js"

export let client: Promise<MCPClient> | null = null
async function initClient(): Promise<MCPClient> {
  fse.mkdirSync(configDir, { recursive: true })
  fse.mkdirSync(appDir, { recursive: true })

  if(!fse.existsSync(scriptsDir)) {
    fse.mkdirSync(scriptsDir, { recursive: true })
    const source = path.join(app.isPackaged ? process.resourcesPath : process.cwd(), "prebuilt/scripts")
    fse.copySync(source, scriptsDir)
  }

  await npmInstall(scriptsDir).catch(console.error)

  const mcpServerConfigPath = path.join(configDir, "config.json")
  if (!fse.existsSync(mcpServerConfigPath)) {
    fse.writeFileSync(mcpServerConfigPath, JSON.stringify(DEF_MCP_SERVER_CONFIG, null, 2));
  }

  const customRulesPath = path.join(configDir, ".customrules")
  if (!fse.existsSync(customRulesPath)) {
    fse.writeFileSync(customRulesPath, "")
  }

  initDb(configDir)

  const _client = new MCPClient({
    modelConfigPath: path.join(configDir, "model.json"),
    mcpServerConfigPath: mcpServerConfigPath,
    customRulesPath: customRulesPath,
  })

  const systemCommandManager = SystemCommandManager.getInstance()
  systemCommandManager.initialize(process.platform === "win32" && app.isPackaged ? {
    // "node": path.join(process.resourcesPath, "node", "node.exe"),
    "npx": path.join(process.resourcesPath, "node", "npx.cmd"),
    "npm": path.join(process.resourcesPath, "node", "npm.cmd"),
  } : {})

  return _client
}

function initDb(configDir: string) {
  initDatabase(DatabaseMode.DIRECT, { dbPath: path.join(configDir, "data.db") })
  const db = getDB()
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
export let server: WebServer | null = null
async function initService(): Promise<number> {
  const _client = await client!
  await _client.init().catch(console.error)
  server = new WebServer(_client)
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
