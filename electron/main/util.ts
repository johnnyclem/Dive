import net from "node:net"
import path from "node:path"
import { spawn } from "cross-spawn"
import { app } from "electron"
import fs from "fs"

export function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          resolve(true)
        }
      })
      .once("listening", () => {
        server.close()
        resolve(false)
      })
      .listen(port)
  })
}

export function npmInstall(targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const npm = process.platform === "win32"
      ? (app.isPackaged ? path.join(process.resourcesPath, "node", "npm.cmd") : "npm.cmd")
      : "npm"

    const installation = spawn(npm, ["install"], {
      cwd: targetPath,
      stdio: "inherit",
      shell: process.platform === "darwin",
      windowsHide: true,
      windowsVerbatimArguments: true
    })

    installation.on("close", (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`npm install failed with code: ${code}`))
      }
    })

    installation.on("error", (err) => {
      reject(err)
    })
  })
}

export function modifyPath(customBinPath: string) {
  const connector = process.platform === "win32" ? ";" : ":"
  process.env.PATH = `${customBinPath}${connector}${process.env.PATH}`
}

export function setNodePath() {
  process.env.NODE_PATH = path.join(process.resourcesPath, "node", "node_modules")
}

export function getNvmPath(): string {
  const home = process.env.HOME
  if (!home) return ""

  const nvmPath = path.join(home, ".nvm", "versions", "node")

  try {
    if (fs.existsSync(nvmPath)) {
      const currentVersion = fs.readdirSync(nvmPath)
        .filter(dir => dir.startsWith("v"))
        .sort()
        .pop()

      if (currentVersion) {
        return path.join(nvmPath, currentVersion, "bin")
      }
    }
  } catch (error) {
    console.error("Error getting NVM path:", error)
  }

  return ""
}

export function getLatestVersion(): Promise<string> {
  return fetch("https://api.github.com/repos/OpenAgentPlatform/Dive/releases/latest")
    .then(res => res.json())
    .then(data => data.tag_name.slice(1))
}
