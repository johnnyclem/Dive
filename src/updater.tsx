import { useCallback, useEffect } from "react"
import { useSetAtom } from "jotai"
import { newVersionAtom } from "./atoms/globalState"

export default function Updater() {
  const setNewVersion = useSetAtom(newVersionAtom)

  const handleUpdateAvailable = useCallback((event: Electron.IpcRendererEvent, arg: { update: boolean, version: string, newVersion: string }) => {
    if (arg.update && arg.newVersion) {
      setNewVersion(arg.newVersion)
    }
  }, [setNewVersion])

  // listen new version
  useEffect(() => {
    window.ipcRenderer.on("update-can-available", handleUpdateAvailable)

    return () => {
      window.ipcRenderer.off("update-can-available", handleUpdateAvailable)
    }
  }, [handleUpdateAvailable])

  return null
}
