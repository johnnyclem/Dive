import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAtom } from "jotai"
import { showToastAtom } from "../atoms/toastState"
import Textarea from "./WrappedTextarea"
import { usePersonaStore } from "../stores/personaStore"
import { formatPersonaForSystemPrompt } from "../utils/personaPromptUtils"

const CustomInstructions = () => {
  const { t } = useTranslation()
  const [instructions, setInstructions] = useState("")
  const [initialInstructions, setInitialInstructions] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)
  const { getActivePersona } = usePersonaStore()
  const activePersona = getActivePersona()
  const changed = instructions !== initialInstructions
  
  useEffect(() => {
    fetchInstructions()
  }, [])

  const fetchInstructions = async () => {
    try {
      const response = await fetch("/api/config/customrules")
      const data = await response.json()
      if (data.success) {
        setInstructions(data.rules)
        setInitialInstructions(data.rules)
      }
    } catch (error) {
      console.error("Failed to fetch custom rules:", error)
    }
  }

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true)
      const response = await fetch("/api/config/customrules", {
        method: "POST",
        body: instructions
      })
      const data = await response.json()
      if (data.success) {
        showToast({
          message: t("modelConfig.customRulesSaved"),
          type: "success"
        })
        setInitialInstructions(instructions)
      }
    } catch (error) {
      console.error("Failed to save custom rules:", error)
      showToast({
        message: t("modelConfig.customRulesFailed"),
        type: "error"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="custom-instructions">
      <h3>{t("modelConfig.customInstructions")}</h3>
      
      {activePersona && (
        <div className="active-persona-info mb-4 p-3 bg-primary/10 rounded-md border border-primary/30">
          <div className="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <circle cx="12" cy="8" r="5"/>
              <path d="M20 21a8 8 0 1 0-16 0"/>
            </svg>
            <span className="font-medium text-sm">
              {t("personas.activePersona")}: {activePersona.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("personas.personaPromptInfo")}
          </p>
          <div className="mt-2 text-xs">
            <details>
              <summary className="cursor-pointer hover:text-primary">
                {t("personas.viewPersonaPrompt")}
              </summary>
              <div className="mt-2 p-2 bg-background/50 rounded border border-border whitespace-pre-wrap font-mono text-xs">
                {formatPersonaForSystemPrompt(activePersona)}
              </div>
            </details>
          </div>
        </div>
      )}
      
      <Textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={3}
        placeholder={t("modelConfig.customInstructionsPlaceholder")}
      />
      <div className="custom-instructions-description">{t("modelConfig.customInstructionsDescription")}</div>
      <button
        className="save-btn"
        onClick={handleSubmit}
        disabled={isSubmitting || !changed}
      >
        {isSubmitting ? (
          <div className="loading-spinner" />
        ) : (
          t("modelConfig.saveInstructions")
        )}
      </button>
    </div>
  )
}

export default React.memo(CustomInstructions) 