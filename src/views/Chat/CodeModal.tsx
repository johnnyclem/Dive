import React, { useRef, useEffect, useCallback } from "react"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, darcula } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { themeAtom } from '../../atoms/themeState'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { codeStreamingAtom, updateStreamingCodeAtom } from '../../atoms/codeStreaming'

const CodeModal = () => {
  const [theme] = useAtom(themeAtom)
  const codeModalRef = useRef<HTMLDivElement>(null)

  const { streamingCode } = useAtomValue(codeStreamingAtom)
  const code = streamingCode?.code || ""
  const updateStreamingCode = useSetAtom(updateStreamingCodeAtom)

  const scrollCodeToBottom = useCallback(() => {
    if (codeModalRef.current) {
      const pre = codeModalRef.current.querySelector("pre")
      if (pre) {
        pre.scrollTop = pre.scrollHeight
      }
    }
  }, [])

  useEffect(() => {
    scrollCodeToBottom()
  }, [streamingCode, scrollCodeToBottom])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  if (!streamingCode || !streamingCode.code)
    return null

  return (
    <div className="code-modal">
      <div className="code-modal-content">
        <div className="code-modal-header">
          <span className="language">{streamingCode?.language}</span>
          <button 
            className="close-btn"
            onClick={() => updateStreamingCode({ code: "", language: "" })}
          >
            ×
          </button>
        </div>
        <div className="code-modal-body" ref={codeModalRef}>
          <SyntaxHighlighter
            language={streamingCode?.language.toLowerCase() || ""}
            style={theme === "dark" ? tomorrow : darcula}
            showLineNumbers={true}
            customStyle={{
              margin: 0,
              height: '100%',
              background: 'transparent'
            }}
            codeTagProps={{
              style: {
                fontSize: '14px',
                lineHeight: '1.5'
              }
            }}
          >
            {code}
          </SyntaxHighlighter>
        </div>
        <div className="code-modal-footer">
          <button 
            className="copy-btn"
            onClick={() => copyToClipboard(code)}
          >
            複製
          </button>
        </div>
      </div>
    </div>
  )
}

export default React.memo(CodeModal) 