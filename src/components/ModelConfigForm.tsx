import React, { useState, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { FieldDefinition, ModelProvider, PROVIDER_LABELS } from "../atoms/interfaceState"
import { configAtom, ModelConfig, saveConfigAtom } from "../atoms/configState"
import { useAtom } from "jotai"
import { loadConfigAtom } from "../atoms/configState"
import { showToastAtom } from "../atoms/toastState"
import useDebounce from "../hooks/useDebounce"

const PROVIDERS: ModelProvider[] = ["openai", "openai_compatible", "ollama", "anthropic"]

interface ModelConfigFormProps {
  provider: ModelProvider
  fields: Record<string, FieldDefinition>
  initialData?: ModelConfig|null
  onProviderChange?: (provider: ModelProvider) => void
  onSubmit: (data: any) => void
  submitLabel?: string
  showVerify?: boolean
}

const ModelConfigForm: React.FC<ModelConfigFormProps> = ({
  provider,
  fields,
  initialData,
  onProviderChange,
  onSubmit,
  submitLabel = "setup.submit",
  showVerify = true
}) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<ModelConfig>(initialData || {} as ModelConfig)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isVerifying, setIsVerifying] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [listOptions, setListOptions] = useState<Record<string, string[]>>(initialData?.model ? { model: [initialData.model] } : {})
  const initProvider = useRef(provider)
  const [, loadConfig] = useAtom(loadConfigAtom)
  const [config] = useAtom(configAtom)
  const [, saveConfig] = useAtom(saveConfigAtom)
  const [, showToast] = useAtom(showToastAtom)

  const [fetchListOptions, cancelFetch] = useDebounce(async (key: string, field: FieldDefinition, deps: Record<string, string>) => {
    try {
      const options = await field.listCallback!(deps)
      setListOptions(prev => ({
        ...prev,
        [key]: options
      }))
      
      if (options.length > 0 && !options.includes(formData[key as keyof ModelConfig] as string)) {
        handleChange(key, options[0])
      }
    } catch (error) {
      showToast({
        message: t("setup.verifyError"),
        type: "error"
      })
    }
  }, 100)

  useEffect(() => {
    if (initProvider.current !== provider) {
      setListOptions({})
      setFormData(Object.assign(getFieldDefaultValue(), config?.configs[provider] || {} as ModelConfig))
    } else {
      setListOptions(initialData?.model ? { model: [initialData.model] } : {})
      setFormData(initialData || {} as ModelConfig)
    }
  }, [provider])

  useEffect(() => {
    Object.entries(fields).forEach(([key, field]) => {
      if (field.type === "list" && field.listCallback && field.listDependencies) {
        const deps = field.listDependencies.reduce((acc, dep) => ({
          ...acc,
          [dep]: formData[dep as keyof ModelConfig] || ""
        }), {})

        const allDepsHaveValue = field.listDependencies.every(dep => !!formData[dep as keyof ModelConfig])
        
        if (allDepsHaveValue) {
          fetchListOptions(key, field, deps)
        }
      }
    })

    return () => {
      cancelFetch()
    }
  }, [fields, formData])
  
  const getFieldDefaultValue = () => {
    return Object.keys(fields).reduce((acc, key) => {
      return {
        ...acc,
        [key]: fields[key].default
      }
    }, {} as ModelConfig)
  }

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = e.target.value as ModelProvider
    onProviderChange?.(newProvider)
    setIsVerified(false)
  }

  const verifyModel = async () => {
    try {
      setIsVerifying(true)
      const _provider = provider.startsWith("openai") ? "openai" : provider
      const response = await fetch("/api/modelVerify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: _provider,
          modelSettings: {
            ...formData,
            modelProvider: _provider,
            configuration: formData,
          },
        }),
      })

      const data = await response.json()
      if (data.success) {
        setIsVerified(true)
        showToast({
          message: t("setup.verifySuccess"),
          type: "success"
        })
      } else {
        setIsVerified(false)
        showToast({
          message: t("setup.verifyFailed"),
          type: "error"
        })
      }
    } catch (error) {
      console.error("Failed to verify model:", error)
      setIsVerified(false)
      showToast({
        message: t("setup.verifyError"),
        type: "error"
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm())
      return
    
    try {
      setIsSubmitting(true)
      const data = await saveConfig({ formData, provider })
      await onSubmit(data)
      loadConfig()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }))
    setErrors(prev => ({
      ...prev,
      [key]: ""
    }))
    setIsVerified(false)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    Object.entries(fields).forEach(([key, field]) => {
      if (field.required && !formData[key as keyof ModelConfig]) {
        newErrors[key] = t("setup.required")
      }
    })

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return false
    }
    return true
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-group">
        <label>{t("setup.provider")}</label>
        <select 
          value={provider} 
          onChange={handleProviderChange}
          className="provider-select"
        >
          {PROVIDERS.map(p => (
            <option key={p} value={p}>{PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {Object.entries(fields).map(([key, field]) => (
        <div key={key} className="form-group">
          <label>
            {field.label}
            {field.required && <span className="required">*</span>}
          </label>
          <div className="field-description">{field.description}</div>
          {field.type === "list" ? (
            <select
              value={formData[key as keyof ModelConfig] as string || ""}
              onChange={e => handleChange(key, e.target.value)}
              className={errors[key] ? "error" : ""}
            >
              <option value="">{field.placeholder}</option>
              {listOptions[key]?.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={"text"}
              value={formData[key as keyof ModelConfig] as string || ""}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={field.placeholder?.toString()}
              className={errors[key] ? "error" : ""}
            />
          )}
          {errors[key] && <div className="error-message">{errors[key]}</div>}
        </div>
      ))}

      <div className="form-actions">
        {showVerify && (
          <button 
            type="button" 
            className="verify-btn"
            onClick={verifyModel}
            disabled={isVerifying || isSubmitting}
          >
            {isVerifying ? (
              <div className="loading-spinner"></div>
            ) : t("setup.verify")}
          </button>
        )}
        <button 
          type="submit" 
          className="submit-btn"
          disabled={isVerifying || isSubmitting || (showVerify && !isVerified)}
        >
          {isSubmitting ? (
            <div className="loading-spinner"></div>
          ) : t(submitLabel)}
        </button>
      </div>
    </form>
  )
}

export default React.memo(ModelConfigForm) 