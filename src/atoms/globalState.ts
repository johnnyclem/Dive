import { atom } from "jotai"
import { loadable } from "jotai/utils"

export const platformAtom = loadable(atom(async (get) => await window.ipcRenderer.getPlatform()))

export const newVersionAtom = atom<string | null>(null)