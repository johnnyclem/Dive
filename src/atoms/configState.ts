import { atom } from 'jotai'
import { ModelProvider } from './interfaceState'

export type ModelConfig = {
  apiKey: string
  baseURL: string
  model: string
  modelProvider: ModelProvider
  configuration: ModelConfig
  topP: number
  temperature: number
}

export type ActiveProviderConfig = {
  activeProvider: ModelProvider|""
  configs: Record<ModelProvider, ModelConfig>
}

export const configAtom = atom<ActiveProviderConfig | null>(null)

export const hasConfigAtom = atom(
  (get) => {
    const config = get(configAtom)
    return config !== null && config.activeProvider !== ""
  }
)

export const activeProviderAtom = atom(
  (get) => {
    const config = get(configAtom)
    return config?.activeProvider || ""
  }
)

export const activeConfigAtom = atom(
  (get) => {
    const config = get(configAtom)
    if (!config?.activeProvider) return null
    return config.configs[config.activeProvider]
  }
)

export const providerConfigAtom = atom(
  (get) => (provider: ModelProvider) => {
    const config = get(configAtom)
    return config?.configs[provider] || null
  }
)

export const loadConfigAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/config/model")
      const data = await response.json()
      const config = data.config
      set(configAtom, config)
      return config
    } catch (error) {
      console.warn("Failed to load config:", error)
      return null
    }
  }
)

export const saveConfigAtom = atom(
  null,
  async (get, set, params: { 
    formData: ModelConfig
    provider: ModelProvider 
  }) => {
    const { formData, provider } = params
    const activeProvider = provider.startsWith("openai") ? "openai" : provider
    
    try {
      const response = await fetch("/api/config/model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: activeProvider,
          modelSettings: {
            ...formData,
            modelProvider: activeProvider,
            configuration: formData,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        const config = get(configAtom)
        if (config) {
          config.configs[activeProvider] = formData
        }
        set(configAtom, config)
      }
      return data
    } catch (error) {
      console.error("Failed to save config:", error)
      throw error
    }
  }
) 