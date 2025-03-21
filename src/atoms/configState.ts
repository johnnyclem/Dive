import { atom } from "jotai"
import { EMPTY_PROVIDER, InterfaceProvider, ModelProvider } from "./interfaceState"
import { getModelPrefix } from "../util"

export type ProviderRequired = {
  apiKey: string
  baseURL: string
  model: string | null
}

export type ModelParameter = {
  topP: number
  temperature: number
}

export type ModelConfig = ProviderRequired & ModelParameter & {
  modelProvider: ModelProvider
  configuration: ProviderRequired & ModelParameter
  active: boolean
}

export type InterfaceModelConfig = Omit<ModelConfig, "modelProvider"> & {
  modelProvider: InterfaceProvider
}

export type ModelConfigMap = Record<string, ModelConfig>
export type InterfaceModelConfigMap = Record<string, InterfaceModelConfig>

export type RawModelConfig = {
  activeProvider: string
  configs: ModelConfigMap
}

export type MultiModelConfig = ProviderRequired & ModelParameter & {
  name: InterfaceProvider
  active: boolean
  checked: boolean
  models: string[]
}

export const configAtom = atom<RawModelConfig>({
  activeProvider: "",
  configs: {}
})

export const updateConfigWithProviderAtom = atom(
  null,
  (get, set, params: {
    provider: string
    data: ModelConfig
  }) => {
    const { provider, data } = params
    const config = get(configAtom)
    config.configs[provider] = data
    set(configAtom, {...config})
  }
)

export const activeConfigAtom = atom<ModelConfig | null>(
  (get) => {
    const config = get(configAtom)
    return !config ? null : config.configs[config.activeProvider] || null
  }
)

export const activeConfigIdAtom = atom<string>(
  (get) => {
    const config = get(configAtom)
    return !config ? "" : config.activeProvider
  }
)

export const enabledConfigsAtom = atom<ModelConfigMap>(
  (get) => {
    const configDict = get(configDictAtom)
    return Object.keys(configDict)
      .reduce((acc, key) => {
        const config = configDict[key]
        if(config.active && config.model) {
          acc[key] = config
        }

        return acc
      }, {} as ModelConfigMap)
  }
)

export const enabledModelsIdsAtom = atom<{key: string, name: string, provider: string}[]>(
  (get) => {
    const enabledConfigs = get(enabledConfigsAtom)
    return Object.keys(enabledConfigs).map((key) => ({
      key,
      name: `${getModelPrefix(enabledConfigs[key], 4)}/${enabledConfigs[key].model}`,
      provider: enabledConfigs[key].modelProvider
    }))
  }
)

export const configDictAtom = atom<ModelConfigMap>((get) => get(configAtom).configs)

export const isConfigNotInitializedAtom = atom(
  (get) => {
    const config = get(configAtom)
    return !config.activeProvider
  }
)

export const isConfigActiveAtom = atom(
  (get) => {
    const config = get(configAtom)
    return config !== null && config.activeProvider !== EMPTY_PROVIDER
  }
)

export const activeProviderAtom = atom<string>(
  (get) => {
    const config = get(configAtom)
    return config?.activeProvider || EMPTY_PROVIDER
  }
)

export const loadConfigAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/config/model")
      const data = await response.json()
      set(configAtom, data.config)
      return data.config
    } catch (error) {
      console.warn("Failed to load config:", error)
      return null
    }
  }
)

export const saveFirstConfigAtom = atom(
  null,
  async (get, set, params: {
    data: InterfaceModelConfig
    provider: InterfaceProvider
  }) => {
    const { data: config, provider } = params
    const modelProvider = transformModelProvider(provider)
    config.active = true
    const configuration: any = {...config} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">
    delete configuration.active
    delete configuration.checked
    delete configuration.configuration

    return set(writeRawConfigAtom, {
      providerConfigs: {
        [`${modelProvider}-0-0`]: {
          ...config,
          modelProvider,
          configuration,
        } as any
      },
      activeProvider: `${modelProvider}-0-0` as any
    })
  }
)

export const writeRawConfigAtom = atom(
  null,
  async (get, set, params: {
    providerConfigs: InterfaceModelConfigMap
    activeProvider?: InterfaceProvider
  }) => {
    const { providerConfigs, activeProvider } = params

    const configs = Object.keys(providerConfigs).reduce((acc, key) => {
      const config = providerConfigs[key] as any
      config.modelProvider = transformModelProvider(config.modelProvider)
      acc[key] = config as ModelConfig
      return acc
    }, {} as ModelConfigMap)

    try {
      const response = await fetch("/api/config/model/replaceAll", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          configs,
          enable_tools: true,
          activeProvider: activeProvider ?? get(activeProviderAtom),
        }),
      })

      const data = await response.json()
      if (data.success) {
        set(configAtom, {
          ...get(configAtom),
          configs,
          activeProvider: activeProvider ?? get(activeProviderAtom)
        })
      }
      return data
    } catch (error) {
      console.error("Failed to save config:", error)
      throw error
    }
  }
)

export const formatData = (data: InterfaceModelConfig|ModelConfig): MultiModelConfig => {
  const config = convertConfigToInterfaceModel(data)
  return {
    name: config.modelProvider,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    active: config.active ?? false,
    checked: false,
    models: config.model ? [config.model] : [],
    topP: config.topP ?? 0,
    temperature: config.temperature ?? 0,
    model: config.model,
  }
}

export const extractData = (data: InterfaceModelConfigMap|ModelConfigMap) => {
  const providerConfigList: MultiModelConfig[] = []

  Object.entries(data).forEach(([key, value]) => {
    if(!key.includes("-")){
      key = `${key}-${providerConfigList.length}-0`
    }
    const [name , index, modelIndex] = key.split("-")
    const _index = parseInt(index)

    if (!providerConfigList[_index]) {
      const _value: InterfaceModelConfig|ModelConfig = {...value}
      _value.modelProvider = name as InterfaceProvider
      providerConfigList[_index] = {
        ...formatData(_value),
      }
    } else if(value.model) {
      providerConfigList[_index].models.push(value.model)
    }
  })

  return providerConfigList
}

export const compressData = (data: MultiModelConfig, index: number) => {
  const compressedData: Record<string, InterfaceModelConfig> = {}

  const { models, ...restData } = data
  const modelsToProcess = models.length === 0 ? [null] : models
  modelsToProcess.forEach((model, modelIndex) => {
    const formData = {
      ...restData,
      model: model,
      modelProvider: data.name
    }
    const configuration = {...formData} as Partial<Pick<InterfaceModelConfig, "configuration">> & Omit<InterfaceModelConfig, "configuration">
    delete configuration.configuration
    compressedData[`${restData.name}-${index}-${modelIndex}`] = {
      ...formData,
      configuration: configuration as InterfaceModelConfig,
    }
  })

  return compressedData
}

export function transformModelProvider(provider: InterfaceProvider): ModelProvider {
  switch (provider) {
    case "openai_compatible":
      return "openai"
    case "google_genai":
      return "google-genai"
    default:
      return provider
  }
}

export function convertConfigToInterfaceModel(model: InterfaceModelConfig|ModelConfig): InterfaceModelConfig {
  switch (model.modelProvider) {
    case "openai":
      if (model.baseURL) {
        return {
          ...model,
          modelProvider: "openai_compatible"
        }
      }

      break
    case "google-genai":
      return {
        ...model,
        modelProvider: "google_genai"
      }
  }

  return model as InterfaceModelConfig
}

