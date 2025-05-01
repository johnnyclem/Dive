import { Dispatch, ReactNode, SetStateAction, createContext, useContext, useEffect, useState } from "react";
import { configAtom, configDictAtom, loadConfigAtom, MultiModelConfig, writeRawConfigAtom, InterfaceModelConfig, prepareModelConfig, InterfaceModelConfigMap } from "../../../atoms/configState";
import { useAtomValue, useSetAtom } from "jotai";
import { FieldDefinition, InterfaceProvider } from "../../../atoms/interfaceState";
import { compressData, extractData } from "../../../helper/config";
import { getVerifyStatus, ModelVerifyStatus } from "./ModelVerify";
import defaultModelsRaw from "../../../../electron/main/default-models.json"

interface DefaultModels {
  configs: Record<string, unknown>
  activeProvider: InterfaceProvider
  enable_tools?: boolean
  enableTools?: boolean
}

const defaultModels: DefaultModels = defaultModelsRaw as unknown as DefaultModels;

export type ListOption = {
  name: string
  checked: boolean
  supportTools?: boolean
  verifyStatus: ModelVerifyStatus
  isCustom: boolean
}

type ContextType = {
  multiModelConfigList?: MultiModelConfig[]
  setMultiModelConfigList: Dispatch<SetStateAction<MultiModelConfig[]>>
  parameter: Record<string, number>
  setParameter: (parameter: Record<string, number>) => void
  currentIndex: number
  setCurrentIndex: (currentIndex: number) => void
  listOptions: ListOption[]
  setListOptions: Dispatch<SetStateAction<ListOption[]>>
  fetchListOptions: (multiModelConfig: MultiModelConfig, fields: Record<string, FieldDefinition>) => Promise<ListOption[]>
  prepareModelConfig: (config: InterfaceModelConfig, provider: InterfaceProvider) => InterfaceModelConfig
  saveConfig: (activeProvider?: InterfaceProvider) => Promise<{ success: boolean, error?: string }>
}

const context = createContext<ContextType>({} as ContextType)

