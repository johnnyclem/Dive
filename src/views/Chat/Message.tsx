import "katex/dist/katex.min.css"

import React, { useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeRaw from "rehype-raw"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { tomorrow, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { codeStreamingAtom } from '../../atoms/codeStreaming'
import ToolPanel from './ToolPanel'
import FilePreview from './FilePreview'
import { useTranslation } from 'react-i18next'
import { themeAtom } from "../../atoms/themeState";
import Textarea from "../../components/WrappedTextarea"
import { isChatStreamingAtom } from "../../atoms/chatState"
import { useUIStore } from "../../stores/uiStore";
import CodeWrapper from "../../components/CodeWrapper";
import { Avatar } from "@heroui/react";
import SoulsIcon from "../../assets/souls-icon-outline.svg?react";
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "tool-call": {
        children: any
        name: string
      };
    }
  }
}

interface MessageProps {
  messageId: string
  text: string
  isSent: boolean
  timestamp: number
  files?: (File | string)[]
  isError?: boolean
  isLoading?: boolean
  onRetry: () => void
  onEdit: (editedText: string) => void
}

// Helper function to detect if a string is JSON
const isJsonString = (str: string): boolean => {
  try {
    const result = JSON.parse(str);
    return (typeof result === 'object');
  } catch (e) {
    return false;
  }
}

// Helper function to check if an object is an image type
const isImageType = (obj: any): boolean => {
  return obj && obj.type === 'image' && obj.data && obj.mimeType;
}

// Helper to check if a string is likely base64 encoded image data
const isLikelyBase64Image = (str: string): boolean => {
  // Base64 strings are typically long, contain only valid base64 chars, and don't have spaces
  if (str.length < 100) return false; // Too short to be an image
  
  // Check if string contains only valid base64 characters
  return /^[A-Za-z0-9+/]+={0,2}$/i.test(str.trim());
}

// Helper to extract image data from a malformed/partial JSON or raw text
const tryExtractImageData = (text: string): { data: string, mimeType: string } | null => {
  console.log("Attempting to extract image data from text:", text.substring(0, 100) + "...");
  
  // NEW: Check for markdown-style image syntax first - this is the most common pattern
  // Allow for line breaks between ![image] and (data:...)
  // Format: ![image]\n(data:image/png;base64,...)
  const markdownImageRegex = /!\[(.*?)\][\s\n]*\(\s*(data:([^;]+);base64,[^\s)]+)\s*\)/is;
  const markdownMatch = text.match(markdownImageRegex);
  if (markdownMatch) {
    console.log("Found markdown-style image data");
    const dataUrl = markdownMatch[2]; // Full data URL
    const mimeType = markdownMatch[3] || "image/png"; // mime type or default to png
    return {
      data: dataUrl, // Return the complete data URL
      mimeType: mimeType
    };
  }
  
  // Also check for a special case where the format is ![image] on one line and (data:...) on the next
  if (text.includes("![image]") && text.includes("(data:")) {
    console.log("Found split markdown image pattern");
    const dataUrlMatch = text.match(/\(data:([^;]+);base64,([^)]+)\)/);
    if (dataUrlMatch) {
      const mimeType = dataUrlMatch[1];
      const fullDataUrl = `data:${mimeType};base64,${dataUrlMatch[2]}`;
      return {
        data: fullDataUrl,
        mimeType: mimeType
      };
    }
  }
  
  // Also check for plain data URLs without markdown wrapper
  if (text.trim().startsWith('data:')) {
    console.log("Found direct data URL");
    const mimeTypeMatch = text.match(/data:([^;]+);/);
    return {
      data: text.trim(),
      mimeType: mimeTypeMatch ? mimeTypeMatch[1] : "image/png"
    };
  }
  
  // Check for the common JSON structure pattern with image type
  const typeImageMatch = text.match(/"type"\s*:\s*"image"/i);
  const dataMatch = text.match(/"data"\s*:\s*"([^"]+)"/i);
  const mimeTypeMatch = text.match(/"mimeType"\s*:\s*"([^"]+)"/i);
  
  if (typeImageMatch && dataMatch && mimeTypeMatch) {
    console.log("Found image data pattern in text");
    return {
      data: dataMatch[1],
      mimeType: mimeTypeMatch[1]
    };
  }
  
  // Check if it's a raw base64 string
  if (isLikelyBase64Image(text)) {
    console.log("Text appears to be raw base64 data");
    return {
      data: text.trim(),
      mimeType: "image/jpeg" // Default to JPEG as a fallback
    };
  }
  
  return null;
}

