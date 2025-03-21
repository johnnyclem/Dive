import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSetAtom } from "jotai"
import { showToastAtom } from "../../../atoms/toastState"
import PopupConfirm from "../../../components/PopupConfirm"
import CheckBox from "../../../components/CheckBox"
import { ListOption, useModelsProvider } from "./ModelsProvider"
import { defaultInterface } from "../../../atoms/interfaceState"
import React from "react"
import WrappedInput from "../../../components/WrappedInput"
import { ModelVerifyStatus, useModelVerify } from "../../../migration/modelVerify"
import { compressData } from "../../../helper/config"

const ModelPopup = ({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) => {
  const { t } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const [checkboxState, setCheckboxState] = useState<"" | "all" | "-">("")
  const [verifiedCnt, setVerifiedCnt] = useState(0)
  const [verifiedDetail, setVerifiedDetail] = useState<ModelVerifyStatus[]>([])
  const isVerifying = useRef(false)
  const isAborting = useRef(false)
  const [fetchingList, setFetchingList] = useState(false)
  const [searchText, setSearchText] = useState("")
  const [originListOptions, setOriginListOptions] = useState<ListOption[]>([])
  const { fetchListOptions, listOptions, setListOptions,
    multiModelConfigList, setMultiModelConfigList,
    currentIndex, saveConfig
  } = useModelsProvider()
  const { verify, abort } = useModelVerify()

  const searchListOptions = useMemo(() => {
    let result = listOptions
    if(searchText.length > 0) {
      result = result?.filter(option => option.name.includes(searchText))
    }
    let state = "-"
    if(listOptions?.filter(option => option.checked).length === 0)
      state = ""
    else if(result?.length > 0 && result?.every(option => option.checked))
      state = "all"
    setCheckboxState(state as "" | "all" | "-")
    return result
  }, [listOptions, searchText])

  const multiModelConfig = multiModelConfigList?.[currentIndex]

  useEffect(() => {
    ;(async () => {
      if(!multiModelConfig)
        return

      setFetchingList(true)
      setListOptions([])
      const options = await fetchListOptions(multiModelConfig, defaultInterface[multiModelConfig.name])
      setFetchingList(false)
      const { verifiedList } = getLocalVerifyList()
      setListOptions(options.map(option => ({
        ...option,
        verified: verifiedList[option.name]
      })))
      setCheckboxState(options.length == 0 ? "" : options.every(option => option.checked) ? "all" : options.some(option => option.checked) ? "-" : "")
    })()

    return () => {
      isVerifying.current = false
    }
  }, [])

  // modelVerify: {
  //   "apikey" : {
  //     "model" : {
  //       "success" : true,
  //       "supportTools" : true
  //     },
  //     "model2" : {
  //       "success" : true,
  //       "supportTools" : false
  //     }
  //   }
  // }

  const getLocalVerifyList = () => {
    if(!multiModelConfig)
      return {}
    const localListOptions = localStorage.getItem("modelVerify")
    const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
    const key = `${multiModelConfig.apiKey || multiModelConfig.baseURL}`
    const verifiedList = allVerifiedList[key] ?? {}
    return { allVerifiedList, key, verifiedList }
  }

  const onVerifyComplete = () => {
    return true
  }

  const onVerifyUpdate = (detail: ModelVerifyStatus[]) => {
    setVerifiedDetail(detail)
    setListOptions(prev => {
      return prev.map((prevOption: ListOption) => ({
        ...prevOption,
        verified: detail.find(item => item.name === prevOption.name)?.status ?? prevOption.verified
      })) as ListOption[]
    })
    setVerifiedCnt(detail.filter(item => item.status !== "verifying").length)
  }

  const onVerifyAbort = () => {
    isVerifying.current = false
    isAborting.current = true
    setListOptions(prev => {
      return prev.map((prevOption: ListOption) => ({
        ...prevOption,
        verified: prevOption.verified === "verifying"
          ? originListOptions.find(opt => opt.name === prevOption.name)?.verified
          : prevOption.verified
      })) as ListOption[]
    })
    showToast({
      message: t("models.verifyingAbort"),
      type: "error"
    })
  }

  const handleVerify = async (targetOption?: ListOption[]) => {
    if(!multiModelConfig || !targetOption?.length)
      return true
    try {
      setOriginListOptions(JSON.parse(JSON.stringify(listOptions)))
      isVerifying.current = true
      setVerifiedCnt(0)
      const needVerifyListOptions = targetOption ? [...targetOption] : listOptions.filter(option => option.checked)
      const _multiModelConfig = JSON.parse(JSON.stringify(multiModelConfig))
      _multiModelConfig.models = needVerifyListOptions.length > 0 ? needVerifyListOptions.map(option => option.name) : []
      const needVerifyList = compressData(_multiModelConfig, currentIndex)
      await verify(needVerifyList, onVerifyComplete, onVerifyUpdate, onVerifyAbort)

      isVerifying.current = false
      return !isAborting.current
    } catch (error) {
      console.error("Failed to verify model:", error)
    } finally {
      isVerifying.current = false
      isAborting.current = false
    }
  }

  const handleGroupClick = () => {
    let State: "" | "all" | "-" = ""
    if (checkboxState == "") {
      State = "all"
    } else {
      State = ""
    }
    setCheckboxState(State)

    const _newModelList = listOptions?.map((model: ListOption) => {
      if(searchText.length > 0 && !model.name.includes(searchText))
        return { ...model, "checked": false }
      return { ...model, "checked": !!State }
    })
    setListOptions(_newModelList)
  }

  const handleModelChange = (name: string, key: string, value: any) => {
    const newModelList = listOptions?.map((model: ListOption) => {
      if (model.name === name) {
        return { ...model, [key]: value }
      }
      return model
    })
    setListOptions(newModelList)
    if (newModelList.every((model: ListOption) => model.checked)) {
      setCheckboxState("all");
    } else if (newModelList.some((model: ListOption) => model.checked)) {
      setCheckboxState("-");
    } else {
      setCheckboxState("");
    }
  }

  const handleSubmit = async (data: Record<string, any>) => {
    try {
      if (data.success) {
        showToast({
          message: t("models.modelSaved"),
          type: "success"
        })
        onSuccess()
      }
    } catch (error) {
      console.error("Failed to save config:", error)
      showToast({
        message: t("models.modelSaveFailed"),
        type: "error"
      })
    }
  }

  const onConfirm = async () => {
    const _multiModelConfigList = JSON.parse(JSON.stringify(multiModelConfigList))
    if(!multiModelConfigList){
      handleSubmit({ success: true })
      return
    }
    const unVerifyList = listOptions?.filter(option => option.checked && !option.verified)
    const success = await handleVerify(unVerifyList)
    if(!success)
      return
    try {
      setIsSubmitting(true)
      const newModelConfigList = multiModelConfigList
      newModelConfigList[currentIndex].models = listOptions.filter(option => option.checked).map(option => option.name)
      setMultiModelConfigList([...newModelConfigList])
      const data = await saveConfig()
      await handleSubmit(data)
    } catch (error) {
      setMultiModelConfigList(_multiModelConfigList)
    } finally {
      setIsSubmitting(false)
    }
  }

  const verifyStatus = (option: ListOption) => {
    if(!option?.verified) {
      return "notVerified"
    }
    if(option.verified === "verifying") {
      return "verifying"
    }
    if(option.verified.success && option.verified.supportTools) {
      return "success"
    }
    if(option.verified.success && !option.verified.supportTools) {
      return "unToolCallsSupport"
    }
    return "notSupportModel"
  }

  const verifyStatusNode = (option: ListOption) => {
    switch(verifyStatus(option)) {
      case "notSupportModel":
        return (
          <div className="verify-status">
            <div className="verify-status-text">
              {t("models.notSupportModel")}
            </div>
          </div>
        )
      case "verifying":
        return <div className="loading-spinner"></div>
      case "success":
        return (
          <svg className="correct-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
          </svg>
        )
      case "unToolCallsSupport":
        return (
          <div className="verify-status">
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z">
              </path>
              <line x1="23" y1="2" x2="2" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></line>
            </svg>
          </div>
        )
    }
  }

  const handleClose = () => {
    if(isVerifying.current){
      abort()
    }
    onClose()
  }

  return (
    <PopupConfirm
      zIndex={900}
      className="model-popup"
      disabled={isVerifying.current || isSubmitting}
      confirmText={(isVerifying.current || isSubmitting) ? (
        <div className="loading-spinner"></div>
      ) : t("tools.save")}
      onConfirm={onConfirm}
      onCancel={handleClose}
      onClickOutside={handleClose}
      footerHint={
        isVerifying.current && (
          <div className="models-progress-wrapper">
            <div className="models-progress-text">
              {t("models.progressVerifying")}
              <div className="models-progress-text-right">
                <div className="abort-button" onClick={abort}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M8 6h2v12H8zm6 0h2v12h-2z" fill="currentColor"/>
                  </svg>
                </div>
                <span>{`${verifiedCnt} / ${verifiedDetail.length}`}</span>
              </div>
            </div>
            <div className="models-progress-container">
              <div
                className="models-progress"
                style={{
                  width: `${(verifiedCnt / verifiedDetail.length) * 100}%`
                }}
              >
              </div>
            </div>
          </div>
        )
      }
    >
      <div className="model-popup-content">
        <div className="model-list-header">
          <div className="model-list-title">
            <CheckBox
              checked={!!checkboxState}
              indeterminate={checkboxState == "-"}
              onChange={handleGroupClick}
            />
            {t("models.popupTitle")}
          </div>
          <div className="model-list-tools">
            <div className="model-list-search-wrapper">
              <WrappedInput
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder={t("models.searchPlaceholder")}
                className="model-list-search"
              />
              {searchText.length > 0 &&
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 18 18"
                  width="22"
                  height="22"
                  className="model-list-search-clear"
                  onClick={() => setSearchText("")}
                >
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="m13.91 4.09-9.82 9.82M13.91 13.91 4.09 4.09"></path>
                </svg>
              }
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z">
                </path>
              </svg>
            </div>
          </div>
        </div>
        <div className="model-list">
          {fetchingList ? (
            <div className="loading-spinner-wrapper">
              <div className="loading-spinner"></div>
            </div>
          ) : (
            searchText?.length > 0 && searchListOptions?.length == 0 ?
              <div className="model-list-empty">
                {t("models.noResult")}
              </div>
              :
              searchListOptions?.map((option: ListOption) => (
                <label
                  key={option.name}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`model-option ${verifyStatus(option)}`}>
                    <CheckBox
                      checked={option.checked}
                      onChange={() => handleModelChange(option.name, "checked", !option.checked)}
                    />
                    <div className="model-option-name">
                      {option.name}
                    </div>
                    <div className="model-option-hint">
                      {verifyStatusNode(option)}
                    </div>
                  </div>
                </label>
              ))
          )}
        </div>
      </div>
    </PopupConfirm>
  )
}

export default React.memo(ModelPopup)