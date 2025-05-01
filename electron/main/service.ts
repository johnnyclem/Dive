import { app } from "electron"
import path from "node:path"
import fse from "fs-extra"
import dotenv from "dotenv"
import defaultModelsRaw from "../main/default-models.json"

// Load environment variables first, before any other initialization
dotenv.config()

import { MCPClient, WebServer, initDatabase } from "../../services/index.js"
import { DatabaseMode, getDB } from "../../services/database/index.js"
import { migrate } from "drizzle-orm/better-sqlite3/migrator"
import { compareFilesAndReplace, isPortInUse, npmInstall } from "./util.js"
import { SystemCommandManager } from "../../services/syscmd/index.js"
import { MCPServerManager } from "../../services/mcpServer/index.js"
import { scriptsDir, configDir, appDir, DEF_MCP_SERVER_CONFIG } from "./constant.js"

// Type for bundled default models config
interface DefaultModels {
  configs: Record<string, unknown>
  activeProvider: string
  enable_tools?: boolean
  enableTools?: boolean
}

// Cast raw JSON to typed interface
const defaultModels: DefaultModels = defaultModelsRaw as DefaultModels

export let client: Promise<MCPClient> | null = null
async function initClient(): Promise<MCPClient> {
  // create dirs
  fse.mkdirSync(configDir, { recursive: true })
  fse.mkdirSync(appDir, { recursive: true })

  await migratePrebuiltScripts().catch(console.error)

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

  // create model config file if not exists from bundled defaults
  const modelConfigPath = path.join(configDir, "model.json")
  if (!fse.existsSync(modelConfigPath)) {
    const defaultConfig = {
      activeProvider: defaultModels.activeProvider,
      enableTools: defaultModels.enable_tools ?? defaultModels.enableTools ?? true,
      configs: defaultModels.configs
    }
    fse.writeFileSync(modelConfigPath, JSON.stringify(defaultConfig, null, 2), "utf-8")
  }

  initDb(configDir)

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
  initDatabase(DatabaseMode.DIRECT, { dbPath: path.join(configDir, "data.db") })
  const db = getDB()
  // Determine migrations folder: external Resources folder in production, project root in development
  const migrationsFolder = app.isPackaged
    ? path.join(process.resourcesPath, "drizzle")
    : path.join(process.cwd(), "drizzle")
  migrate(db, { migrationsFolder })
  return db
}

async function getFreePort(): Promise<number> {
  // Prefer 4321 which is the Vite proxy target for API calls
  const defaultPort = 4321
  const isDefaultPortInUse = await isPortInUse(defaultPort)
  if (!isDefaultPortInUse) {
    return defaultPort
  }

  const secondPort = 6190 // fallback if 4321 is already taken (unlikely)
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
  try {
    client = initClient()
    port = initService()
  } catch (error) {
    console.error("Failed to initialize MCP client:", error)
  }
}

export async function cleanup() {
  await MCPServerManager.getInstance().disconnectAllServers();
}

async function migratePrebuiltScripts() {
  // copy scripts
  const rebuiltScriptsPath = path.join(app.isPackaged ? process.resourcesPath : process.cwd(), "prebuilt/scripts")
  if(!fse.existsSync(scriptsDir)) {
    fse.mkdirSync(scriptsDir, { recursive: true })
    fse.copySync(rebuiltScriptsPath, scriptsDir)
  }

  // update prebuilt scripts
  compareFilesAndReplace(path.join(rebuiltScriptsPath, "echo.js"), path.join(scriptsDir, "echo.js"))

  // install dependencies for prebuilt scripts
  await npmInstall(scriptsDir).catch(console.error)
  await npmInstall(scriptsDir, ["install", "express", "cors"]).catch(console.error)

  // remove echo.cjs
  if (fse.existsSync(path.join(scriptsDir, "echo.cjs"))) {
    fse.unlinkSync(path.join(scriptsDir, "echo.cjs"))
  }
}