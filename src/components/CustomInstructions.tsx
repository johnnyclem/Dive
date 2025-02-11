import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAtom } from "jotai"
import { showToastAtom } from "../atoms/toastState"

const CustomInstructions = () => {
  const { t } = useTranslation()
  const [instructions, setInstructions] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, showToast] = useAtom(showToastAtom)

  useEffect(() => {
    fetchInstructions()
  }, [])

  const fetchInstructions = async () => {
    try {
      const response = await fetch("/api/config/customrules")
      const data = await response.json()
      if (data.success) {
        setInstructions(data.rules)
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
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={3}
        placeholder={t("modelConfig.customInstructionsPlaceholder")}
      />
      <button
        className="save-btn"
        onClick={handleSubmit}
        disabled={isSubmitting}
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