// Helper to safely render image from base64 or URL
const renderImage = (data: string, mimeType: string): JSX.Element => {
  console.log(`Rendering image with mimeType: ${mimeType}, data starts with: ${data.substring(0, 30)}...`);
  
  // If data is already a complete data URL, use it directly
  if (data.startsWith('data:')) {
    console.log("Rendering complete data URL");
    return <img src={data} className="max-w-full rounded" alt="Generated content" />;
  }
  // Check if it's a URL
  else if (data.startsWith('http')) {
    console.log("Rendering as URL");
    return <img src={data} className="max-w-full rounded" alt="Generated content" />;
  }
  // Otherwise assume it's base64 data, create a data URL
  else {
    console.log("Rendering as base64 data");
    try {
      const dataUrl = `data:${mimeType};base64,${data}`;
      return <img src={dataUrl} className="max-w-full rounded" alt="Generated content" />;
    } catch (error) {
      console.error("Failed to render image:", error);
      return <div className="text-red-500">Error displaying image</div>;
    }
  }
}

const Message = ({ messageId, text, isSent, files, isError, isLoading, onRetry, onEdit }: MessageProps) => {
  const { t } = useTranslation()
  const [theme] = useAtom(themeAtom)
  const updateStreamingCode = useSetAtom(codeStreamingAtom)
  const { openPanel } = useUIStore()
  const cacheCode = useRef<string>("")
  const [isCopied, setIsCopied] = useState<Record<string, NodeJS.Timeout>>({})
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState(text)
  const [editedText, setEditedText] = useState(text)
  const isChatStreaming = useAtomValue(isChatStreamingAtom)
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const onCopy = (messageId: string, text: string) => {
    copyToClipboard(text)
    clearTimeout(isCopied[messageId])
    const timeout = setTimeout(() => {
      setIsCopied(prev => {
        const newState = { ...prev }
        delete newState[messageId]
        return newState
      })
    }, 3000)
    setIsCopied({ [messageId]: timeout })
  }

  const handleEdit = () => {
    setEditedText(content)
    setIsEditing(true)
  }

  const editText = useMemo(() => {
    const onCancel = () => {
      setIsEditing(false)
    }

    const onSave = async () => {
      setContent(editedText)
      setIsEditing(false)
      onEdit(editedText)
    }

    return (
      <div className="edit-text">
        <Textarea
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
        />
        <div className="edit-text-footer">
          <div className="edit-text-footer-left">
            <span>{t("chat.editDescription")}</span>
          </div>
          <div className="edit-text-footer-right">
            <button
              type="button"
              className="cancel-btn"
              onClick={onCancel}
            >
              {t("chat.cancel")}
            </button>
            <button
              type="button"
              className="save-btn"
              onClick={onSave}
              disabled={editedText === ""}
            >
              {t("chat.save")}
            </button>
          </div>
        </div>
      </div>
    )
  }, [editedText])

  const formattedText = useMemo(() => {
    const _text = isSent ? content : text
    
    // Check if the message text is from the AI and might contain an image
    if (!isSent) {
      console.log("Processing AI message:", messageId);
      console.log("Message text snippet:", _text.substring(0, 100));
      
      // FIRST: Try to extract image data directly from text patterns
      // This will catch markdown-style images like ![image](data:image/png;base64,...)
      const extractedImage = tryExtractImageData(_text);
      if (extractedImage) {
        console.log("Successfully extracted image data directly from text");
        return renderImage(extractedImage.data, extractedImage.mimeType);
      }
      
      // SECOND: Try parsing as JSON if direct extraction fails
      if (isJsonString(_text)) {
        try {
          const parsedMessage = JSON.parse(_text);
          
          // Handle array of content (common in responses)
          if (Array.isArray(parsedMessage)) {
            console.log("Message is a JSON array");
            // If it's an array with a single image object
            if (parsedMessage.length === 1 && isImageType(parsedMessage[0])) {
              const imageObj = parsedMessage[0];
              console.log("Found image object in array");
              return renderImage(imageObj.data, imageObj.mimeType);
            }
          } 
          // Handle direct image object
          else if (isImageType(parsedMessage)) {
            console.log("Message is a direct image object");
            return renderImage(parsedMessage.data, parsedMessage.mimeType);
          }
        } catch (error) {
          console.error("Error parsing JSON message:", error);
        }
      }
    }
    
    if (isSent) {
      const splitText = _text.split("\n")
      return splitText.map((line, i) => (
        <React.Fragment key={i}>
          {line}
          {i < splitText.length - 1 && <br />}
        </React.Fragment>
      ))
    }

    return (
      <ReactMarkdown
        remarkPlugins={[[remarkMath, {
          singleDollarTextMath: false,
          inlineMathDouble: false
        }], remarkGfm]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          "tool-call"({ children, name }) {
            let content = children
            if (typeof children !== "string") {
              if (!Array.isArray(children) || children.length === 0 || typeof children[0] !== "string") {
                return <></>
              }

              content = children[0]
            }

            return (
              <ToolPanel
                content={content}
                name={name}
              />
            )
          },
          a(props) {
            return (
              <a href={props.href} target="_blank" rel="noreferrer">
                {props.children}
              </a>
            )
          },
          img({ className, src, alt }) {
            let imageSrc = src
            if (src?.startsWith("https://localfile")) {
              let path = src.replace("https://localfile", "").replace(/\\/g, "/")
              if (path === decodeURI(path)) {
                path = encodeURI(path)
              }
              imageSrc = `local-file:///${path}`
            }

            return <img src={imageSrc} alt={alt} className={className} />
          },
          code({ node, className, children, ...props }) {
            try {
              const match = /language-(\w+)/.exec(className || "")
              const language = match ? match[1] : ""
              let code = String(children).replace(/\n$/, "")

              const inline = node?.position?.start.line === node?.position?.end.line
              if (inline) {
                return <code className={`${className} inline-code`} {...props}>{children}</code>
              }

              const lines = code.split("\n")
              const isLongCode = lines.length > 10

              if (isLongCode) {
                const cleanText = _text.replace(/\s+(?=```)/gm, "")
                const isBlockComplete = cleanText.includes(code.trim() + "```")
                code = code.endsWith("``") ? code.slice(0, -2) : code
                code = code.endsWith("`") ? code.slice(0, -1) : code
                const handleClick = () => {
                  updateStreamingCode({ code, language })
                  openPanel('code')
                }

                const diffLength = Math.abs(code.length - cacheCode.current.length)
                if ((!isBlockComplete && isLoading) || (diffLength < 10 && cacheCode.current !== code)) {
                  cacheCode.current = code
                  updateStreamingCode({ code, language })
                }

                return (
                  <button
                    className="code-block-button"
                    onClick={handleClick}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24">
                      <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
                    </svg>
                    <span>{t("chat.previewCode")}</span>
                  </button>
                )
              }

              // Use SyntaxHighlighter with error handling
              try {
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
                      style={theme === "dark" ? tomorrow : oneLight}
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
              } catch (highlighterError) {
                console.error("Error in syntax highlighter:", highlighterError);
                // Fallback to basic code display
                return (
                  <CodeWrapper language={language}>
                    {code}
                  </CodeWrapper>
                );
              }
            } catch (codeError) {
              console.error("Error in code component:", codeError);
              // Ultimate fallback for any error
              return (
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-md overflow-auto">
                  <code>
                    {typeof children === 'string' ? children : '[Code content could not be displayed]'}
                  </code>
                </pre>
              );
            }
          }
        }}
      >
        {_text.replaceAll("file://", "https://localfile")}
      </ReactMarkdown>
    )
  }, [content, text, isSent, isLoading, messageId])

  return (
    <div className={`message-wrapper ${isSent ? "sent" : "received"} ${isError ? "error" : ""}`}>
      <div className="flex items-start space-x-2">
        {!isSent && <Avatar size="sm" name="AI" className="mt-1" />}
        <div className="message-content-wrapper flex-grow">
          {isEditing ? (
            editText
          ) : (
            <div className={`message ${isSent ? "sent ml-auto max-w-[80%] bg-default-50" : "received"} ${isError ? "error" : ""}`}>
              {formattedText}
            </div>
          )}
          {files && files.length > 0 && <FilePreview files={files} />}
          {isLoading && (
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          )}
          {!isLoading && !isChatStreaming && (
            <div className="message-tools">
              <button
                type="button"
                className="tools-btn"
                onClick={() => onCopy(messageId, isSent ? content : text)}
                title={t("chat.copy")}
              >
                {isCopied[messageId] ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                      <path d="M4.6709 10.4241L9.04395 15.1721L17.522 7.49414" stroke="currentColor" fill="transparent" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t('chat.copied')}</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 22 22" fill="transparent">
                      <path d="M13 20H2V6H10.2498L13 8.80032V20Z" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round" />
                      <path d="M13 9H10V6L13 9Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M9 3.5V2H17.2498L20 4.80032V16H16" fill="transparent" stroke="currentColor" strokeWidth="2" strokeMiterlimit="10" strokeLinejoin="round" />
                      <path d="M20 5H17V2L20 5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t('chat.copy')}</span>
                  </>
                )}
              </button>
              {isSent ?
                <>
                  <button
                    type="button"
                    className="tools-btn"
                    onClick={handleEdit}
                    title={t("chat.edit")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20px" height="18px" viewBox="0 0 25 22" fill="none">
                      <path d="M3.38184 13.6686V19.0001H21.4201" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3.38178 13.5986L14.1186 4.12082C15.7828 2.65181 18.4809 2.65181 20.1451 4.12082V4.12082C21.8092 5.58983 21.8092 7.97157 20.1451 9.44059L9.40824 18.9183" fill="transparent" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{t('chat.edit')}</span>
                  </button>
                </>
                :
                <>
                  {messageId.includes("-") && (  //if messageId doesn't contain "-" then it's aborted before ready then it can't retry
                    <button
                      type="button"
                      className="tools-btn"
                      onClick={onRetry}
                      title={t("chat.retry")}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="transparent" height="15px" width="15px" viewBox="0 0 489.698 489.698">
                        <g>
                          <g>
                            <path d="M468.999,227.774c-11.4,0-20.8,8.3-20.8,19.8c-1,74.9-44.2,142.6-110.3,178.9c-99.6,54.7-216,5.6-260.6-61l62.9,13.1    c10.4,2.1,21.8-4.2,23.9-15.6c2.1-10.4-4.2-21.8-15.6-23.9l-123.7-26c-7.2-1.7-26.1,3.5-23.9,22.9l15.6,124.8    c1,10.4,9.4,17.7,19.8,17.7c15.5,0,21.8-11.4,20.8-22.9l-7.3-60.9c101.1,121.3,229.4,104.4,306.8,69.3    c80.1-42.7,131.1-124.8,132.1-215.4C488.799,237.174,480.399,227.774,468.999,227.774z" />
                            <path d="M20.599,261.874c11.4,0,20.8-8.3,20.8-19.8c1-74.9,44.2-142.6,110.3-178.9c99.6-54.7,216-5.6,260.6,61l-62.9-13.1    c-10.4-2.1-21.8,4.2-23.9,15.6c-2.1,10.4,4.2,21.8,15.6,23.9l123.8,26c7.2,1.7,26.1-3.5,23.9-22.9l-15.6-124.8    c-1-10.4-9.4-17.7-19.8-17.7c-15.5,0-21.8,11.4-20.8,22.9l7.2,60.9c-101.1-121.2-229.4-104.4-306.8-69.2    c-80.1,42.6-131.1,124.8-132.2,215.3C0.799,252.574,9.199,261.874,20.599,261.874z" />
                          </g>
                        </g>
                      </svg>
                      <span>{t('chat.retry')}</span>
                    </button>
                  )}
                </>
              }
            </div>
          )}
        </div>
        {isSent && <Avatar size="sm" name="U" className="mt-1" />}
      </div>
    </div>
  )
}

export default React.memo(Message)