import React from "react"
import { useLocation } from "react-router-dom"
import Header from "../components/Header"
import { Outlet } from "react-router-dom"
import HistorySidebar from "../components/HistorySidebar"
import { useAtom, useAtomValue } from "jotai"
import { isConfigNotInitializedAtom } from "../atoms/configState"
import GlobalToast from "../components/GlobalToast"
import { themeAtom, systemThemeAtom } from "../atoms/themeState"
import Overlay from "./Overlay"
import KeymapModal from "../components/Modal/KeymapModal"
import { useUIStore } from "../stores/uiStore"

const Layout = () => {
  const isConfigNotInitialized = useAtomValue(isConfigNotInitializedAtom)
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const { isPanelOpen } = useUIStore()
  const location = useLocation()

  const sidebarWidth = 300;

  return (
    <div className={`app-container text-foreground bg-background flex h-screen ${theme === "system" ? systemTheme : theme} light:bg-white`}
      data-theme={`${theme === "system" ? systemTheme : theme}`}>
      <div className="app-content flex flex-1 overflow-hidden">
        { <HistorySidebar />}
        <div className="flex flex-col flex-1">
          {(location.pathname === "/" || location.pathname.startsWith("/chat")) && <Header showModelSelect />}
          <div
            className={`flex-1 flex flex-col relative transition-all duration-300 ease-in-out ${isPanelOpen ? `ml-[${sidebarWidth}px]` : 'ml-0'}`}
          >
            <div className="flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </div>
        </div>
      </div>
      <Overlay />
      <GlobalToast />
      <KeymapModal />
    </div>
  )
}

export default React.memo(Layout)
