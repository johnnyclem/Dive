import { atom } from 'jotai'

export interface ChatHistory {
  id: string
  title: string
  createdAt: string
}

export const historiesAtom = atom<ChatHistory[]>([])

export const latestChatAtom = atom<ChatHistory | null, [ChatHistory | null], void>(
  null,
  (get, set, update) => {
    set(latestChatAtom, update)
  }
)

export const loadHistoriesAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await fetch("/api/chat/list")
      const data = await response.json()

      if (data.success) {
        set(historiesAtom, data.data)
      }
    } catch (error) {
      console.warn("Failed to load chat history:", error)
    }
  }
)

export const addChatToHistoryAtom = atom(
  null,
  (get, set, chat: ChatHistory) => {
    const currentHistories = get(historiesAtom)
    set(historiesAtom, [chat, ...currentHistories])
    set(latestChatAtom, chat)
  }
) 