export default function ModelsProvider({
  children,
}:{
  children: ReactNode
}) {
  const configList = useAtomValue(configDictAtom)
  const config = useAtomValue(configAtom)
  const loadConfig = useSetAtom(loadConfigAtom)
  const saveAllConfig = useSetAtom(writeRawConfigAtom)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [listOptions, setListOptions] = useState<ListOption[]>([])
  const [multiModelConfigList, setMultiModelConfigList] = useState<MultiModelConfig[]>([])
  const [parameter, setParameter] = useState<Record<string, number>>(JSON.parse(localStorage.getItem("ConfigParameter") || "{}"))

  const getMultiModelConfigList = (): Promise<MultiModelConfig[]> => {
    return new Promise(resolve => {
      setMultiModelConfigList(prev => {
        resolve(prev)
        return prev
      })
    })
  }

  const getParameter = (): Promise<Record<string, number>> => {
    return new Promise(resolve => {
      setParameter(prev => {
        resolve(prev)
        return prev
      })
    })
  }

  useEffect(() => {
    const fetchData = async () => {
      let data = await loadConfig()

      if (!data || !data.configs || Object.keys(data.configs).length === 0) {
        try {
          await saveAllConfig({
            providerConfigs: defaultModels.configs as unknown as InterfaceModelConfigMap,
            activeProvider: defaultModels.activeProvider,
          })

          data = await loadConfig()
        } catch (err) {
          console.error("Failed to load default model configs:", err)
        }
      }

      if (!data || !data.configs || Object.keys(data.configs).length === 0) {
        const _parameter = localStorage.getItem("ConfigParameter")
        if(_parameter){
          setParameter(JSON.parse(_parameter))
        }
        return
      }
      let providerConfigList: MultiModelConfig[] = extractData(data.configs)

      // If providerConfigList is still empty, attempt to populate defaults once
      if (providerConfigList.length === 0) {
        try {
          await saveAllConfig({
            providerConfigs: defaultModels.configs as unknown as InterfaceModelConfigMap,
            activeProvider: defaultModels.activeProvider,
          })

          data = await loadConfig()
          providerConfigList = extractData(data?.configs ?? {})
        } catch (err) {
          console.error("Failed to reload default model configs after empty list:", err)
        }
      }

      setMultiModelConfigList(providerConfigList)

      if (providerConfigList && providerConfigList.length > 0) {
        const _topP = providerConfigList.find(config => config.topP)
        const _temperature = providerConfigList.find(config => config.temperature)
        setParameter({
          topP: _topP?.topP ?? 0,
          temperature: _temperature?.temperature ?? 0,
        })
      } else {
        const parameter = localStorage.getItem("ConfigParameter")
        if (parameter) {
          setParameter(JSON.parse(parameter))
        }
        return
      }
    }
    fetchData()
  }, [config?.activeProvider])

  useEffect(() => {
    if(multiModelConfigList && multiModelConfigList?.length > 0){
      localStorage.removeItem("ConfigParameter")
    }
  }, [multiModelConfigList])

  const fetchListOptions = async (multiModelConfig: MultiModelConfig, fields: Record<string, FieldDefinition>) => {
    // Guard against undefined fields to avoid runtime errors
    if (!fields) {
      return []
    }
    const localListOptions = localStorage.getItem("modelVerify")
    const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
    const verifyList = allVerifiedList[multiModelConfig.apiKey || multiModelConfig.baseURL]
    const newListOptions: ListOption[] = []

    //get local custom model list
    const customModelListText = localStorage.getItem("customModelList")
    if(customModelListText){
      const customModelList = JSON.parse(customModelListText)
      const _customModelList = customModelList[`${multiModelConfig.apiKey || multiModelConfig.baseURL || multiModelConfig.accessKeyId}`]
      if(Array.isArray(_customModelList)){
        _customModelList.forEach((option: string) => {
          newListOptions.push({
            name: option,
            checked: multiModelConfig.models.includes(option),
            verifyStatus:  getVerifyStatus(verifyList?.[option]) ?? "unVerified",
            isCustom: true
          })
        })
      }
    }

    try {
      let options: string[] = []
      for (const field of Object.values(fields)) {
        if (field.type === "list" && field.listCallback && field.listDependencies) {
          const deps = field.listDependencies.reduce((acc, dep) => ({
            ...acc,
            [dep]: String(multiModelConfig[dep as keyof MultiModelConfig] ?? "")
          }), {} as Record<string, string>)
          const result = await field.listCallback(deps)
          options = Array.isArray(result) ? result.filter(item => typeof item === 'string') : []
        }
      }

      for (const option of options) {
        newListOptions.push({
          name: option,
          checked: multiModelConfig.models.includes(option),
          verifyStatus: getVerifyStatus(verifyList?.[option]) ?? "unVerified",
          isCustom: false
        })
      }
    } catch (error) {
      // if listCallback failed and custom model list is empty, throw error
      if(!customModelListText) {
        throw error
      }
      const customModelList = JSON.parse(customModelListText)
      const _customModelList = customModelList[`${multiModelConfig.apiKey || multiModelConfig.baseURL || multiModelConfig.accessKeyId}`]
      if(!_customModelList || !_customModelList.length) {
        throw error
      }
    }
    return newListOptions
  }

  const saveConfig = async (newActiveProvider?: InterfaceProvider) => {
    let compressedData: Record<string, InterfaceModelConfig> = {}
    const _multiModelConfigList = await getMultiModelConfigList()
    const _parameter = await getParameter()
    _multiModelConfigList.forEach((multiModelConfig, index) => {
      multiModelConfig = Object.assign(multiModelConfig, _parameter)
      compressedData = Object.assign(compressedData, compressData(multiModelConfig, index))
    })
    Object.entries(compressedData).forEach(([key, value]) => {
      if (value !== undefined) {
        compressedData[key] = prepareModelConfig(value, value.modelProvider)
      }
    })

    let _activeProvider = newActiveProvider ?? (config?.activeProvider ?? "")
    const model = configList?.[_activeProvider]?.model
    const existModel = Object.keys(compressedData).find(key => compressedData[key].active && compressedData[key].model === model) as InterfaceProvider
    const activeModel = Object.keys(compressedData).filter(key => compressedData[key].active)
    _activeProvider = existModel ?? "none"
    _activeProvider = activeModel?.length == 1 ? activeModel[0] : _activeProvider

    if(!_multiModelConfigList?.length){
      const _parameter = await getParameter()
      localStorage.setItem("ConfigParameter", JSON.stringify(_parameter))
    }

    return await saveAllConfig({ providerConfigs: compressedData, activeProvider: _activeProvider as InterfaceProvider })
  }

  return (
    <context.Provider value={{
      multiModelConfigList,
      setMultiModelConfigList,
      parameter,
      setParameter,
      currentIndex,
      setCurrentIndex,
      listOptions,
      setListOptions,
      fetchListOptions,
      prepareModelConfig,
      saveConfig
    }}>
      {children}
    </context.Provider>
  )
}

export function useModelsProvider() {
  return useContext(context)
}