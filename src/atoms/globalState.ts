import { atom } from "jotai"

export const newVersionAtom = atom<string | null>(null)

export const migratingAtom = atom<boolean>(true)
