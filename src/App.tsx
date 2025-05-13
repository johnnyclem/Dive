import { RouterProvider } from "react-router-dom"
import { router } from "./router"
import { useSetAtom, useAtomValue } from 'jotai'
import { loadConfigAtom } from './atoms/configState'
import { useEffect } from "react"
import { handleGlobalHotkey, loadHotkeyMapAtom } from "./atoms/hotkeyState"
import { handleWindowResizeAtom } from "./atoms/sidebarState"
import { systemThemeAtom, userThemeAtom } from "./atoms/themeState"
import Updater from "./updater"
import { CanvasInteractionProvider } from './contexts/CanvasInteractionContext'


function App() {
  const loadConfig = useSetAtom(loadConfigAtom)
  const loadHotkeyMap = useSetAtom(loadHotkeyMapAtom)
  const setSystemTheme = useSetAtom(systemThemeAtom)
  const handleWindowResize = useSetAtom(handleWindowResizeAtom)
  const userTheme = useAtomValue(userThemeAtom)
  const systemTheme = useAtomValue(systemThemeAtom)

  // init app
  useEffect(() => {
    loadHotkeyMap()
    loadConfig().catch(console.warn)
    window.postMessage({ payload: "removeLoading" }, "*")

    window.addEventListener("resize", handleWindowResize)
    window.addEventListener("keydown", handleGlobalHotkey)
    return () => {
      window.removeEventListener("resize", handleWindowResize)
      window.removeEventListener("keydown", handleGlobalHotkey)
    }
  }, [])

  // set system theme based on OS preference
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    setSystemTheme(mediaQuery.matches ? "dark" : "light")
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [setSystemTheme])

  // Apply theme class to body
  useEffect(() => {
    const body = document.body
    const currentTheme = userTheme === "system" ? systemTheme : userTheme

    body.classList.remove("light", "dark")
    if (currentTheme) {
      body.classList.add(currentTheme)
    }
  }, [userTheme, systemTheme])

  // render UI immediately; config loads in background

  return (
    <CanvasInteractionProvider>
      <RouterProvider router={router} />
      <Updater />
    </CanvasInteractionProvider>
  )
}

export default App
