import { useAtomValue, useSetAtom } from "jotai"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import Switch from "../components/Switch"
import PopupConfirm from "../components/PopupConfirm"
import { MultiModelConfig } from "../atoms/configState"
import KeyPopup from "../views/Overlay/Model/KeyPopup"
import ModelPopup from "../views/Overlay/Model/Popup"
import ParameterPopup from "../views/Overlay/Model/ParameterPopup"
import { useModelsProvider } from "../views/Overlay/Model/ModelsProvider"
import { showToastAtom } from "../atoms/toastState"
import { InterfaceProvider, PROVIDER_ICONS, PROVIDER_LABELS } from "../atoms/interfaceState"
import { getVerifyStatus } from "../views/Overlay/Model/ModelVerify"
import Dropdown from "../components/DropDown"
import Tooltip from "../components/Tooltip"
import KeyPopupEdit from "../views/Overlay/Model/KeyPopupEdit"
import { systemThemeAtom, userThemeAtom } from "../atoms/themeState"
import ModelsProvider from "../views/Overlay/Model/ModelsProvider"
import { Button } from "@heroui/react"

const ModelSettingsPageContent = () => {
  const { t } = useTranslation()
  const [showDelete, setShowDelete] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showKeyPopup, setShowKeyPopup] = useState(false)
  const [showKeyPopupEdit, setShowKeyPopupEdit] = useState(false)
  const [defaultModel, setDefaultModel] = useState("")
  const [showModelPopup, setShowModelPopup] = useState(false)
  const [showNoModelAlert, setShowNoModelAlert] = useState(false)
  const [showParameterPopup, setShowParameterPopup] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const systemTheme = useAtomValue(systemThemeAtom)
  const userTheme = useAtomValue(userThemeAtom)

  const { multiModelConfigList, setMultiModelConfigList,
    currentIndex, setCurrentIndex, saveConfig
  } = useModelsProvider()

  console.log('multiModelConfigList', multiModelConfigList)

  const saveMultiModelConfigChanges = async (newMultiModelConfigList: MultiModelConfig[]) => {
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))
    try {
      const _activeProvider = newMultiModelConfigList.filter((config: MultiModelConfig) => config.active && config.models.length > 0).length === 0 ? "none" : undefined
      setMultiModelConfigList(newMultiModelConfigList)
      const data = await saveConfig(_activeProvider as InterfaceProvider)
      if (data.success) {
        showToast({
          message: t("setup.saveSuccess"),
          type: "success"
        })
      } else {
        showToast({
          message: data.error ?? t("setup.saveFailed"),
          type: "error"
        })
        setMultiModelConfigList(_multiModelConfigList)
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      setMultiModelConfigList(_multiModelConfigList)
    }
  }

  const handleMultiModelConfigChange = async (index: number, key: keyof MultiModelConfig, value: MultiModelConfig[keyof MultiModelConfig]) => {
    const newMultiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList)) ?? []
    setCurrentIndex(index)

    if (!value && isNoModelAlert(index)) {
      setShowClose(true)
    } else {
      newMultiModelConfigList[index][key] = value
      await saveMultiModelConfigChanges(newMultiModelConfigList)
    }
  }

  const handleNewKeySubmit = (defaultModel?: string) => {
    setShowKeyPopup(false)
    setShowModelPopup(true)
    setDefaultModel(defaultModel || "")
  }

  const handleKeyPopupEditSubmit = (defaultModel?: string) => {
    setShowKeyPopupEdit(false)
    setShowModelPopup(true)
    setDefaultModel(defaultModel || "")
  }

  const getModelCount = (config: MultiModelConfig, ifSupport: boolean = true) => {
    const modelVerifyText = localStorage.getItem("modelVerify")
    const allVerifiedList = modelVerifyText ? JSON.parse(modelVerifyText) : {}
    const currentVerifyList = allVerifiedList[config.apiKey || config.baseURL] ?? {}
    return config.models.filter(model => ifSupport ? getVerifyStatus(currentVerifyList[model]) !== "unSupportModel" : getVerifyStatus(currentVerifyList[model]) === "unSupportModel").length
  }

  const isNoModelAlert = (targetIndex?: number) => {
    return multiModelConfigList?.filter((config, index) => index !== (targetIndex ?? currentIndex)
      && config.active
      && getModelCount(config, true) > 0)?.length === 0
      && multiModelConfigList?.[(targetIndex ?? currentIndex)]
      && multiModelConfigList?.[(targetIndex ?? currentIndex)]?.active
      && getModelCount(multiModelConfigList?.[(targetIndex ?? currentIndex)], true) > 0
  }

  const openModelPopup = async (index: number) => {
    setCurrentIndex(index)
    setShowModelPopup(true)
  }

  const handleModelSubmit = () => {
    setDefaultModel("")
    setShowModelPopup(false)
    if (multiModelConfigList?.[currentIndex]
      && multiModelConfigList?.[currentIndex]?.active
      && multiModelConfigList?.[currentIndex]?.models.length > 0
      && getModelCount(multiModelConfigList?.[currentIndex], true) === 0) {
      setShowNoModelAlert(true)
    }
  }

  const handleConfirm = async (type: "delete" | "close") => {
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList)) ?? []
    try {
      const targetConfig = multiModelConfigList?.[currentIndex]
      let newMultiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList)) ?? []
      let successMsg = "", errorMsg = ""

      if (type === "delete") {
        newMultiModelConfigList = multiModelConfigList?.filter((config, index) => index !== currentIndex) ?? []
        successMsg = t("models.deleteToast", { name: targetConfig?.name ?? "" })
        errorMsg = t("models.deleteFailed")
      } else {
        newMultiModelConfigList.map((multiModelConfig: MultiModelConfig, index: number) => {
          if (currentIndex > -1 && index == currentIndex) {
            newMultiModelConfigList[index].active = false
          }
        })
        successMsg = t("setup.saveSuccess")
        errorMsg = t("models.saveFailed")
      }

      const _activeProvider = newMultiModelConfigList.filter((config: MultiModelConfig) => config.active && config.models.length > 0).length === 0 ? "none" : undefined
      setMultiModelConfigList(newMultiModelConfigList)
      const data = await saveConfig(_activeProvider as InterfaceProvider)
      if (data.success) {
        showToast({
          message: successMsg,
          type: "success"
        })
        if (type === "delete") {
          const key = `${targetConfig?.accessKeyId || targetConfig?.apiKey || targetConfig?.baseURL}`
          const customModelList = localStorage.getItem("customModelList")
          const allCustomModelList = customModelList ? JSON.parse(customModelList) : {}
          delete allCustomModelList[key]
          localStorage.setItem("customModelList", JSON.stringify(allCustomModelList))
          const localListOptions = localStorage.getItem("modelVerify")
          const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
          delete allVerifiedList[key]
          localStorage.setItem("modelVerify", JSON.stringify(allVerifiedList))
        }
      } else {
        showToast({
          message: data.error ?? errorMsg,
          type: "error"
        })
        setMultiModelConfigList(_multiModelConfigList)
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      setMultiModelConfigList(_multiModelConfigList)
    }
    setShowDelete(false)
    setShowClose(false)
  }

  const isProviderIconNoFilter = (model: string) => {
    const isLightMode = userTheme === "system" ? systemTheme === "light" : userTheme === "light"
    switch (model) {
      case "ollama":
      case "openai_compatible":
      case "bedrock":
        return true
      case "mistralai":
        return isLightMode
      default:
        return model.startsWith("google") && isLightMode
    }
  }

  return (
    <div className="model-settings-container">
      <div className="flex-1 flex flex-col bg-bg-ultradark rounded-[24px] overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col px-5 pb-5 gap-5 overflow-hidden min-h-0">
          <div className="flex items-center justify-between">
            <div className="text-2xl flex">
              <svg width="30px" height="30px" color="currentColor" viewBox="0 0 46 46"><g><path d="M 18.433594 6.460938 C 12.210938 9.570312 12.851562 8.660156 12.851562 14.375 L 12.851562 19.246094 L 8.726562 21.375 L 4.566406 23.507812 L 4.566406 35.34375 L 9.300781 37.78125 C 11.90625 39.132812 14.238281 40.25 14.476562 40.25 C 14.714844 40.25 16.742188 39.304688 19.042969 38.1875 L 23.167969 36.089844 L 27.261719 38.1875 C 29.527344 39.304688 31.558594 40.25 31.761719 40.25 C 32.367188 40.25 40.757812 35.953125 41.195312 35.414062 C 41.5 35.042969 41.601562 33.351562 41.535156 29.222656 L 41.433594 23.507812 L 37.308594 21.375 L 33.148438 19.246094 L 33.148438 14.410156 C 33.148438 10.214844 33.078125 9.503906 32.570312 9.066406 C 31.660156 8.253906 23.777344 4.398438 23.101562 4.429688 C 22.761719 4.429688 20.667969 5.34375 18.433594 6.460938 Z M 26.042969 8.761719 L 28.582031 10.078125 L 25.808594 11.433594 L 23.066406 12.785156 L 20.394531 11.398438 L 17.691406 10.011719 L 20.261719 8.761719 C 21.679688 8.050781 23 7.476562 23.167969 7.476562 C 23.371094 7.476562 24.65625 8.050781 26.042969 8.761719 Z M 18.941406 13.867188 L 21.648438 15.21875 L 21.648438 18.601562 C 21.648438 20.464844 21.578125 21.984375 21.476562 21.984375 C 21.375 21.984375 20.089844 21.375 18.601562 20.632812 L 15.898438 19.28125 L 15.898438 15.898438 C 15.898438 14.035156 15.964844 12.515625 16.066406 12.515625 C 16.167969 12.515625 17.453125 13.125 18.941406 13.867188 Z M 30.101562 15.898438 L 30.101562 19.28125 L 27.398438 20.632812 C 25.910156 21.375 24.625 21.984375 24.523438 21.984375 C 24.421875 21.984375 24.351562 20.496094 24.351562 18.671875 L 24.351562 15.355469 L 27.160156 13.96875 C 28.683594 13.191406 29.96875 12.546875 30.035156 12.546875 C 30.070312 12.515625 30.101562 14.035156 30.101562 15.898438 Z M 17.082031 25.773438 L 14.410156 27.125 L 11.667969 25.808594 L 8.964844 24.453125 L 11.667969 23.066406 L 14.375 21.714844 L 17.082031 23.066406 L 19.785156 24.421875 Z M 34.332031 25.773438 L 31.660156 27.125 L 28.917969 25.808594 L 26.214844 24.453125 L 28.917969 23.066406 L 31.625 21.714844 L 34.332031 23.066406 L 37.035156 24.421875 Z M 12.851562 33.011719 L 12.851562 36.429688 L 7.101562 33.453125 L 7.101562 26.71875 L 12.851562 29.5625 Z M 21.511719 33.382812 C 21.410156 33.621094 20.089844 34.433594 18.601562 35.144531 L 15.898438 36.460938 L 15.898438 29.5625 L 18.703125 28.207031 L 21.476562 26.820312 L 21.578125 29.867188 C 21.613281 31.558594 21.613281 33.113281 21.511719 33.382812 Z M 30.101562 33.011719 L 30.101562 36.429688 L 24.351562 33.453125 L 24.351562 26.71875 L 30.101562 29.5625 Z M 38.761719 33.382812 C 38.660156 33.621094 37.339844 34.433594 35.851562 35.144531 L 33.148438 36.460938 L 33.148438 29.5625 L 35.953125 28.207031 L 38.726562 26.820312 L 38.828125 29.867188 C 38.863281 31.558594 38.863281 33.113281 38.761719 33.382812 Z M 38.761719 33.382812 " /></g></svg>
              {t("models.listTitle")}
            </div>
            <div className="flex items-center gap-[10px]">
              {showClose && (
                <PopupConfirm
                  noBorder={true} zIndex={900} footerType="center" className="models-delete-confirm"
                  onConfirm={() => handleConfirm("close")} onCancel={() => setShowClose(false)} onClickOutside={() => setShowClose(false)}
                >
                  <div className="models-delete-confirm-content">
                    <div className="models-delete-confirm-title">{t("models.closeAllTitle")}</div>
                    <div className="models-delete-confirm-description">{t("models.closeAllDescription")}</div>
                  </div>
                </PopupConfirm>
              )}
              {showDelete && (
                <PopupConfirm
                  noBorder={true} zIndex={900} footerType="center" className="models-delete-confirm"
                  onConfirm={() => handleConfirm("delete")} onCancel={() => setShowDelete(false)} onClickOutside={() => setShowDelete(false)}
                >
                  <div className="models-delete-confirm-content">
                    <div className="models-delete-confirm-title">{isNoModelAlert() ? t("models.deleteAllTitle") : t("models.deleteTitle", { name: multiModelConfigList?.[currentIndex]?.name ?? "" })}</div>
                    <div className="models-delete-confirm-description">{isNoModelAlert() ? t("models.deleteAllDescription") : t("models.deleteDescription")}</div>
                  </div>
                </PopupConfirm>
              )}
              <Button
                onPress={() => setShowKeyPopup(true)}
                variant="flat"
              >
                {t("models.newProvider")}
              </Button>
              <Button
                onPress={() => setShowParameterPopup(true)}
                variant="flat"
              >
                {t("models.parameters")}
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col rounded-b-[24px] overflow-hidden">
            <div className="grid grid-cols-[3fr_4fr_2fr_2fr_42px] px-5 py-5 pl-[80px] text-xl font-bold sticky top-0 bg-bg-op-dark-extremeweak gap-[10px]">
              <div className="justify-start">{t("Provider")}</div>
              <div className="justify-start">{t("Info")}</div>
              <div className="flex items-center justify-center">{t("Models")}</div>
              <div className="flex items-center justify-center">{t("Status")}</div>
              <div></div>
            </div>
            <div className="flex-1 overflow-y-auto rounded-b-[24px]">
              {multiModelConfigList.map((multiModelConfig: MultiModelConfig, index: number) => (
                <div
                  className="group grid grid-cols-[3fr_4fr_2fr_2fr_42px] px-5 py-5 pl-[80px] text-xl gap-[10px] hover:bg-bg-btn-hover"
                  key={`multiModelConfig-${index}`}
                >
                  <div className="flex items-center justify-start gap-[10px]">
                    <img
                      src={PROVIDER_ICONS[multiModelConfig.name as InterfaceProvider]}
                      alt={multiModelConfig.name}
                      className={`w-[22px] h-[22px] ${isProviderIconNoFilter(multiModelConfig.name as InterfaceProvider) ? "filter-none" : "dark:invert-0 invert"}`}
                    />
                    <div className="line-clamp-1 select-none">
                      {PROVIDER_LABELS[multiModelConfig.name as InterfaceProvider] || multiModelConfig.name}
                    </div>
                  </div>
                  <div className="flex flex-row items-center justify-between min-w-full">
                    <div className="line-clamp-1">
                      {multiModelConfig.apiKey && <div>Key： ***{multiModelConfig.apiKey.slice(-5)}</div>}
                      {(multiModelConfig as any).accessKeyId && <div>KeyId： ***{(multiModelConfig as any).accessKeyId.slice(-5)}</div>}
                      {(multiModelConfig as any).secretAccessKey && <div>SecretKey： ***{(multiModelConfig as any).secretAccessKey.slice(-5)}</div>}
                      {multiModelConfig.baseURL && <div>{multiModelConfig.baseURL}</div>}
                    </div>
                    <Tooltip content={t("models.editProvider")}>
                      <button
                        type="button"
                        className="flex items-center justify-center p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out hover:bg-bg-op-dark-ultraweak"
                        onClick={() => {
                          setShowKeyPopupEdit(true)
                          setCurrentIndex(index)
                        }}
                        title={t("models.editProvider")}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                          <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </Tooltip>
                  </div>
                  <div className="flex items-center justify-center min-w-full">
                    <div className="relative flex items-center justify-center">
                      <div
                        className="px-[10px] py-[1px] rounded-[12px] border-2 border-border w-[100px] text-center cursor-pointer transition-colors duration-150 ease-in-out hover:bg-bg-btn-hover"
                        onClick={() => openModelPopup(index)}
                      >
                        {getModelCount(multiModelConfig, true)}
                      </div>
                      {getModelCount(multiModelConfig, false) > 0 &&
                        <Tooltip content={t("models.unSupportModelCount", { count: getModelCount(multiModelConfig, false) })}>
                          <svg className="absolute top-0 left-full transform translate-x-[5px] translate-y-1/2" width="16px" height="16px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"></circle>
                            <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"></line>
                            <circle cx="12" cy="17" r="1.5" fill="currentColor"></circle>
                          </svg>
                        </Tooltip>}
                    </div>
                  </div>
                  <div className="flex items-center justify-center min-w-full">
                    <Switch
                      size="medium"
                      checked={multiModelConfig.active !== false}
                      onChange={() => {
                        handleMultiModelConfigChange(index, "active" as keyof MultiModelConfig, !multiModelConfig.active)
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-center min-w-full">
                    <Dropdown
                      options={[
                        {
                          label:
                            <div className="provider-edit-menu-item flex items-center gap-[10px]">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              </svg>
                              {t("models.providerMenu1")}
                            </div>,
                          onClick: () => {
                            setCurrentIndex(index)
                            setShowDelete(true)
                          }
                        },
                        {
                          label:
                            <div className="provider-edit-menu-item flex items-center gap-[10px]">
                              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
                                <path d="M11 3L5.5 7.5V14.5L11 19L16.5 14.5V7.5L11 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M5.5 7.5L11 11.5L16.5 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                <path d="M11 19V11.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                              </svg>
                              {t("models.providerMenu2")}
                            </div>,
                          onClick: () => openModelPopup(index)
                        },
                      ]}
                    >
                      <div className="w-[42px] h-[42px] p-[2px] rounded-full cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-150 ease-in-out hover:bg-bg-op-dark-ultraweak data-[state=open]:opacity-100 data-[state=open]:bg-bg-op-dark-ultraweak">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="25" height="25">
                          <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                        </svg>
                      </div>
                    </Dropdown>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {showKeyPopup && <KeyPopup onClose={() => setShowKeyPopup(false)} onSuccess={handleNewKeySubmit} />}
        {showKeyPopupEdit && <KeyPopupEdit onClose={() => setShowKeyPopupEdit(false)} onSuccess={handleKeyPopupEditSubmit} />}
        {showParameterPopup && <ParameterPopup onClose={() => setShowParameterPopup(false)} />}
        {showModelPopup && <ModelPopup defaultModel={defaultModel} onClose={() => { setShowModelPopup(false); setDefaultModel(""); }} onSuccess={handleModelSubmit} />}
        {showNoModelAlert && (
          <PopupConfirm
            noBorder={true} zIndex={900} footerType="center" className="models-delete-confirm"
            onConfirm={() => { setShowNoModelAlert(false) }}
            onClickOutside={() => { setShowNoModelAlert(false) }}
          >
            <div className="models-delete-confirm-content">
              <div className="models-delete-confirm-title">{t("models.noModelAlertTitle")}</div>
              <div className="models-delete-confirm-description">{t("models.noModelAlertDescription")}</div>
            </div>
          </PopupConfirm>
        )}
      </div>
    </div>
  )
}

const ModelSettingsPage = () => {
  return (
    <ModelsProvider>
      <ModelSettingsPageContent />
    </ModelsProvider>
  )
}

export default ModelSettingsPage