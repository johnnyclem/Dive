import { InterfaceModelConfig, InterfaceModelConfigMap, ModelConfig } from "../atoms/configState"
import { useRef } from "react"
import { InterfaceProvider } from "../atoms/interfaceState"
import { ignoreFieldsForModel } from "../constants"
import { transformModelProvider } from "../helper/config"

export interface ModelVerifyStatus {
  name: string
  status: "verifying" | "abort" | Record<string, any>
}

export const useModelVerify = () => {
  const localListOptions = localStorage.getItem("modelVerify")
  const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
  const detail = useRef<ModelVerifyStatus[]>([])
  const pending = useRef<Set<Promise<void>>>(new Set())
  const controllers = useRef<Set<AbortController>>(new Set())
  const isAbort = useRef(false)
  const abortTimeout = useRef<NodeJS.Timeout | null>(null)

  const verify = async (needVerifyList: InterfaceModelConfigMap, onComplete: () => void, onUpdate?: (detail: ModelVerifyStatus[]) => void, onAbort?: () => void, timeout?: number) => {
    detail.current = []
    Object.entries(needVerifyList).forEach(([key, value]) => {
      detail.current.push({name: value.model ?? "", status: "verifying"})
    })

    onUpdate?.(detail.current)

    const entries = Object.entries(needVerifyList)
    const maxConcurrent = 10
    let nextIndex = 0

    if(timeout) {
      abortTimeout.current = setTimeout(() => {
        abort()
        if(abortTimeout.current)
          clearTimeout(abortTimeout.current)
        abortTimeout.current = null
        isAbort.current = true
      }, timeout)
    }

    const addNewTask = () => {
      if (isAbort.current || nextIndex >= entries.length)
        return null

      const [key, value] = entries[nextIndex++]
      const _value = value as InterfaceModelConfig
      const _key = _value.apiKey ?? _value.baseURL

      const controller = new AbortController()
      controllers.current.add(controller)

      const task = verifyModel(_value, controller.signal)
        .then(verifyResult => {
          const verifiedList = allVerifiedList[_key as string] ?? {}
          verifiedList[_value.model as string] = verifyResult
          allVerifiedList[_key as string] = verifiedList
          localStorage.setItem("modelVerify", JSON.stringify(allVerifiedList))
          const _detail = [...detail.current]
          _detail.find(item => item.name === _value.model)!.status = verifyResult
          detail.current = _detail
          onUpdate?.(detail.current)
        })
        .catch(error => {
          if (error.name === 'AbortError') {
            const _detail = [...detail.current]
            _detail.find(item => item.name === _value.model)!.status = "abort"
            detail.current = _detail
            onUpdate?.(detail.current)
          }
        })
        .finally(() => {
          controllers.current.delete(controller)
          pending.current.delete(task)
          const newTask = addNewTask()
          if (newTask) pending.current.add(newTask)
        })

      return task
    }

    while (!isAbort.current && pending.current.size < maxConcurrent && nextIndex < entries.length) {
      pending.current.add(addNewTask()!)
    }

    while (!isAbort.current && pending.current.size > 0) {
      await Promise.race(Array.from(pending.current))
    }

    if(!isAbort.current) {
      onComplete()
    } else {
      onAbort?.()
    }
    isAbort.current = false
  }

  const abort = () => {
    detail.current = []
    isAbort.current = true
    pending.current = new Set()
    controllers.current.forEach(controller => {
      controller.abort()
    })
    controllers.current = new Set()
    if(abortTimeout.current)
      clearTimeout(abortTimeout.current)
    abortTimeout.current = null
  }

  return { verify, abort }
}

const prepareModelConfig = (config: InterfaceModelConfig, provider: InterfaceProvider) => {
  const _config = {...config}
  if (provider === "openai" && config.baseURL) {
    delete (_config as any).baseURL
  }

  if (_config.topP === 0) {
    delete (_config as any).topP
  }

  if (_config.temperature === 0) {
    delete (_config as any).temperature
  }

  return Object.keys(_config).reduce((acc, key) => {
    if (ignoreFieldsForModel.some(item => (item.model === _config.model || _config.model?.startsWith(item.prefix)) && item.fields.includes(key))) {
      return acc
    }

    return {
      ...acc,
      [key]: _config[key as keyof ModelConfig]
    }
  }, {} as ModelConfig)
}

const verifyModel = async (modelConfig: InterfaceModelConfig, signal?: AbortSignal) => {
  try {
    const modelProvider = transformModelProvider(modelConfig.modelProvider)
    const configuration = {...modelConfig} as Partial<Pick<ModelConfig, "configuration">> & Omit<ModelConfig, "configuration">
    delete configuration.configuration

    const _formData = prepareModelConfig(modelConfig, modelConfig.modelProvider)

    const response = await fetch("/api/modelVerify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: modelProvider,
        modelSettings: {
          ..._formData,
          modelProvider,
          configuration,
        },
      }),
      signal
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error("Failed to verify model:", error)
    return false
  }
}