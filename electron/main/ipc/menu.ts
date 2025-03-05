import { ipcMain } from "electron"
import { Menu } from "electron"

const selectionMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { role: "selectAll" }
])

const inputMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { role: "paste" },
  { role: "cut" },
  { role: "selectAll" }
])

export function ipcMenuHandler() {
  ipcMain.handle("show-selection-context-menu", () => {
    selectionMenu.popup()
  })

  ipcMain.handle("show-input-context-menu", () => {
    inputMenu.popup()
  })
}