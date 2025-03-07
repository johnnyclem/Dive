import { app, ipcMain, shell } from "electron"
import { scriptsDir } from "../constant"
import { store } from "../store"

export function ipcSystemHandler() {
  ipcMain.handle("system:openScriptsDir", async () => {
    shell.openPath(scriptsDir)
  })

  ipcMain.handle("system:getAutoLaunch", () => {
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle("system:setAutoLaunch", (event, enable) => {
    store.set("autoLaunch", enable)

    app.setLoginItemSettings({
      openAtLogin: enable,
      openAsHidden: false
    })

    return enable
  })
}
