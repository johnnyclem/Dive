import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAtom, useAtomValue } from "jotai"
import { configSidebarVisibleAtom } from "../atoms/sidebarState"
import ModelConfigForm from "./ModelConfigForm"
import { defaultInterface, interfaceAtom, ModelProvider } from "../atoms/interfaceState"
import { activeProviderAtom, configAtom } from "../atoms/configState"
import CustomInstructions from "./CustomInstructions"
import { showToastAtom } from "../atoms/toastState"

const ConfigSidebar = () => {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useAtom(configSidebarVisibleAtom)
  const activeProvider = useAtomValue(activeProviderAtom)
  const [{ fields }] = useAtom(interfaceAtom)
  const [localProvider, setLocalProvider] = useState<ModelProvider>(activeProvider || "openai")
  const [config] = useAtom(configAtom)
  const [, showToast] = useAtom(showToastAtom)
  
  useEffect(() => {
    if (!isVisible) {
      setLocalProvider(activeProvider || "openai")
    }
  }, [isVisible, activeProvider, fields])

  const handleSubmit = async (data: any) => {
    try {
      if (data.success) {
        showToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
        setIsVisible(false)
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showToast({
        message: t("setup.saveFailed"),
        type: "error"
      })
    }
  }
  
  return (
    <>
      {isVisible && (
        <div className="modal-overlay" onClick={() => setIsVisible(false)} />
      )}
      <div className={`config-sidebar ${isVisible ? "visible" : ""}`}>
        <div className="config-header">
          <h2>{t("modelConfig.title")}</h2>
          <button 
            className="close-btn"
            onClick={() => setIsVisible(false)}
            title={t("common.close")}
          >
            <svg viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/>
            </svg>
          </button>
        </div>
        {isVisible && (
          <div className="config-content">
            <ModelConfigForm
              provider={localProvider}
              fields={defaultInterface[localProvider]}
              initialData={config?.configs[localProvider] || null}
              onProviderChange={setLocalProvider}
              onSubmit={handleSubmit}
            />
            <div className="divider" />
            <CustomInstructions />
          </div>
        )}
      </div>
    </>
  )
}

export default React.memo(ConfigSidebar) 