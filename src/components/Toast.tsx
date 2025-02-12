import React, { useEffect } from "react"
import { createPortal } from "react-dom"

export interface ToastProps {
  id: string
  message: string
  type?: "info" | "success" | "warning" | "error"
  duration?: number
  closable?: boolean
  onClose: () => void
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = "info",
  duration,
  closable = false,
  onClose 
}) => {
  useEffect(() => {
    if (duration && !closable) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, closable, onClose])

  return (
    <div className={`toast-container ${type}`}>
      <div className="toast-content">
        {message}
        {closable && (
          <button className="toast-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

export default React.memo(Toast) 