import { atom } from 'jotai'

export const chatIdAtom = atom<string | null>(null)

export const setChatIdAtom = atom(null, (get, set, chatId: string | null) => {
  return set(chatIdAtom, chatId)
})