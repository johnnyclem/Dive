import { ipcMain, shell } from "electron"
import { scriptsDir } from "../constant"

export function ipcSystemHandler() {
  ipcMain.handle("system:openScriptsDir", async () => {
    shell.openPath(scriptsDir)
  })
}
