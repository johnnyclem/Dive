import { atom } from 'jotai'

export type ThemeType = "system" | "light" | "dark"

export const themeAtom = atom<ThemeType>(localStorage.getItem('theme') as ThemeType || 'system')

export const setThemeAtom = atom(null, (get, set, theme: ThemeType) => {
  set(themeAtom, theme)
  localStorage.setItem('theme', theme)
})