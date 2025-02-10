import React, { useState } from "react"
import { useAtom } from "jotai"
import { interfaceAtom, updateProviderAtom } from "../atoms/interfaceState"
import { useTranslation } from "react-i18next"
import { useNavigate, useLocation } from "react-router-dom"
import { configAtom } from "../atoms/configState"
import Toast from "../components/Toast"
import ModelConfigForm from "../components/ModelConfigForm"

const Setup = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [{ provider, fields }, setInterface] = useAtom(interfaceAtom)
  const [, updateProvider] = useAtom(updateProviderAtom)
  const [config] = useAtom(configAtom)
  const isInitialSetup = location.pathname !== '/setup'
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const handleSubmit = async (formData: Record<string, any>) => {
    try {
      const response = await fetch("/api/config/model", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_settings: {
            ...formData,
            modelProvider: provider.startsWith("openai") ? "openai" : provider,
            configuration: formData,
          }
        }),
      })

      const data = await response.json()
      if (data.success) {
        setToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
        
        if (isInitialSetup) {
          setTimeout(() => window.location.reload(), 300)
        }
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      setToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
    }
  }

  return (
    <div className="setup-page">
      <div className="setup-container">
        {!isInitialSetup && (
          <button 
            className="back-btn"
            onClick={() => navigate(-1)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
            {t('setup.back')}
          </button>
        ) || (
          <>
            <h1>{t("setup.title")}</h1>
            <p className="subtitle">{t("setup.subtitle")}</p>
          </>
        )}

        <ModelConfigForm
          provider={provider}
          fields={fields}
          initialData={config}
          onProviderChange={updateProvider}
          onSubmit={handleSubmit}
          submitLabel="setup.submit"
          showVerify={true}
        />
      </div>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

export default React.memo(Setup) 