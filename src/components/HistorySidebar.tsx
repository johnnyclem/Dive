import React, { useState, useCallback, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAtom, useSetAtom } from "jotai"
import { sidebarVisibleAtom, toggleConfigSidebarAtom, toggleSidebarAtom } from "../atoms/sidebarState"
import { historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import Header from "./Header"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"

interface Props {
  onNewChat?: () => void
}

interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
}

const DeleteConfirmModal: React.FC<DeleteConfirmProps> = ({ onConfirm, onCancel }) => {
  const { t } = useTranslation()
  
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="confirm-modal" onClick={e => e.stopPropagation()}>
        <h3>{t("chat.confirmDelete")}</h3>
        <div className="confirm-actions">
          <button className="cancel-btn" onClick={onCancel}>
            {t("common.cancel")}
          </button>
          <button className="confirm-btn" onClick={onConfirm}>
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  )
}

const HistorySidebar = ({ onNewChat }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [isVisible, setIsVisible] = useAtom(sidebarVisibleAtom)
  const [histories] = useAtom(historiesAtom)
  const [, loadHistories] = useAtom(loadHistoriesAtom)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [, toggleConfigSidebar] = useAtom(toggleConfigSidebarAtom)
  const toggleSidebar = useSetAtom(toggleSidebarAtom)
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null)
  const [, showToast] = useAtom(showToastAtom)

  useEffect(() => {
    if (isVisible) {
      loadHistories()
    }
  }, [isVisible, loadHistories])

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "Escape" && isVisible) {
        toggleSidebar()
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("keydown", handleKeydown);
    }
  }, [isVisible])

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
    } catch (error) {
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
    setIsVisible(false)
    navigate(`/chat/${chatId}`)
  }, [navigate, setIsVisible])

  const handleNewChat = () => {
    setCurrentChatId(null)
    setIsVisible(false)
    if (onNewChat) {
      onNewChat()
    } else {
      navigate("/")
    }
  }

  const handleTools = () => {
    setIsVisible(false)
    navigate("/tools")
  }

  const handleSettings = () => {
    setIsVisible(false)
    toggleConfigSidebar()
  }

  return (
    <>
      <div className={`history-sidebar ${isVisible ? "visible" : ""}`}>
        <Header />
        {isVisible && (
          <button
            className="close-btn"
            onClick={toggleSidebar}
          >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        )}
        <div className="history-header">
          <button onClick={handleNewChat} className="new-chat-btn">
            + {t("chat.newChat")}
          </button>
        </div>
        <div className="history-list">
          {histories.map(chat => (
            <div 
              key={chat.id}
              className={`history-item ${chat.id === currentChatId ? "active" : ""}`}
              onClick={() => loadChat(chat.id)}
            >
              <div className="history-content">
                <div className="history-title">{chat.title || t("chat.untitledChat")}</div>
                <div className="history-date">
                  {new Date(chat.createdAt).toLocaleString()}
                </div>
              </div>
              <button 
                className="delete-btn"
                onClick={(e) => confirmDelete(e, chat.id)}
                title={t("chat.deleteChat")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
        <div className="sidebar-footer">
          <button 
            className="tools-btn"
            onClick={handleTools}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
            </svg>
            {t("sidebar.tools")}
          </button>
          <button 
            className="setup-btn"
            onClick={handleSettings}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
            {t("sidebar.settings")}
          </button>
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

export default React.memo(HistorySidebar) 