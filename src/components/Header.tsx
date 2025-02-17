import React from "react"
import { useAtom, useSetAtom } from "jotai"
import { toggleSidebarAtom } from "../atoms/sidebarState"
import { useTranslation } from "react-i18next"
import { chatIdAtom } from "../atoms/chatState"
import { useNavigate } from "react-router-dom"

const Header = () => {
  const toggleSidebar = useSetAtom(toggleSidebarAtom)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [chatId] = useAtom(chatIdAtom)

  const onClose = () => {
    toggleSidebar()
    switch(chatId) {
      case "init": // when chatId is init, it means the chat is not initialized yet
        break
      case null:
        navigate("/")
        break
      default:
        navigate(`/chat/${chatId}`)
        break
    }
  }

  return (
    <div className="app-header">
      <div className="header-content">
        <button 
          className="menu-btn"
          onClick={onClose}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
        <h1>{t("header.title")}</h1>
      </div>
    </div>
  )
}

export default React.memo(Header) 