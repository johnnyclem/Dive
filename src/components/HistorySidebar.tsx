import React, { useState, useCallback, useEffect, useRef } from "react"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"
import { historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import Header from "./Header"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import Tooltip from "./Tooltip"
import { closeAllOverlaysAtom, openOverlayAtom, OverlayType } from "../atoms/layerState"
import { useSidebarLayer } from "../hooks/useLayer"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import { currentChatIdAtom } from "../atoms/chatState"
import PopupConfirm from "./PopupConfirm"
import UpdateButton from "./UpdateButton"

interface Props {
  onNewChat?: () => void
}

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmModal: React.FC<DeleteConfirmProps> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const setCurrentChatId = useSetAtom(currentChatIdAtom)

  const _onConfirm = useCallback(() => {
    onConfirm()
    setCurrentChatId("")
  }, [onConfirm, setCurrentChatId])

  return (
    <PopupConfirm
      title={t("chat.confirmDelete")}
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
      onConfirm={_onConfirm}
      onCancel={onCancel}
      onClickOutside={onCancel}
      noBorder
      footerType="center"
      zIndex={1000}
    />
  )
}

const HistorySidebar = ({ onNewChat }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const histories = useAtomValue(historiesAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const showToast = useSetAtom(showToastAtom)
  const _openOverlay = useSetAtom(openOverlayAtom)
  const closeAllOverlays = useSetAtom(closeAllOverlaysAtom)
  const [isVisible, setVisible] = useSidebarLayer(sidebarVisibleAtom)
  const [currentChatId, setCurrentChatId] = useAtom(currentChatIdAtom)
  const containerRef = useRef<HTMLDivElement>(null)

  const openOverlay = useCallback((overlay: OverlayType) => {
    _openOverlay(overlay)
    setVisible(false)
  }, [_openOverlay, setVisible])

  useEffect(() => {
    if (isVisible) {
      loadHistories()
      containerRef.current?.focus()
    }
  }, [isVisible, loadHistories])

  useHotkeyEvent("chat:delete", () => {
    if (currentChatId) {
      setDeletingChatId(currentChatId)
    }
  })

  const confirmDelete = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation()
    setDeletingChatId(chatId)
  }

  const handleDelete = async () => {
    if (!deletingChatId)
      return

    try {
      const response = await fetch(`/api/chat/${deletingChatId}`, {
        method: "DELETE"
      })
      const data = await response.json()

      if (data.success) {
        showToast({
          message: t("chat.deleteSuccess"),
          type: "success"
        })

        if (location.pathname.includes(`/chat/${deletingChatId}`)) {
          navigate("/")
        }

        loadHistories()
      } else {
        showToast({
          message: t("chat.deleteFailed"),
          type: "error"
        })
      }
    } catch {
      showToast({
        message: t("chat.deleteFailed"),
        type: "error"
      })
    } finally {
      setDeletingChatId(null)
    }
  }

  const loadChat = useCallback((chatId: string) => {
    setCurrentChatId(chatId)
    closeAllOverlays()
    navigate(`/chat/${chatId}`)
  }, [navigate])

  const handleNewChat = () => {
    setCurrentChatId("")
    setVisible(false)
    closeAllOverlays()
    if (onNewChat) {
      onNewChat()
    } else {
      navigate("/")
    }
  }

  const handleTools = () => {
    openOverlay("Tools")
  }

  const handleModels = () => {
    openOverlay("Model")
  }

  const handleSystem = () => {
    openOverlay("System")
  }

  const onBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (containerRef.current && !containerRef.current.contains(e.relatedTarget as Node)) {
      setVisible(false)
    }
  }

  return (
    <>
      <div 
        className={`
          flex flex-col bg-[var(--bg)] overflow-hidden transition-all duration-300 ease-in-out z-[var(--z-sidebar)]
          ${isVisible ? 'w-[var(--sidebar-width)] border-r border-[var(--border-weak)]' : 'w-0'}
          md:absolute md:left-0 md:top-0 md:bottom-0 md:transform md:-translate-x-full md:z-[var(--z-overlay)+1]
          ${isVisible ? 'md:translate-x-0' : ''}
        `}
        tabIndex={0} 
        onBlur={onBlur} 
        ref={containerRef}
      >
        <Header />
        <div className="p-4 px-5">
          <Tooltip
            content={`${t("chat.newChatTooltip")} Ctrl + Shift + O`}
          >
            <button 
              className="w-full p-2.5 border-none rounded-lg bg-[var(--bg-pri-blue)] text-white font-medium cursor-pointer transition-colors duration-200 hover:bg-[var(--bg-hover-blue)] active:bg-[var(--bg-active-blue)]"
              onClick={handleNewChat}
            >
              + {t("chat.newChat")}
            </button>
          </Tooltip>
        </div>
        <div className="flex-1 overflow-y-auto px-5 scrollbar-thin scrollbar-thumb-[var(--bg-op-dark-weak)] scrollbar-track-transparent">
          {histories.map(chat => (
            <div
              key={chat.id}
              className={`
                flex items-center justify-between p-3 rounded-lg cursor-pointer mb-2
                hover:bg-[var(--bg-op-dark-ultraweak)]
                ${chat.id === currentChatId ? 'bg-[rgba(var(--bg-pri-blue),0.1)]' : ''}
              `}
              onClick={() => loadChat(chat.id)}
            >
              <div className="flex-1 min-w-0 mr-2">
                <div className="font-medium mb-1 truncate">{chat.title || t("chat.untitledChat")}</div>
                <div className="text-xs text-[var(--text-weak)]">
                  {new Date(chat.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                className="opacity-0 p-1 bg-transparent border-none rounded cursor-pointer transition-all duration-200 hover:bg-[var(--bg-op-dark-ultraweak)] group-hover:opacity-100"
                onClick={(e) => confirmDelete(e, chat.id)}
                title={t("chat.deleteChat")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" className="fill-current">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="mt-auto p-4 border-t border-[var(--border-weak)]">
        <button className="sidebar-footer-btn" onClick={() => handleTools()}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5V4A2 2 0 0 1 6 2z"/>
            </svg>
            {t("sidebar.knowledge", "Knowledge")}
          </button>
          <Link to="#" className="sidebar-footer-btn" onClick={() => setVisible(true)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v15H6.5A2.5 2.5 0 0 1 4 14.5V4A2 2 0 0 1 6 2z"/>
            </svg>
            {t("sidebar.tools", "Tools")}
          </Link>

          <button
            className="flex items-center gap-2 w-full p-2 px-3 border-none rounded-md bg-transparent text-inherit cursor-pointer transition-all duration-200 hover:bg-[var(--bg-op-dark-extremeweak)]"
            onClick={handleTools}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" className="fill-[var(--stroke-op-dark-extremestrong)]">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.03-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            {t("chat.tools")}
          </button>
          <button
            className="flex items-center gap-2 w-full p-2 px-3 border-none rounded-md bg-transparent text-inherit cursor-pointer transition-all duration-200 hover:bg-[var(--bg-op-dark-extremeweak)] mt-2"
            onClick={handleModels}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" className="fill-[var(--stroke-op-dark-extremestrong)]">
              <path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.16.12-.36.18-.57.18-.21 0-.41-.06-.57-.18l-7.9-4.44c-.32-.17-.53-.5-.53-.88V7.5c0-.38.21-.71.53-.88l7.9-4.44c.16-.12.36-.18.57-.18.21 0 .41.06.57.18l7.9 4.44c.32.17.53.5.53.88v9z"/>
            </svg>
            {t("chat.models")}
          </button>
          <button
            className="flex items-center gap-2 w-full p-2 px-3 border-none rounded-md bg-transparent text-inherit cursor-pointer transition-all duration-200 hover:bg-[var(--bg-op-dark-extremeweak)] mt-2"
            onClick={handleSystem}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" className="fill-none stroke-[var(--stroke-op-dark-extremestrong)]">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>
            {t("chat.system")}
          </button>
          <UpdateButton />
        </div>
      </div>
      {deletingChatId && (
        <DeleteConfirmModal
          onConfirm={handleDelete}
          onCancel={() => setDeletingChatId(null)}
        />
      )}
    </>
  )
}

export default HistorySidebar