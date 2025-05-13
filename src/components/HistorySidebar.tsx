import React, { useState, useCallback, useEffect, useRef } from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  GlobeAltIcon,
  UserGroupIcon,
  ArchiveBoxIcon,
  WrenchScrewdriverIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  TrashIcon,
  ChatBubbleLeftIcon,
  ChevronDoubleLeftIcon,
  PlusIcon,
  FolderIcon
} from "@heroicons/react/24/outline"
import { historiesAtom, loadHistoriesAtom } from "../atoms/historyState"
import { useTranslation } from "react-i18next"
import { showToastAtom } from "../atoms/toastState"
import { openOverlayAtom } from "../atoms/layerState"
import useHotkeyEvent from "../hooks/useHotkeyEvent"
import { currentChatIdAtom } from "../atoms/chatState"
import PopupConfirm from "./PopupConfirm"
import { newVersionAtom } from "../atoms/globalState"
import UpdateButton from "./UpdateButton"
import { useSidebarStore } from "../stores/sidebarStore"
import soulsLogo from "../assets/Souls_Logo_Gradient.png"
import soulsIcon from "../assets/souls-icon.svg"
import glassIcon from "../assets/glass-icon.svg"
import { useCanvasInteraction } from '../contexts/CanvasInteractionContext'

// Define a union type for the button properties
type FooterButton =
  | { path: string; label: string; icon: React.ReactElement; handler?: never } // Link button
  | { handler: () => void; label: string; icon: React.ReactElement; path?: never }; // Action button

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
  const newVersion = useAtomValue(newVersionAtom)
  const [currentChatId, setCurrentChatId] = useAtom(currentChatIdAtom)
  const containerRef = useRef<HTMLDivElement>(null)
  const { collapsed, toggleSidebar } = useSidebarStore()
  const { getOrCreateCanvas } = useCanvasInteraction()

  useEffect(() => {
    loadHistories()
  }, [loadHistories])

  useEffect(() => {
    if (currentChatId) {
      getOrCreateCanvas(currentChatId)
    }
  }, [currentChatId, getOrCreateCanvas])

  useHotkeyEvent("chat:delete", () => {
    currentChatId && setDeletingChatId(currentChatId)
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
    navigate(`/chat/${chatId}`)
  }, [navigate, setCurrentChatId])

  const handleNewChat = () => {
    setCurrentChatId("")
    if (onNewChat) {
      onNewChat()
    } else {
      navigate("/")
    }
  }

  // Apply the defined type to the array
  const navigationButtons: FooterButton[] = [
    // home page
    { label: t("sidebar.home"), path: "/", icon: <img src={soulsIcon} alt="Souls Logo" className="w-5 h-5" /> },
    // Browser icon (using globe-alt outline)
    { label: t("sidebar.browser"), path: "/browser", icon: <GlobeAltIcon className="w-5 h-5" /> },
    // Personas icon (using user-group outline)
    { label: t("sidebar.personas"), path: "/personas", icon: <UserGroupIcon className="w-5 h-5" /> },
    // Storage icon (using archive-box outline)
    { label: t("sidebar.knowledge"), path: "/knowledge-base", icon: <ArchiveBoxIcon className="w-5 h-5" /> },
    // Tools icon (using wrench-screwdriver outline)
    { label: t("sidebar.tools"), path: "/tools", icon: <WrenchScrewdriverIcon className="w-5 h-5" /> },
    // System Settings icon (using cog-6-tooth outline)
    { label: t("sidebar.system"), path: "/settings/system", icon: <Cog6ToothIcon className="w-5 h-5" /> },
    // Model Settings icon (using cpu-chip outline)
    { label: t("sidebar.models"), path: "/settings/model", icon: <CpuChipIcon className="w-5 h-5" /> },
  ]

  return (
    <>
      <div
        className={`flex flex-col h-screen text-default-200 transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'
          }`}
        ref={containerRef}
      >
        {/* Logo */}
        <div className={`flex items-center h-16 pt-6 flex-shrink-0 ${collapsed ? 'px-3' : 'mb-4 pl-6'}`}>
          <img
            src={collapsed ? glassIcon : soulsLogo}
            alt="Souls Logo"
            className={`transition-opacity duration-300 ${collapsed ? '' : 'h-16 max-w-full'}`}
          />
        </div>

        {/* Navigation & Update Buttons */}
        <div className={`flex-shrink-0 p-3 ${collapsed ? 'space-y-3' : 'space-y-2'}`}>
          {navigationButtons.map((item, index) => {
            const isActive = location.pathname === item.path; // Check if the path matches

            return item.path ? (
              <Link
                key={index}
                to={item.path}
                className={`group flex items-center w-full px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 ${collapsed ? 'justify-center h-10' : ''
                  } ${
                  // Apply active styles conditionally
                  isActive
                    ? 'text-white' // Example active styles
                    : 'hover:bg-black/10 hover:text-gray-900 dark:hover:text-gray-100' // Regular hover styles
                  }`}
                title={collapsed ? item.label : undefined}
              >
                <span className={`flex-shrink-0
                  ${!collapsed ? 'mr-2' : ''}
                  ${isActive ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </Link>
            ) : (
              <button
                key={index}
                className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-black/10 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-150 ${collapsed ? 'justify-center h-10' : ''}`}
                onClick={item.handler}
                title={collapsed ? item.label : undefined}
              >
                <span className={`flex-shrink-0 ${!collapsed ? 'mr-2' : ''}`}>{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
          <div className={`${collapsed ? 'flex justify-center' : ''} pt-1`}>
            <UpdateButton />
          </div>
        </div>

        {/* Chat History Header (Visible only when expanded) */}
        {!collapsed && (
          <div className="mx-4 py-2 flex justify-between border-b border-default-100">
            <span className="inline-block text-xs font-semibold text-gray-500 uppercase tracking-wider">{t("sidebar.chats")}</span>
            <button
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => navigate("/")}
            >
              <FolderIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Chat History */}
        <div className="flex-grow overflow-y-auto overflow-x-hidden px-4 space-y-2 mt-2">
          {histories.map(chat => (
            <div
              key={chat.id}
              className={`group flex items-center rounded-md cursor-pointer transition-colors duration-150 ${chat.id === currentChatId
                ? 'bg-default-900/30'
                : 'hover:bg-default-900/10'
                } ${collapsed ? 'justify-center h-12' : 'justify-between p-3'}`}
              onClick={() => loadChat(chat.id)}
              title={collapsed ? (chat.title || t("chat.untitledChat")) : undefined}
            >
              {/* Content inside the chat item div */}
              {collapsed ? (
                // Collapsed view: Show chat icon
                <ChatBubbleLeftIcon className="w-5 h-5 text-default-200" />
              ) : (
                // Expanded view: Show title, date, and delete button on hover
                <>
                  <div className="flex-1 min-w-0 mr-2">
                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                      {chat.title || t("chat.untitledChat")}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(chat.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    className={`flex-shrink-0 text-default-200 hover:text-default-100 hover:bg-default-100/20 rounded transition-all duration-150 opacity-0 group-hover:opacity-100 p-1 cursor-pointer`}
                    onClick={(e) => confirmDelete(e, chat.id)}
                    title={t("chat.deleteChat")}
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Controls: Collapse */}
        <div className={`flex-shrink-0 p-3 mt-auto ${collapsed ? 'space-y-3' : 'space-y-2'}`}>
          <button
            className={`flex items-center w-full px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-black/10 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-150 mt-1 ${collapsed ? 'justify-center h-10' : ''}`}
            onClick={toggleSidebar}
            title={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
          >
            <ChevronDoubleLeftIcon className="w-5 h-5 transition-transform duration-300" style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            {!collapsed && <span className="ml-2">{collapsed ? t("sidebar.expand") : t("sidebar.collapse")}</span>}
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