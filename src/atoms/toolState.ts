import { atom } from "jotai"

export interface SubTool {
  name: string
  description?: string
  enabled: boolean
  disabled?: boolean
}

export interface Tool {
  name: string
  description?: string
  icon?: string
  tools?: SubTool[]
  enabled: boolean
  disabled: boolean
  isBuiltIn?: boolean
}

export const toolsAtom = atom<Tool[]>([])

export const updateSubToolConfigAtom = atom(
  null,
  async (get, set, param: { toolName: string, subToolName: string, enabled: boolean }) => {
    const { toolName, subToolName, enabled } = param
    const response = await fetch("/api/tools/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        toolName,
        subToolName,
        enabled
      })
    })
    const data = await response.json()
    
    if (data.success) {
      const tools = get(toolsAtom)
      const newTools = tools.map(tool => {
        if (tool.name === toolName && tool.tools) {
          return {
            ...tool,
            tools: tool.tools.map(subTool => 
              subTool.name === subToolName 
                ? { ...subTool, enabled } 
                : subTool
            )
          }
        }
        return tool
      })
      set(toolsAtom, newTools)
    }
    
    return data
  }
)

export const loadToolsAtom = atom(
  null,
  async (get, set) => {
    const response = await fetch("/api/tools")
    const data = await response.json()
    if (data.success) {
      set(toolsAtom, data.tools)
    }

    return data
  }
)

export const restoreDefaultToolsAtom = atom(
  null,
  async (get, set) => {
    const response = await fetch("/api/tools/restore", {
      method: "POST"
    })
    const data = await response.json()
    if (data.success) {
      set(toolsAtom, data.tools)
    }
    return data
  }
)
