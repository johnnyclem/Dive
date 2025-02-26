import { RouterProvider } from "react-router-dom"
import { router } from "./router"
import { useAtom } from 'jotai'
import { loadConfigAtom } from './atoms/configState'
import { useEffect, useState } from "react"
import { handleGlobalHotkey, loadHotkeyMapAtom } from "./atoms/hotkeyState"
import { systemThemeAtom } from "./atoms/themeState"

function App() {
  const [, loadConfig] = useAtom(loadConfigAtom)
  const [loading, setLoading] = useState(true)
  const [, loadHotkeyMap] = useAtom(loadHotkeyMapAtom)
  const [, setSystemTheme] = useAtom(systemThemeAtom)

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
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
