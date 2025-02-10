import React from 'react'
import { useAtom } from 'jotai'
import { toastAtom, hideToastAtom } from '../atoms/toastState'
import Toast from './Toast'

const GlobalToast = () => {
  const [toast] = useAtom(toastAtom)
  const [, hideToast] = useAtom(hideToastAtom)

  if (!toast)
    return null

  return (
    <Toast
      message={toast.message}
      type={toast.type}
      onClose={hideToast}
    />
  )
}

export default React.memo(GlobalToast) 