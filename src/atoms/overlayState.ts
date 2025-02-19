import { atom } from "jotai"

export type OverlayType = "Tools"

export const overlaysAtom = atom<OverlayType[]>([])

export const openOverlayAtom = atom(
  null,
  (get, set, overlay: OverlayType) => {
    const currentOverlays = get(overlaysAtom);
    const filteredOverlays = currentOverlays.filter(o => o !== overlay);
    set(overlaysAtom, [...filteredOverlays, overlay]);
    console.log(get(overlaysAtom))
  }
)

export const closeOverlayAtom = atom(
  null,
  (get, set, overlay: OverlayType) => {
    const currentOverlays = get(overlaysAtom);
    const filteredOverlays = currentOverlays.filter(o => o !== overlay);
    set(overlaysAtom, filteredOverlays);
  }
)