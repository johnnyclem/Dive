import { atom } from "jotai"

export type OverlayType = "Tools"

export const overlaysAtom = atom<OverlayType | null>(null)

export const setOverlayAtom = atom(
  null,
  (get, set, overlay: OverlayType) => {
    set(overlaysAtom, overlay)
  }
)

export const hideOverlayAtom = atom(
  null,
  (get, set) => {
    set(overlaysAtom, null)
  }
)