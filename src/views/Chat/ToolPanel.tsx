import React, { useMemo } from "react"
import SyntaxHighlighter from "react-syntax-highlighter"
import tomorrow from "react-syntax-highlighter/dist/styles/tomorrow"
import darcula from "react-syntax-highlighter/dist/styles/darcula"
import { useAtomValue } from "jotai"
import { themeAtom } from "../../atoms/themeState"
import { safeBase64Decode } from "../../util"
import { useTranslation } from "react-i18next"
import CodeWrapper from "../../components/CodeWrapper"

interface ToolPanelProps {
  content: string
  name: string
}

const callStr = "##Tool Calls:"
const resultStr = "##Tool Result:"

function getToolResult(content: string) {
  let calls = ""
  let results: string[] = []

  try {
    const resultIndex = content.indexOf(resultStr)
    calls = resultIndex === -1 ? content.slice(callStr.length) : content.slice(callStr.length, resultIndex)

    if (resultIndex !== -1) {
      results = content
        .slice(resultIndex + resultStr.length)
        .split(resultStr)
        .filter(result => result.trim() !== "")
    }
  } catch (e) {
    console.error("Error parsing tool results:", e)
  }

  return {
    calls,
    results
  }
}

function formatJSON(jsonString: string): string {
  try {
    const parsed = JSON.parse(jsonString.trim())
    return JSON.stringify(parsed, null, 2)
  } catch {
    return jsonString
  }
}

const Code: React.FC<{ content: string }> = ({ content }) => {
  const theme = useAtomValue(themeAtom)

  // Error handling for undefined or empty content
  if (!content) {
    return <pre className="p-2 bg-gray-900 text-gray-100 rounded-md">[Empty content]</pre>;
  }

  try {
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
    );
  } catch (error) {
    console.error("Error rendering syntax highlighter:", error);
    // Fallback to plain code display
    return (
      <CodeWrapper language="json">
        {content}
      </CodeWrapper>
    );
  }
};

const ToolPanel: React.FC<ToolPanelProps> = ({ content, name }) => {
  const { t } = useTranslation();
  
  // Always call hooks at the top level, regardless of early returns
  const processedContent = useMemo(() => {
    if (!content || typeof content !== 'string' || !content.startsWith(callStr)) {
      return { valid: false, calls: '', results: [] };
    }
    
    const { calls, results } = getToolResult(content);
    
    let formattedCalls = '';
    try {
      formattedCalls = formatJSON(safeBase64Decode(calls));
    } catch (error) {
      console.error("Error formatting calls:", error);
      formattedCalls = calls;
    }
    
    let formattedResults: string[] = [];
    try {
      formattedResults = results.map(result => {
        try {
          return formatJSON(safeBase64Decode(result));
        } catch (error) {
          console.error("Error formatting result:", error);
          return result;
        }
      });
    } catch (error) {
      console.error("Error with results array:", error);
    }
    
    return { 
      valid: true,
      calls: formattedCalls,
      results: formattedResults
    };
  }, [content]);
  
  // Early return if content is not valid
  if (!processedContent.valid) {
    return null;
  }

  return (
    <details className="tool-panel">
      <summary>
        {t("chat.toolCalls", { name: name || 'tool' })}
      </summary>
      <div className="tool-content">
        <span>Calls:</span>
        <Code content={processedContent.calls} />

        {Array.isArray(processedContent.results) && processedContent.results.length > 0 && (
          <>
            {processedContent.results.map((result, index) => (
              <React.Fragment key={index}>
                <span>Results{processedContent.results.length > 1 ? ` ${index + 1}` : ""}:</span>
                <Code content={result} />
              </React.Fragment>
            ))}
          </>
        )}
      </div>
    </details>
  );
};

export default React.memo(ToolPanel);