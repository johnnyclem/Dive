import { atom } from 'jotai'

export const chatIdAtom = atom('')

export const setChatIdAtom = atom(null, (get, set, chatId: string) => {
  return set(chatIdAtom, chatId)
})