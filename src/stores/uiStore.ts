import { create } from 'zustand'
import type { Key } from "@react-types/shared";

interface UIState {
  isPanelOpen: boolean
  selectedTab: Key
  togglePanel: () => void
  openPanel: (tabKey?: Key) => void
  closePanel: () => void
  setTab: (tabKey: Key) => void
}

export const useUIStore = create<UIState>((set) => ({
  isPanelOpen: false, // Default to closed
  selectedTab: "canvas", // Default tab
  togglePanel: () => set((state) => ({ isPanelOpen: !state.isPanelOpen })),
  openPanel: (tabKey) => set((state) => ({
    isPanelOpen: true,
    selectedTab: tabKey ?? state.selectedTab // Optionally switch tab, otherwise keep current
  })),
  closePanel: () => set({ isPanelOpen: false }),
  setTab: (tabKey) => set({ selectedTab: tabKey }),
}))