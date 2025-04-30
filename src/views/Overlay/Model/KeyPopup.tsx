import { useTranslation } from "react-i18next"
import { InterfaceModelConfig, ModelConfig } from "../../../atoms/configState"
import { defaultInterface, FieldDefinition, InterfaceProvider, PROVIDER_LABELS, PROVIDERS } from "../../../atoms/interfaceState"
import { useEffect, useRef, useState } from "react"
import { showToastAtom } from "../../../atoms/toastState"
import { useAtom } from "jotai"
import React from "react"
import { useModelsProvider } from "./ModelsProvider"
import { formatData } from "../../../helper/config"
import CheckBox from "../../../components/CheckBox"
import Tooltip from "../../../components/Tooltip"
import Modal, { FooterAction } from "../../../components/common/Modal"
import { Select, SelectItem, Input } from "@heroui/react"

const KeyPopup = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (customModelId?: string) => void
}) => {
  const { t } = useTranslation()
  const [provider, setProvider] = useState<InterfaceProvider>('ollama')
  const [fields, setFields] = useState<Record<string, FieldDefinition>>(defaultInterface['ollama'])
  const defaultOllamaURL = defaultInterface['ollama'].baseURL.default as string
  // Initial full InterfaceModelConfig for Ollama
  const initialFormData: InterfaceModelConfig = {
    apiKey: '',
    baseURL: defaultOllamaURL,
    model: '',
    modelProvider: 'ollama',
    active: true,
    topP: 0,
    temperature: 0,
    configuration: {
      topP: 0,
      temperature: 0,
    },
  }
  const [formData, setFormData] = useState<InterfaceModelConfig>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customModelId, setCustomModelId] = useState<string>("")
  const [verifyError, setVerifyError] = useState<string>("")
  const isVerifying = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)
  const [showOptional, setShowOptional] = useState<Record<string, boolean>>({})

  const { multiModelConfigList, setMultiModelConfigList,
    saveConfig, prepareModelConfig,
    fetchListOptions, setCurrentIndex
  } = useModelsProvider()

  useEffect(() => {
    return () => {
      isVerifying.current = false
    }
  }, [])

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as InterfaceProvider
    setProvider(newProvider)
    setFields(defaultInterface[newProvider])
    // Reset formData for selected provider
    const resetData: InterfaceModelConfig = {
      apiKey: '',
      baseURL: newProvider === 'ollama' ? defaultOllamaURL : '',
      model: '',
      modelProvider: newProvider,
      active: true,
      topP: 0,
      temperature: 0,
      configuration: {
        topP: 0,
        temperature: 0,
      },
    }
    setFormData(resetData)
    setErrors({})
    setVerifyError("")
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key as keyof InterfaceModelConfig] && key !== "customModelId") {
        newErrors[key] = t("setup.required")
      }
    })

    if (fields["customModelId"]?.required && !customModelId) {
      newErrors["customModelId"] = t("setup.required")
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    return true
  }

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (data.success) {
        onSuccess(customModelId)
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
    }
  }

  const onConfirm = async () => {
    if (!validateForm())
      return

    const __formData = {
      ...formData,
      baseURL: (!fields?.baseURL?.required && !showOptional[provider]) ? "" : formData.baseURL,
    }

    let existingIndex = -1
    if (multiModelConfigList && multiModelConfigList.length > 0) {
      if (__formData.baseURL) {
        if (__formData.apiKey) {
          existingIndex = multiModelConfigList.findIndex(config =>
            config.baseURL === __formData.baseURL &&
            config.apiKey === __formData.apiKey
          )
        } else {
          existingIndex = multiModelConfigList.findIndex(config =>
            config.baseURL === __formData.baseURL
          )
        }
      } else if (__formData.apiKey) {
        existingIndex = multiModelConfigList.findIndex(config =>
          config.apiKey === __formData.apiKey
        )
      }
    }

    if (existingIndex !== -1) {
      setCurrentIndex(existingIndex)
      onSuccess()
      return
    }

    const _formData = prepareModelConfig(__formData, provider)
    const multiModelConfig = {
      ...formatData(_formData),
      name: provider,
    }

    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))

    try {
      setErrors({})
      setVerifyError("")
      setIsSubmitting(true)
      isVerifying.current = true

      //if custom model id is required, still need to check if the key is valid
      if (!customModelId || fields["customModelId"]?.required) {
        const listOptions = await fetchListOptions(multiModelConfig, fields)

        //if custom model id is required, it doesn't need to check if listOptions is empty
        //because fetchListOptions in pre step will throw error if the key is invalid
        if (!listOptions?.length && !fields["customModelId"]?.required) {
          const newErrors: Record<string, string> = {}
          newErrors["apiKey"] = t("models.apiKeyError")
          setErrors(newErrors)
          return
        }
      }

      if (customModelId) {
        // save custom model list to local storage
        const customModelList = localStorage.getItem("customModelList")
        const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
        localStorage.setItem("customModelList", JSON.stringify({
          ...allCustomModelList,
          [formData.accessKeyId || _formData.apiKey || _formData.baseURL]: [customModelId]
        }))
      }

      setMultiModelConfigList([...(multiModelConfigList ?? []), multiModelConfig])
      setCurrentIndex((multiModelConfigList?.length ?? 0))
      const data = await saveConfig()
      await handleSubmit(data)
    } catch (error) {
      setVerifyError((error as Error).message)
      setMultiModelConfigList(_multiModelConfigList)
    } finally {
      setIsSubmitting(false)
      isVerifying.current = false
    }
  }

  const handleClose = () => {
    if (isVerifying.current) {
      showToast({
        message: t("models.verifyingAbort"),
        type: "error"
      })
    }
    onClose()
  }

  const handleCopiedError = async (text: string) => {
    await navigator.clipboard.writeText(text)
    showToast({
      message: t("toast.copiedToClipboard"),
      type: "success"
    })
  }

  // Define footer actions for the new Modal
  const footerActions: FooterAction[] = [
    {
      label: t("common.cancel"),
      onClick: handleClose,
      variant: "flat", // Example variant
    },
    {
      label: t("tools.save"),
      onClick: onConfirm,
      isLoading: isSubmitting || isVerifying.current,
      isDisabled: isSubmitting || isVerifying.current,
      color: "primary",
      closeModalOnClick: false, // Let onSuccess handle closing via parent
    },
  ]

  return (
    <Modal
      isOpen={true} // Modal is open if KeyPopup is rendered
      onClose={handleClose}
      title={t("models.newProvider")}
      footerActions={footerActions}
      size="xl" // Adjust size as needed, e.g., "xl" or "2xl"
    >
      <div className="flex flex-col gap-4">
        <Select
          label="API Provider"
          selectedKeys={[provider]}
          onChange={handleProviderChange}
          aria-label="Select API Provider"
          variant="bordered"
        >
          {PROVIDERS.map((p) => (
            <SelectItem key={p}>
              {PROVIDER_LABELS[p]}
            </SelectItem>
          ))}
        </Select>

        {Object.entries(fields).map(([key, field]) => (
          key !== "model" && key !== "customModelId" && (
            <div key={key}>
              {key === "baseURL" && !field.required ? (
                <div className="flex items-center gap-2 mb-1">
                  <CheckBox
                    checked={showOptional[provider]}
                    onChange={(e) => setShowOptional(prev => ({ ...prev, [provider]: e.target.checked }))}
                  />
                  <span className="text-sm">{`${field.label}${t("models.optional")}`}</span>
                </div>
              ) : null}

              {(showOptional[provider] || key !== "baseURL" || field.required) && (
                <Input
                  label={(key !== "baseURL" || field.required) ? field.label : undefined}
                  aria-label={field.label}
                  type="text"
                  value={(formData[key as keyof ModelConfig] as string) || field.default?.toString() || ""}
                  onValueChange={value => handleChange(key, value)}
                  placeholder={field.placeholder?.toString()}
                  description={(key !== "baseURL" || field.required) ? field.description : undefined}
                  isRequired={field.required}
                  isInvalid={!!errors[key]}
                  errorMessage={errors[key]}
                  variant="bordered"
                  labelPlacement={(key !== "baseURL" || field.required) ? "outside" : "inside"}
                />
              )}
            </div>
          )
        ))}

        <Input
          label="Custom Model ID"
          value={customModelId}
          onValueChange={setCustomModelId}
          placeholder="YOUR_MODEL_ID"
          description={fields["customModelId"]?.required ? undefined : t("models.optional")}
          isRequired={fields["customModelId"]?.required}
          isInvalid={!!errors["customModelId"]}
          errorMessage={errors["customModelId"]}
          variant="bordered"
          labelPlacement="outside"
        />

        {verifyError && (
          <Tooltip content={t("models.copyContent")}>
            <div onClick={() => handleCopiedError(verifyError)} className="text-sm text-danger cursor-pointer flex items-center gap-1">
              {verifyError}
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </div>
          </Tooltip>
        )}
      </div>
    </Modal>
  )
}

export default React.memo(KeyPopup)