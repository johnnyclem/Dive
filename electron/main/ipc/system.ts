import { app, ipcMain, shell } from "electron"
import { scriptsDir } from "../constant"
import { store } from "../store"

import {
  checkAppImageAutoLaunchStatus,
  setAppImageAutoLaunch,
} from "../platform/appimage"

export function ipcSystemHandler() {
  ipcMain.handle("system:openScriptsDir", async () => {
    shell.openPath(scriptsDir)
  })

  ipcMain.handle("system:getAutoLaunch", () => {
    if (process.env.APPIMAGE) {
      return checkAppImageAutoLaunchStatus()
    }

    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle("system:setAutoLaunch", (event, enable) => {
    store.set("autoLaunch", enable)

    if (process.env.APPIMAGE) {
      setAppImageAutoLaunch(enable)
    } else {
      app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: false,
      })
    }

    return enable
  })
}
