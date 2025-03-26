import React, { useEffect, useState } from 'react'
import { ModelVerifyStatus, useModelVerify } from './modelVerify'
import './_Migration.scss'
import { migratingAtom } from '../atoms/globalState'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslation } from 'react-i18next'
import { systemThemeAtom, themeAtom } from '../atoms/themeState'
import { InterfaceModelConfig, loadConfigAtom, writeRawConfigAtom } from '../atoms/configState'
import { InterfaceProvider, ModelProvider } from '../atoms/interfaceState'

function Migration() {
  const { t } = useTranslation()
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const setMigrating = useSetAtom(migratingAtom)
  const loadConfig = useSetAtom(loadConfigAtom)
  const saveAllConfig = useSetAtom(writeRawConfigAtom)
  const localListOptions = localStorage.getItem("modelVerify")
  const allVerifiedList = localListOptions ? JSON.parse(localListOptions) : {}
  const [detail, setDetail] = useState<{name: string, status: any}[]>([])
  const [progress, setProgress] = useState(0)
  const { verify, abort } = useModelVerify()

  useEffect(() => {
    runVerify()
  }, [])

  const runVerify = async () => {
    const data = await loadConfig()
    if (!data) {
      await onComplete()
      return
    }
    const needVerifyList = Object.entries(data.configs).filter(([key, value]) => {
      const _value = value as InterfaceModelConfig
      const _key = (_value.apiKey ?? _value.baseURL) as string
      const _model = _value.model as string
      return _value.active && !allVerifiedList[_key]?.[_model]
    }).reduce((acc, [key, value]) => {
      acc[key as string] = value as InterfaceModelConfig
      return acc
    }, {} as Record<string, InterfaceModelConfig>)

    await verify(needVerifyList, onComplete, onUpdate, () => {}, 60000)
  }

  const onAbort = () => {
    abort()
    onComplete()
  }

  const onUpdate = (newDetail: ModelVerifyStatus[]) => {
    setDetail(newDetail)
    const _progress = newDetail.filter(item => item.status !== "verifying" && item.status !== "abort").length
    setProgress(_progress)
  }

  const onComplete = async () => {
    const data = await loadConfig() as any
    if (!data) {
      setMigrating(false)
      return
    }

    const activeModel = data.configs[data.activeProvider]
    const _key = activeModel?.apiKey ?? activeModel?.baseURL

    // if the active model is unabled to use, set the active provider to none
    if(activeModel && _key && !allVerifiedList[_key as string]?.[activeModel.model as string]?.success) {
      await saveAllConfig({
        providerConfigs: data.configs,
        activeProvider: "none" as InterfaceProvider,
        enableTools: data.enableTools,
      })
    }
    setMigrating(false)
  }

  const updateNode = (status: ModelVerifyStatus["status"]) => {
    let _status = "verifying"
    if(!status) {
      // if verify was aborted, the result is false
      _status = "abort"
    }else if(status === "verifying" || status === "abort") {
      _status = status
    }else if(status.success && status.supportTools) {
      _status = "success"
    } else if(status.success && !status.supportTools) {
      _status = "unToolCallsSupport"
    } else if(!status.success && !status.supportTools) {
      _status = "notSupportModel"
    }

    switch(_status){
      case "success":
        return (
          <svg className="correct-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="m4.67 10.424 4.374 4.748 8.478-7.678"></path>
          </svg>
        )
      case "unToolCallsSupport":
        return t("models.unToolCallsSupport")
      case "notSupportModel":
        return t("models.notSupportModel")
      case "verifying":
        return <div className="loading-spinner"></div>
      case "abort":
        return ""
    }
  }

  return (
    <div className="reseting-wrapper" data-theme={theme === "system" ? systemTheme : theme}>
      <div className="reseting-detail">
        {detail.map((item, index) => (
          <div key={index} className="reseting-item">
            <span>{item.name} </span>
            <div className="reseting-status">
              {updateNode(item.status)}
            </div>
          </div>
        ))}
      </div>
      <div className="progress-wrapper">
        <div className="progress-text">
          {t("models.progressVerifying")}
          <div className="progress-text-right">
            <div className="abort-button" onClick={onAbort}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path d="M8 6h2v12H8zm6 0h2v12h-2z" fill="currentColor"/>
              </svg>
            </div>
            <span>{`${progress} / ${detail.length}`}</span>
          </div>
        </div>
        <div className="progress-container">
          <div
            className="progress"
            style={{
              width: `${(progress / detail.length) * 100}%`
            }}
          >
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(Migration)
