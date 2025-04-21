import { atom } from "jotai"
import { atomWithReset, RESET } from 'jotai/utils'

export interface StreamingCode {
  code: string
  language: string
}

// Use atomWithReset for a nullable/resettable state
export const codeStreamingAtom = atomWithReset<StreamingCode | null>(null)

// Export RESET symbol if needed elsewhere for resetting
export { RESET }