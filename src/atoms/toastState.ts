import { atom } from "jotai"

export type ToastType = "info" | "success" | "warning" | "error"

export interface ToastMessage {
  message: string
  type: ToastType
  duration?: number
}

export const toastAtom = atom<ToastMessage | null>(null)

export const showToastAtom = atom(
  null,
  (get, set, toast: ToastMessage) => {
    set(toastAtom, toast)
    
    const duration = toast.duration || 3000
    setTimeout(() => {
      set(toastAtom, null)
    }, duration)
  }
)

export const hideToastAtom = atom(
  null,
  (get, set) => {
    set(toastAtom, null)
  }
) 