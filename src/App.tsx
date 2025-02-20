import { RouterProvider } from "react-router-dom"
import { router } from "./router"
import { useAtom } from 'jotai'
import { loadConfigAtom } from './atoms/configState'
import { useEffect, useState } from "react"
import { handleGlobalHotkey, loadHotkeyMapAtom } from "./atoms/hotkeyState"

function App() {
  const [, loadConfig] = useAtom(loadConfigAtom)
  const [loading, setLoading] = useState(true)
  const [, loadHotkeyMap] = useAtom(loadHotkeyMapAtom)

  useEffect(() => {
    loadHotkeyMap()
    loadConfig()
      .finally(() => {
        setLoading(false)
        window.postMessage({ payload: "removeLoading" }, "*")
      })
    
    window.addEventListener("keydown", handleGlobalHotkey)
    return () => {
      window.removeEventListener("keydown", handleGlobalHotkey)
    }
  }, [])

  if (loading) {
    return <></>
  }

  return (
    <>
      <RouterProvider router={router} />
    </>
  )
}

export default App
