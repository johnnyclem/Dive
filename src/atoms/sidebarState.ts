import { atom } from 'jotai'

export const sidebarVisibleAtom = atom(false)
export const configSidebarVisibleAtom = atom(false)
export const toolsVisibleAtom = atom(false)

export const toggleSidebarAtom = atom(
  null,
  (get, set) => {
    set(sidebarVisibleAtom, !get(sidebarVisibleAtom))
  }
)

export const getPopupVisibleAtom = atom((get) => {  // is there any sidebar popup visible
  return get(configSidebarVisibleAtom) || get(toolsVisibleAtom)
})
