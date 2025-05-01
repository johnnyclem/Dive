import { app } from "electron"
import envPaths from "env-paths"
import os from "os"
import path from "path"

export const envPath = envPaths(app.getName(), {suffix: ""})
export const configDir = envPath.config
export const cacheDir = envPath.cache
export const homeDir = os.homedir()
export const appDir = path.join(homeDir, ".souls")
export const scriptsDir = path.join(appDir, "scripts")

export const binDirList = [
  path.join(process.resourcesPath, "node"),
  path.join(process.resourcesPath, "uv"),
  path.join(process.resourcesPath, "python"),
]

export const darwinPathList = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
]

export const DEF_MCP_SERVER_CONFIG = {
  "mcpServers": {
    "thirdweb-mcp": {
      "command": "uvx",
      "args": [
        "thirdweb-mcp"
      ],
      "env": {
        "THIRDWEB_SECRET_KEY": "your thirdweb secret key from dashboard",
        "THIRDWEB_ENGINE_URL": "(OPTIONAL) your engine url",
        "THIRDWEB_ENGINE_AUTH_JWT": "(OPTIONAL) your engine auth jwt",
        "THIRDWEB_ENGINE_BACKEND_WALLET_ADDRESS": "(OPTIONAL) your engine backend wallet address"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "~/Desktop"
      ],
    },
    "mcpollinations": {
      "command": "npx",
      "args": [
        "-y",
        "@pinkpixel/mcpollinations"
      ]
    },
    "fetch": {
      "command": "uvx",
      "args": [
        "mcp-server-fetch"
      ]
    },
    "edgeone-pages-mcp-server": {
      "command": "npx",
      "args": [
        "edgeone-pages-mcp"
      ],
    },
    "coincap": {
      "command": "npx",
      "args": [
        "coincap-mcp"
      ],
    },
    "apple-shortcuts": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-server-apple-shortcuts"
      ]
    }
  }
}
