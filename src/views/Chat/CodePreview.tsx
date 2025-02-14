import React from "react"
import Mermaid from "./preview/mermaid"

interface CodePreviewProps {
  language: string
  code: string
}

const CodePreview = ({ language, code }: CodePreviewProps) => {
  if (language === "mermaid") {
    return <Mermaid chart={code} />
  }

  return (
    <></>
  )
}

export default React.memo(CodePreview)