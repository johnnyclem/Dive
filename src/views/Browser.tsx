import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * Embedded Browser pane with navigation controls.
 * Expects a preload script at electron/preload/browser.js.
 */
const Browser: React.FC = () => {
  const webviewRef = useRef<Electron.WebviewTag>(null)
  const [url, setUrl] = useState('https://sou.ls')
  const navigate = useNavigate()

  const goBack = () => webviewRef.current?.goBack()
  const goForward = () => webviewRef.current?.goForward()
  const reload = () => webviewRef.current?.reload()
  const loadUrl = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && webviewRef.current) {
      let input = (e.target as HTMLInputElement).value.trim()
      // Auto-prefix with https:// if missing
      if (!/^https?:\/\//i.test(input)) {
        input = `https://${input}`
      }
      setUrl(input)
      webviewRef.current.loadURL(input)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      <div className="flex items-center p-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <button onClick={goBack} className="px-2">◀︎</button>
        <button onClick={goForward} className="px-2">▶︎</button>
        <button onClick={reload} className="px-2">⟳</button>
        <input
          type="text"
          defaultValue={url}
          onKeyDown={loadUrl}
          placeholder="https://..."
          className="flex-1 ml-2 px-2 py-1 border rounded bg-white text-black dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={() => navigate('/')} className="ml-2 px-2 py-1 text-sm text-gray-600 dark:text-gray-400">
          Close
        </button>
      </div>
      <webview
        ref={webviewRef}
        src={url}
        // Preload script copied into public/preload/browser.js
        preload="/preload/browser.js"
        style={{ flex: 1 }}
      />
    </div>
  )
}

export default Browser 