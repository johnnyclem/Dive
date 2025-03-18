import React, { useMemo } from "react"
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter"
import { tomorrow, darcula } from "react-syntax-highlighter/dist/esm/styles/prism"
import { useAtomValue } from "jotai"
import { themeAtom } from "../../atoms/themeState"
import { safeBase64Decode } from "../../util"
import { useTranslation } from "react-i18next"

export interface ToolCall {
  name: string
  arguments: any
}

export interface ToolResult {
  name: string
  result: any
}

interface ToolPanelProps {
  content: string
  name: string
}

const callStr = "##Tool Calls:"
const resultStr = "##Tool Result:"

function getToolResult(content: string) {
  let calls = ""
  let result = ""

  try {
    const resultIndex = content.indexOf(resultStr)
    calls = content.slice(callStr.length, resultIndex)
    result = resultIndex !== -1 ? content.slice(resultIndex + resultStr.length) : ""
  } catch (e) {}

  return {
    calls,
    result
  }
}

function formatJSON(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString.trim())
    return JSON.stringify(parsed, null, 2)
  } catch (e) {
    return jsonString
  }
}

const Code = ({ content }: { content: string }) => {
  const [theme] = useAtomValue(themeAtom)

  return (
    <SyntaxHighlighter
      language={"json"}
      style={theme === "dark" ? tomorrow : darcula}
      showLineNumbers={true}
      customStyle={{
        margin: 0,
        height: "100%",
        background: "transparent",
        backgroundColor: "var(--bg-modal)"
      }}
      codeTagProps={{
        style: {
          fontSize: "14px",
          lineHeight: "1.5"
        }
      }}
    >
      {content}
    </SyntaxHighlighter>
  )
}

const ToolPanel: React.FC<ToolPanelProps> = ({ content, name }) => {
  const { t } = useTranslation()
  const { calls, result } = useMemo(() => getToolResult(content), [content])
  const formattedCalls = useMemo(() => formatJSON(safeBase64Decode(calls)), [calls])
  const formattedResult = useMemo(() => formatJSON(safeBase64Decode(result)), [result])

  if (!content || !content.startsWith(callStr)) {
    return <></>
  }

  return (
    <details className="tool-panel">
      <summary>
        {t("chat.toolCalls", { name })}
      </summary>
      <div className="tool-content">
        <span>Calls:</span>
        <Code content={formattedCalls} />

        {result.length > 0 && (
          <>
            <span>Results:</span>
            <Code content={formattedResult} />
          </>
        )}
      </div>
    </details>
  )
}

export default React.memo(ToolPanel)