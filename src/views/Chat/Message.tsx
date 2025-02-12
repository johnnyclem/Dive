import "katex/dist/katex.min.css"

import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import remarkGfm from "remark-gfm"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useColorScheme } from "../../hooks/useColorScheme";
import { useSetAtom } from "jotai"
import { updateStreamingCodeAtom } from "../../atoms/codeStreaming"
import ToolPanel, { ToolCall, ToolResult } from "./ToolPanel"
import FilePreview from "./FilePreview"
import { useTranslation } from "react-i18next"

interface MessageProps {
  text: string
  isSent: boolean
  timestamp: number
  files?: (File | string)[]
  isError?: boolean
  isLoading?: boolean
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

const Message = ({ text, isSent, files, isError, isLoading, toolCalls, toolResults }: MessageProps) => {
  const { t } = useTranslation()
  const colorScheme = useColorScheme()
  const updateStreamingCode = useSetAtom(updateStreamingCodeAtom)
  
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const formattedText = useMemo(() => {
    if (isSent) {
      const splitText = text.split("\n")
      return splitText.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < splitText.length - 1 && <br />}
        </React.Fragment>
      ))
    }

    return (
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code({node, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || "")
            const language = match ? match[1] : ""
            const code = String(children).replace(/\n$/, "")

            const inline = node?.position?.start.line === node?.position?.end.line
            if (inline) {
              return <code className={`${className} inline-code`} {...props}>{children}</code>
            }

            const lines = code.split("\n")
            const isLongCode = lines.length > 10

            if (isLongCode) {
              const cleanText = text.replace(/\s+(?=```)/gm, "")
              const isBlockComplete = cleanText.includes(code.trim() + "```")
              const handleClick = () => {
                updateStreamingCode({ code, language })
              }
              
              if (!isBlockComplete && isLoading) {
                updateStreamingCode({ code, language })
              }

              return (
                <button 
                  className="code-block-button"
                  onClick={handleClick}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/>
                  </svg>
                  <span>{t("chat.previewCode")}</span>
                </button>
              )
            }

            return (
              <div className="code-block">
                <div className="code-header">
                  <span className="language">{language}</span>
                  <button 
                    className="copy-btn"
                    onClick={() => copyToClipboard(code)}
                  >
                    {t("chat.copyCode")}
                  </button>
                </div>
                <SyntaxHighlighter
                  language={language.toLowerCase()}
                  style={colorScheme === "dark" ? tomorrow : oneLight}
                  customStyle={{
                    margin: 0,
                    padding: "12px",
                    background: "transparent"
                  }}
                >
                  {code}
                </SyntaxHighlighter>
              </div>
            )
          }
        }}
      >
        {text}
      </ReactMarkdown>
    )
  }, [text, isSent, isLoading, colorScheme])

  return (
    <div className={`message ${isSent ? "sent" : "received"} ${isError ? "error" : ""}`}>
      {toolCalls && (
        <ToolPanel 
          type="calls"
          content={toolCalls}
        />
      )}
      {toolResults && (
        <ToolPanel
          type="result"
          content={toolResults}
          name={toolResults[0]?.name}
        />
      )}
      {formattedText}
      {files && files.length > 0 && <FilePreview files={files} />}
      {isLoading && (
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      )}
    </div>
  )
}

export default React.memo(Message) 