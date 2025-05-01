import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import WorkflowControls from '../components/WorkflowControls'

/**
 * Collaborative Browser pane backed by Electron BrowserView.
 * Communicates with the main process via IPC instead of embedding a <webview> tag.
 */
const Browser: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState('https://sou.ls')
  const navigate = useNavigate()

  // Helper for sending user navigation commands to main
  const sendUserAction = (action: 'back' | 'forward' | 'reload') => {
    window.electron?.ipcRenderer.send('BROWSER_USER_ACTION', action)
  }

  const goBack = () => sendUserAction('back')
  const goForward = () => sendUserAction('forward')
  const reload = () => sendUserAction('reload')

  const loadUrl = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      let input = (e.target as HTMLInputElement).value.trim()
      // Auto-prefix with https:// if missing
      if (!/^https?:\/\//i.test(input)) {
        input = `https://${input}`
      }
      setUrl(input)
      window.electron?.ipcRenderer.send('BROWSER_USER_NAVIGATE', input)
    }
  }

  // Sync BrowserView bounds with the container div
  useEffect(() => {
    const sendBounds = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const { x, y, width, height } = rect
      window.electron?.ipcRenderer.send('BROWSER_SET_BOUNDS', {
        x: Math.floor(x),
        y: Math.floor(y),
        width: Math.floor(width),
        height: Math.floor(height),
      })
    }

    // Initial
    sendBounds()

    // Observe resize of container
    const observer = new ResizeObserver(sendBounds)
    if (containerRef.current) observer.observe(containerRef.current)

    // Also listen to window resize to reposition
    window.addEventListener('resize', sendBounds)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', sendBounds)
    }
  }, [])

  // Listen for navigation events from main -> update URL bar
  useEffect(() => {
    const handler = (_event: unknown, data: { event: string; payload: { url: string } }) => {
      if (data?.payload?.url) setUrl(data.payload.url)
    }
    window.electron?.ipcRenderer.on('BROWSER_EVENT', handler)
    return () => {
      window.electron?.ipcRenderer.off('BROWSER_EVENT', handler)
    }
  }, [])

  // Notify main process that browser is visible when this component mounts/unmounts
  useEffect(() => {
    window.electron?.ipcRenderer.send('BROWSER_SET_VISIBILITY', true)
    return () => {
      window.electron?.ipcRenderer.send('BROWSER_SET_VISIBILITY', false)
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 space-x-2">
        <button onClick={goBack} className="px-2">◀︎</button>
        <button onClick={goForward} className="px-2">▶︎</button>
        <button onClick={reload} className="px-2">⟳</button>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={loadUrl}
          placeholder="https://..."
          className="flex-1 ml-2 px-2 py-1 border rounded bg-white text-black dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {/* Workflow recording controls */}
        <WorkflowControls />
        <button
          onClick={() => {
            navigate('/')
            window.electron?.ipcRenderer.send('BROWSER_SET_VISIBILITY', false)
          }}
          className="ml-2 px-2 py-1 text-sm text-gray-600 dark:text-gray-400"
        >
          Close
        </button>
      </div>
      {/* Container div where BrowserView will be rendered by main process */}
      <div ref={containerRef} className="flex-1 bg-gray-200 dark:bg-gray-700 relative" />
    </div>
  )
}

export default Browser 