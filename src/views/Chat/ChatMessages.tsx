import React, { useCallback, useEffect, useRef, useState } from "react"
import Message from "./Message"
import { isChatStreamingAtom } from "../../atoms/chatState"
import { useAtomValue } from "jotai"

export interface Message {
  id: string
  text: string
  isSent: boolean
  timestamp: number
  files?: File[]
  isError?: boolean
}

interface Props {
  messages: Message[]
  isLoading?: boolean
  onRetry: (messageId: string) => void
  onEdit: (messageId: string, newText: string) => void
}

const ChatMessages = ({ messages, isLoading, onRetry, onEdit }: Props) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const mouseWheelRef = useRef(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
    setShowScrollButton(false)
  }

  useEffect(() => {
    !mouseWheelRef.current && scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isChatStreaming) {
      mouseWheelRef.current = false
      setShowScrollButton(false)
    }
  }, [isChatStreaming])

  const checkIfAtBottom = () => {
    if (scrollContainerRef.current) {
      const element = scrollContainerRef.current
      const isAtBottom = Math.abs(
        (element.scrollHeight - element.scrollTop) - element.clientHeight
      ) < 50

      return isAtBottom
    }
    return false
  }

  const handleScroll = () => {
    mouseWheelRef.current = !checkIfAtBottom()
    setShowScrollButton(!checkIfAtBottom())
  }

  return (
    <div className="flex flex-1 overflow-auto relative" onWheel={handleScroll}>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-[85px] scrollbar scrollbar-thumb-[var(--bg-op-dark-weak)] scrollbar-w-1.5 scrollbar-thumb-rounded" ref={scrollContainerRef}>
        {messages.map((message, index) => (
          <Message
            key={message.id}
            text={message.text}
            isSent={message.isSent}
            timestamp={message.timestamp}
            files={message.files}
            isError={message.isError}
            isLoading={!message.isSent && index === messages.length - 1 && isLoading}
            messageId={message.id}
            onRetry={() => onRetry(message.id)}
            onEdit={(newText: string) => onEdit(message.id, newText)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
      <button 
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 -translate-y-full z-10 w-[38px] h-[38px] p-2 bg-[var(--bg)] rounded-full border border-[var(--border)] transition-opacity duration-300 ${showScrollButton ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'} hover:bg-[var(--bg-ultraweak)]`} 
        onClick={scrollToBottom}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 12L11 19L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M11 18L11 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export default React.memo(ChatMessages)
